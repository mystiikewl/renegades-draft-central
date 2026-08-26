#!/usr/bin/env node

/**
 * ESPN fantasy league import (read-only mirror) — league 201.
 *
 * Pulls teams + managers + rosters from the private-league endpoint using
 * session cookies, then UPDATE-matches existing Supabase teams by
 * espn_team_id or normalized name. NEVER inserts: hard-fails if any ESPN
 * team can't be matched to an existing row. Roster entries are upserted
 * (safe to re-run); acquisitionType KEEPER maps to acquisition='keeper'.
 *
 * Usage:
 *   ESPN_S2=... ESPN_SWID=... node scripts/import-league.mjs \
 *     [--season 2026] [--dry-run]
 *
 * Env:
 *   ESPN_S2 / ESPN_SWID   required. From a logged-in espn.com browser
 *                         session. Rotates periodically — refresh when 401.
 *   SUPABASE_ACCESS_TOKEN required unless --dry-run
 *   SUPABASE_PROJECT_REF  optional (default xruqdjonzxkzwsslzpdl)
 */

import fs from 'fs';
import { pathToFileURL } from 'url';

const PROJECT_REF_DEFAULT = 'xruqdjonzxkzwsslzpdl';

/**
 * Core sync — usable as a library (scripts/sync-espn-keepers.mjs, edge fn port)
 * or as this CLI. Returns counts; never inserts teams.
 */
