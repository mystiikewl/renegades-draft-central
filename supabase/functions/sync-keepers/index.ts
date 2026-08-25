// Supabase Edge Function: sync-keepers
//
// Mirrors rosters (incl. keeper flags) from the live ESPN league into
// public.rosters — server-side port of scripts/import-league.mjs.
//
// Required function env vars (set via `supabase secrets set`):
//   ESPN_S2               espn_s2 cookie from a logged-in espn.com session
//   ESPN_SWID             SWID cookie from the same session
//   SUPABASE_ACCESS_TOKEN personal access token (Management API write path)
//   SUPABASE_PROJECT_REF  optional, defaults to xruqdjonzxkzwsslzpdl
//
// DEPLOYMENT PENDING: not yet deployed. Deploy with:
//   supabase functions deploy sync-keepers
//
// POST { "season": 2026 } -> { teams_updated, roster_upserted, players_resolved, players_skipped }
// @ts-check
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const PROJECT_REF_DEFAULT = 'xruqdjonzxkzwsslzpdl';
const ACQ = { DRAFT: 'draft', KEEPER: 'keeper', TRADE: 'trade', ADD: 'trade', WAIVER: 'trade' };

const esc = (s) => String(s).replace(/'/g, "''");

async function mgmtQuery(token, projectRef, query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const ESPN_S2 = Deno.env.get('ESPN_S2');
  const ESPN_SWID = Deno.env.get('ESPN_SWID');
  const token = Deno.env.get('SUPABASE_ACCESS_TOKEN');
  const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') ?? PROJECT_REF_DEFAULT;
  if (!ESPN_S2 || !ESPN_SWID || !token) {
    return new Response(
      JSON.stringify({ error: 'Missing env vars. Set ESPN_S2, ESPN_SWID and SUPABASE_ACCESS_TOKEN via `supabase secrets set`.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
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
    const dbTeams = await mgmtQuery(token, projectRef, 'select id, name, espn_team_id from public.teams');

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
      await mgmtQuery(
        token,
        projectRef,
        `update public.teams set espn_team_id=${et.id}, name='${esc(et.name)}' where id='${db.id}'`,
      );
    }

    // Roster mirror
    const seasonLabel = `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
    const seasons = await mgmtQuery(token, projectRef, `select id from public.seasons where label = '${seasonLabel}'`);
    if (!seasons.length) throw new Error(`No seasons row for ${seasonLabel}.`);

    const teamRows = await mgmtQuery(token, projectRef, 'select id, espn_team_id from public.teams where espn_team_id is not null');
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
      const list = espnIds.slice(i, i + 200).map((id) => `'${id}'`).join(',');
      const players = await mgmtQuery(token, projectRef, `select id, espn_id from public.players where espn_id in (${list})`);
      for (const p of players ?? []) {
        for (const r of rosterRows.filter((r) => r.player_espn_id === p.espn_id)) {
          r.player_id = p.id;
          playersResolved++;
        }
      }
    }
    const rows = rosterRows.filter((r) => r.player_id);
    const playersSkipped = rosterRows.length - rows.length;

    for (let i = 0; i < rows.length; i += 100) {
      const values = rows
        .slice(i, i + 100)
        .map(
          (r) =>
            `('${seasons[0].id}', '${r.team_id}', '${r.player_id}', '${r.acquisition}', ` +
            `${r.acquired_at ? `'${r.acquired_at}'` : 'default'})`,
        )
        .join(',\n  ');
      await mgmtQuery(
        token,
        projectRef,
        `insert into public.rosters (season_id, team_id, player_id, acquisition, acquired_at) values ${values} ` +
          `on conflict (season_id, player_id) do update set team_id = excluded.team_id, acquisition = excluded.acquisition, ` +
          `acquired_at = coalesce(excluded.acquired_at, public.rosters.acquired_at)`,
      );
    }

    return new Response(
      JSON.stringify({
        teams_updated: plan.length,
        roster_upserted: rows.length,
        players_resolved: playersResolved,
        players_skipped: playersSkipped,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
