#!/usr/bin/env node

/**
 * ESPN fantasy league import (read-only mirror) — league 201.
 *
 * Pulls teams + managers from the private-league endpoint using YOUR session
 * cookies, then UPDATE-matches existing Supabase teams by espn_team_id or
 * normalized name. NEVER inserts: hard-fails if any ESPN team can't be matched
 * to an existing row.
 *
 * Usage:
 *   ESPN_S2=... ESPN_SWID=... node scripts/import-league.mjs \
 *     [--season 2027] [--dry-run]
 *
 * Env:
 *   ESPN_S2 / ESPN_SWID   required. From a logged-in espn.com browser
 *                         session. Rotates periodically — refresh when 401.
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required unless --dry-run
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SEASON = parseInt(flag('season', '2027'), 10);
const DRY_RUN = args.includes('--dry-run');

const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;
if (!ESPN_S2 || !ESPN_SWID) {
  console.error('Missing ESPN_S2 / ESPN_SWID env vars.');
  process.exit(1);
}

// ---------------------------------------------------------------------
// Fetch league payload
// ---------------------------------------------------------------------
const url =
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${SEASON}` +
  `/segments/0/leagues/201?view=mTeam&view=mRoster`;
const res = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID};`,
  },
});
if (!res.ok) {
  const body = await res.text();
  console.error(`ESPN API ${res.status}: ${body.slice(0, 200)}`);
  if (res.status === 401)
    console.error('Cookies expired or invalid. Re-grab espn_s2/SWID from a logged-in browser.');
  process.exit(1);
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
console.log(`League "${league.name}" — ${espnTeams.length} teams, season ${SEASON}\n`);

// ---------------------------------------------------------------------
// Load existing DB teams and build the match plan
// Management API (SUPABASE_ACCESS_TOKEN) is the reliable write path here —
// service_role key isn't provisioned in .env on this project. // ponytail
// ---------------------------------------------------------------------
let dbTeams = [];
let mgmtToken = null;
// Dry-run still reads teams to build the join preview; only writes are gated.
{
  mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!mgmtToken) {
    console.error('Missing SUPABASE_ACCESS_TOKEN (used for the Management API query path).');
    process.exit(1);
  }
  const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';
  const qRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select id, name, espn_team_id from public.teams' }),
  });
  if (!qRes.ok) throw new Error(`Management API: ${qRes.status} ${(await qRes.text()).slice(0, 200)}`);
  dbTeams = await qRes.json();
  var applyUpdate = async (id, fields) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl'}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          `update public.teams set espn_team_id=${fields.espn_team_id}, ` +
          `espn_owner_id=${fields.espn_owner_id ? `'${fields.espn_owner_id}'` : 'null'}, ` +
          `espn_logo_url=${fields.espn_logo_url ? `'${fields.espn_logo_url.replace(/'/g, "''")}'` : 'null'}, ` +
          `name='${fields.name.replace(/'/g, "''")}' where id='${id}'`,
      }),
    });
    if (!r.ok) throw new Error(`update ${id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  };
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

console.log('Match plan (ESPN -> existing team):');
for (const { et, db } of plan.sort((a, b) => a.et.espn_team_id - b.et.espn_team_id)) {
  console.log(
    `  #${String(et.espn_team_id).padStart(2)} "${et.name}" (${et.owner_name})` +
      `  ->  ${db ? `"${db.name}" [${db.id.slice(0, 8)}]` : '*** NO MATCH ***'}`,
  );
}

if (unmatched.length) {
  console.error(`\nFATAL: ${unmatched.length} ESPN team(s) have no matching DB row.`);
  console.error('Insert is forbidden — reconcile names manually, then re-run.');
  process.exit(1);
}

// Snapshot for the record
import fs from 'fs';
fs.writeFileSync(
  'scripts/league-201-latest.json',
  JSON.stringify({ season: SEASON, fetched_at: new Date().toISOString(), teams: espnTeams }, null, 2),
);

if (DRY_RUN) {
  console.log('\n--dry-run: no writes. Re-run without --dry-run to apply.');
  process.exit(0);
}

// ---------------------------------------------------------------------
// Apply updates only
// ---------------------------------------------------------------------
for (const { et, db } of plan) {
  await applyUpdate(db.id, {
    espn_team_id: et.espn_team_id,
    espn_owner_id: et.espn_owner_id,
    espn_logo_url: et.logo_url,
    name: et.name,
  });
}
console.log(`\nApplied: ${plan.length} teams updated (0 inserted).`);

// ---------------------------------------------------------------------
// Roster mirror: upsert each ESPN roster entry into public.rosters.
// Players are matched by espn_id -> players.id; entries whose player isn't
// in our pool yet are skipped with a count (run import-nba.mjs first).
// ---------------------------------------------------------------------
const ACQ = { DRAFT: 'draft', KEEPER: 'keeper', TRADE: 'trade', ADD: 'trade', WAIVER: 'trade' };
const seasonLabel = `${SEASON - 1}-${String(SEASON).slice(2)}`;
const { data: seasonRow } = await applyQuery(
  `select id from public.seasons where label = '${seasonLabel}'`,
);
if (!seasonRow?.length) {
  console.log(`No seasons row for ${seasonLabel}; skipping roster mirror.`);
} else {
  const seasonId = seasonRow[0].id;
  const { data: teamRows } = await applyQuery(
    `select id, espn_team_id from public.teams where espn_team_id is not null`,
  );
  const teamByEspn = new Map(teamRows.map((t) => [t.espn_team_id, t.id]));

  let matched = 0;
  let missingPlayers = new Set();
  let rosterRows = [];
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
        matched++;
      }
    }
  }
  missingPlayers = new Set(rosterRows.filter((r) => !r.player_id).map((r) => r.player_espn_id));
  const rows = rosterRows.filter((r) => r.player_id);

  // upsert via Management API, batched
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
  console.log(`Roster mirror: ${rows.length} roster spots upserted (${matched} resolved).`);
  if (missingPlayers.size)
    console.log(`Skipped ${missingPlayers.size} players not in pool — run import-nba.mjs.`);
}

async function applyQuery(query) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl'}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  );
  if (!r.ok) throw new Error(`query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return { data: await r.json() };
}