export async function syncLeague({
  season,
  dryRun = false,
  espnS2 = process.env.ESPN_S2,
  espnSwid = process.env.ESPN_SWID,
  mgmtToken = process.env.SUPABASE_ACCESS_TOKEN,
  projectRef = process.env.SUPABASE_PROJECT_REF ?? PROJECT_REF_DEFAULT,
  log = console.log,
} = {}) {
  const SEASON = parseInt(season ?? '2027', 10);
  const DRY_RUN = !!dryRun;

  if (!espnS2 || !espnSwid) throw new Error('Missing ESPN_S2 / ESPN_SWID env vars.');
  if (!DRY_RUN && !mgmtToken)
    throw new Error('Missing SUPABASE_ACCESS_TOKEN (used for the Management API query path).');

  // ---------------------------------------------------------------------
  // Fetch league payload
  // ---------------------------------------------------------------------
  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${SEASON}` +
    `/segments/0/leagues/201?view=mTeam&view=mRoster`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Cookie: `espn_s2=${espnS2}; SWID=${espnSwid};`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const msg = `ESPN API ${res.status}: ${body.slice(0, 200)}`;
    if (res.status === 401)
      throw new Error(`${msg}\nCookies expired or invalid. Re-grab espn_s2/SWID from a logged-in browser.`);
    throw new Error(msg);
  }
  const league = await res.json();

  const memberById = new Map(league.members.map((m) => [m.id, m]));
  const espnTeams = league.teams.map((t) => {
    const owner = memberById.get(t.primaryOwner);
    return {
      espn_team_id: t.id,
      name: t.name,
      abbreviation: t.abbrev,
      logo_url: t.logo ?? null,
      espn_owner_id: t.primaryOwner ?? null,
      owner_name: owner ? `${owner.firstName} ${owner.lastName}` : null,
      owner_username: owner?.displayName ?? null,
    };
  });
  log(`League "${league.name}" — ${espnTeams.length} teams, season ${SEASON}\n`);

  const applyQuery = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return { data: await r.json() };
  };

  // ---------------------------------------------------------------------
  // Load existing DB teams and build the match plan
  // ---------------------------------------------------------------------
  let dbTeams = [];
  if (!DRY_RUN || true) {
    // Dry-run still reads teams to build the join preview; only writes are gated.
    ({ data: dbTeams } = await applyQuery('select id, name, espn_team_id from public.teams'));
  }

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // One-time reconciliation: legacy hand-typed DB names -> ESPN ids.
  // Once espn_team_id is set on all rows this map is dead weight; matching
  // then runs purely on espn_team_id. // ponytail
  const LEGACY_NAME_MAP = {
    innocentuntilprovengiddey: 10,
  };

  const plan = [];
  const unmatched = [];
  for (const et of espnTeams) {
    // match priority: linked espn_team_id > legacy alias > normalized name
    let db =
      dbTeams.find((d) => d.espn_team_id === et.espn_team_id) ??
      dbTeams.find((d) => d.espn_team_id == null && LEGACY_NAME_MAP[norm(d.name)] === et.espn_team_id) ??
      dbTeams.find((d) => norm(d.name) === norm(et.name));
    plan.push({ et, db: db ?? null });
    if (!db) unmatched.push(et);
  }

  log('Match plan (ESPN -> existing team):');
  for (const { et, db } of plan.sort((a, b) => a.et.espn_team_id - b.et.espn_team_id)) {
    log(
      `  #${String(et.espn_team_id).padStart(2)} "${et.name}" (${et.owner_name})` +
        `  ->  ${db ? `"${db.name}" [${db.id.slice(0, 8)}]` : '*** NO MATCH ***'}`,
    );
  }

  if (unmatched.length) {
    throw new Error(
      `${unmatched.length} ESPN team(s) have no matching DB row. Insert is forbidden — reconcile names manually, then re-run.`,
    );
  }

  // Snapshot for the record
  fs.writeFileSync(
    'scripts/league-201-latest.json',
    JSON.stringify({ season: SEASON, fetched_at: new Date().toISOString(), teams: espnTeams }, null, 2),
  );

  if (DRY_RUN) {
    log('\n--dry-run: no writes. Re-run without --dry-run to apply.');
    return { teamsMatched: plan.length, teamsUpdated: 0, rosterUpserted: 0, playersResolved: 0, playersSkipped: 0 };
  }

  // ---------------------------------------------------------------------
  // Apply updates only
  // ---------------------------------------------------------------------
  const esc = (s) => String(s).replace(/'/g, "''");
  for (const { et, db } of plan) {
    await applyQuery(
      `update public.teams set espn_team_id=${et.espn_team_id}, ` +
        `espn_owner_id=${et.espn_owner_id ? `'${esc(et.espn_owner_id)}'` : 'null'}, ` +
        `espn_logo_url=${et.logo_url ? `'${esc(et.logo_url)}'` : 'null'}, ` +
        `name='${esc(et.name)}' where id='${db.id}'`,
    );
  }
  log(`\nApplied: ${plan.length} teams updated (0 inserted).`);

  // ---------------------------------------------------------------------
  // Roster mirror: upsert each ESPN roster entry into public.rosters.
  // Players are matched by espn_id -> players.id; entries whose player isn't
  // in our pool yet are skipped with a count (run import-nba.mjs first).
  // ---------------------------------------------------------------------
  const ACQ = { DRAFT: 'draft', KEEPER: 'keeper', TRADE: 'trade', ADD: 'trade', WAIVER: 'trade' };
  const seasonLabel = `${SEASON}-${String((SEASON + 1) % 100).padStart(2, '0')}`;
  const { data: seasonRow } = await applyQuery(
    `select id from public.seasons where label = '${seasonLabel}'`,
  );
  let rosterUpserted = 0;
  let playersResolved = 0;
  let playersSkipped = 0;
  if (!seasonRow?.length) {
    log(`No seasons row for ${seasonLabel}; skipping roster mirror.`);
  } else {
    const seasonId = seasonRow[0].id;
    const { data: teamRows } = await applyQuery(
      `select id, espn_team_id from public.teams where espn_team_id is not null`,
    );
    const teamByEspn = new Map(teamRows.map((t) => [t.espn_team_id, t.id]));

    // Keeper protection (same contract as the edge fn): never overwrite rows
    // already tagged acquisition='keeper', and go fully read-only once
    // keepers are finalized — otherwise a sync silently un-keeps players and
    // the next finalize drops them.
    const { data: settingsRow } = await applyQuery(
      `select keepers_finalized_at from public.draft_settings where season_id = '${seasonId}'`,
    );
    if (settingsRow?.length && settingsRow[0].keepers_finalized_at) {
      log(
        `Keepers finalized for ${seasonLabel} — roster mirror skipped (read-only after finalize).`,
      );
      return { teamsMatched: plan.length, teamsUpdated: plan.length, rosterUpserted: 0, playersResolved: 0, playersSkipped: 0 };
    }
    const { data: keeperRows } = await applyQuery(
      `select player_id from public.rosters where season_id = '${seasonId}' and acquisition = 'keeper'`,
    );
    const keeperSet = new Set((keeperRows ?? []).map((r) => r.player_id));
    if (keeperSet.size) log(`Protecting ${keeperSet.size} tagged keeper row(s) from overwrite.`);

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
    const espnIds = [...new Set(rosterRows.map((r) => r.player_espn_id))];
    for (let i = 0; i < espnIds.length; i += 200) {
      const chunk = espnIds.slice(i, i + 200);
      const list = chunk.map((id) => `'${id}'`).join(',');
      const { data: players } = await applyQuery(
        `select id, espn_id from public.players where espn_id in (${list})`,
      );
      for (const p of players ?? []) {
        for (const r of rosterRows.filter((r) => r.player_espn_id === p.espn_id)) {
          r.player_id = p.id;
          playersResolved++;
        }
      }
    }
    const missing = new Set(rosterRows.filter((r) => !r.player_id));
    playersSkipped = missing.size;
    const keptSkipped = rosterRows.filter((r) => r.player_id && keeperSet.has(r.player_id)).length;
    if (keptSkipped) log(`Skipping ${keptSkipped} ESPN row(s) that conflict with tagged keepers.`);
    const rows = rosterRows.filter((r) => r.player_id && !keeperSet.has(r.player_id));

    // upsert, batched
    for (let i = 0; i < rows.length; i += 100) {
      const values = rows
        .slice(i, i + 100)
        .map(
          (r) =>
            `('${seasonId}', '${r.team_id}', '${r.player_id}', '${r.acquisition}', ` +
            `${r.acquired_at ? `'${r.acquired_at}'` : 'default'})`,
        )
        .join(',\n  ');
      await applyQuery(
        `insert into public.rosters (season_id, team_id, player_id, acquisition, acquired_at) ` +
          `values ${values} ` +
          `on conflict (season_id, player_id) do update set team_id = excluded.team_id, ` +
          `acquisition = excluded.acquisition, acquired_at = coalesce(excluded.acquired_at, public.rosters.acquired_at)`,
      );
    }
    rosterUpserted = rows.length;
    log(`Roster mirror: ${rows.length} roster spots upserted (${playersResolved} resolved).`);
    if (playersSkipped) log(`Skipped ${playersSkipped} players not in pool — run import-nba.mjs.`);
  }

  return { teamsMatched: plan.length, teamsUpdated: plan.length, rosterUpserted, playersResolved, playersSkipped };
}

// CLI entry point when run directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  try {
    const result = await syncLeague({ season: flag('season', '2027'), dryRun: args.includes('--dry-run') });
    console.log('\nDone:', result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
