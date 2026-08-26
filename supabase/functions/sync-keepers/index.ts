// Supabase Edge Function: sync-keepers
//
// Mirrors rosters (incl. keeper flags) from the live ESPN league into
// public.rosters — server-side port of scripts/import-league.mjs.
//
// Keeper safety: rows already marked acquisition='keeper' are never touched
// (ESPN cannot overwrite or move them), and once draft_settings
// .keepers_finalized_at is set the roster mirror goes read-only so a sync
// can never resurrect non-keepers into the pool after Finalize Keepers.
//
// Env vars: ESPN_S2, ESPN_SWID set via `supabase secrets set`.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected into every
// Edge Function by the platform — no PAT required.
//
// POST { "season": 2026 } -> { teams_updated, roster_upserted, keepers_protected, rosters_skipped_finalized, players_resolved, players_skipped }
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const ACQ = { DRAFT: 'draft', KEEPER: 'keeper', TRADE: 'trade', ADD: 'trade', WAIVER: 'trade' };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rest(path, init = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`postgrest ${path}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

/** Verify caller JWT and require profiles.is_admin. */
async function requireAdmin(req) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub) return false;
    // ponytail: string compare on uuids is safe here; ids are server-generated
    const rows = await rest(`profiles?id=eq.${encodeURIComponent(payload.sub)}&select=is_admin`);
    return Array.isArray(rows) && rows.length === 1 && rows[0].is_admin === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!(await requireAdmin(req))) {
    return json({ error: 'Forbidden: admin only' }, 403);
  }

  const ESPN_S2 = Deno.env.get('ESPN_S2');
  const ESPN_SWID = Deno.env.get('ESPN_SWID');
  if (!ESPN_S2 || !ESPN_SWID) {
    return json({ error: 'Missing env vars. Set ESPN_S2 and ESPN_SWID via `supabase secrets set`.' }, 500);
  }

  let season = 2026;
  try {
    const body = await req.json();
    if (body?.season) season = parseInt(body.season, 10);
  } catch {
    /* default season */
  }

  try {
    // Fetch league payload
    const url =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}` +
      `/segments/0/leagues/201?view=mTeam&view=mRoster`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID};` },
    });
    if (!res.ok) throw new Error(`ESPN API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const league = await res.json();

    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dbTeams = await rest('teams?select=id,name,espn_team_id');

    // Match ESPN teams to DB rows by linked id > normalized name; never insert.
    const plan = [];
    const unmatched = [];
    for (const t of league.teams) {
      const db =
        dbTeams.find((d) => d.espn_team_id === t.id) ??
        dbTeams.find((d) => d.espn_team_id == null && norm(d.name) === norm(t.name));
      if (!db) unmatched.push(t.name);
      else plan.push({ et: t, db });
    }
    if (unmatched.length) {
      throw new Error(`No matching DB team row(s): ${unmatched.join(', ')}. Insert is forbidden.`);
    }

    for (const { et, db } of plan) {
      await rest(`teams?id=eq.${db.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ espn_team_id: et.id, name: et.name }),
      });
    }

    // Roster mirror
    const seasonLabel = `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
    const seasons = await rest(`seasons?label=eq.${seasonLabel}&select=id`);
    if (!seasons?.length) throw new Error(`No seasons row for ${seasonLabel}.`);
    const seasonId = seasons[0].id;

    const keeperRows = await rest(`rosters?season_id=eq.${seasonId}&acquisition=eq.keeper&select=player_id`);
    const keeperSet = new Set((keeperRows ?? []).map((r) => r.player_id));
    const settingsRows = await rest(`draft_settings?season_id=eq.${seasonId}&select=keepers_finalized_at`);
    const keepersFinalized = !!settingsRows?.[0]?.keepers_finalized_at;

    const teamRows = await rest('teams?espn_team_id=not.is.null&select=id,espn_team_id');
    const teamByEspn = new Map(teamRows.map((t) => [t.espn_team_id, t.id]));

    const rosterRows = [];
    for (const t of league.teams) {
      const teamId = teamByEspn.get(t.id);
      if (!teamId) continue;
      for (const e of t.roster?.entries ?? []) {
        const p = e.playerPoolEntry?.player ?? e.player;
        if (!p?.id) continue;
        rosterRows.push({
          player_espn_id: String(p.id),
          team_id: teamId,
          acquisition: ACQ[e.acquisitionType] ?? 'draft',
          acquired_at: e.acquisitionDate ? new Date(parseInt(e.acquisitionDate)).toISOString() : null,
        });
      }
    }

    // resolve player uuids in batches
    let playersResolved = 0;
    const espnIds = [...new Set(rosterRows.map((r) => r.player_espn_id))];
    for (let i = 0; i < espnIds.length; i += 200) {
      const list = `(${espnIds.slice(i, i + 200).map((id) => `"${id}"`).join(',')})`;
      const players = await rest(`players?espn_id=in.${list}&select=id,espn_id`);
      for (const p of players ?? []) {
        for (const r of rosterRows.filter((r) => r.player_espn_id === p.espn_id)) {
          r.player_id = p.id;
          playersResolved++;
        }
      }
    }
    const rows = rosterRows.filter((r) => r.player_id);
    const playersSkipped = rosterRows.length - rows.length;
    const keepersProtected = rows.filter((r) => keeperSet.has(r.player_id)).length;
    const writable = keepersFinalized ? [] : rows.filter((r) => !keeperSet.has(r.player_id));

    let rosterUpserted = 0;
    for (let i = 0; i < writable.length; i += 100) {
      const batch = writable.slice(i, i + 100).map((r) => ({
        season_id: seasonId,
        team_id: r.team_id,
        player_id: r.player_id,
        acquisition: r.acquisition,
        ...(r.acquired_at ? { acquired_at: r.acquired_at } : {}),
      }));
      await rest('rosters?on_conflict=season_id,player_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(batch),
      });
      rosterUpserted += batch.length;
    }

    return json({
      teams_updated: plan.length,
      roster_upserted: rosterUpserted,
      keepers_protected: keepersProtected,
      rosters_skipped_finalized: keepersFinalized ? rows.length : 0,
      players_resolved: playersResolved,
      players_skipped: playersSkipped,
    });
  } catch (err) {
    return json({ error: String(err.message ?? err) }, 500);
  }
});
