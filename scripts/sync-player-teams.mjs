#!/usr/bin/env node

/**
 * Sync players.nba_team against ESPN's fresher sources.
 *
 * The routine bio import (import-nba.mjs) reads site team rosters, which lag
 * offseason trades/signings. This script cross-checks every espn-linked
 * player against two other ESPN feeds:
 *
 *   1. core athlete API  (sports.core.api.espn.com) — canonical athlete->team,
 *      proven freshest for the 2026 offseason (Ivey CHI, Thomas MIL, ...).
 *   2. fantasy kona_player_info pool (league 201, needs ESPN_S2/SWID) —
 *      independent signal; proTeamId 0 means "in transit/unsigned", not a
 *      real team, and its numeric team ids are derived empirically below
 *      rather than assumed.
 *
 * Change policy: core is primary. A move is applied when core disagrees with
 * the DB. Fantasy-only disagreements (core == DB != fantasy, fantasy != 0)
 * are reported but NOT applied unless --trust-fantasy is passed — use that
 * only when you have outside confirmation of the move.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-player-teams.mjs            # dry run
 *   node --env-file=.env scripts/sync-player-teams.mjs --apply
 *   ... --trust-fantasy   # also apply fantasy-only moves
 *
 * Env: SUPABASE_ACCESS_TOKEN; ESPN_S2 + ESPN_SWID optional (enables fantasy
 * cross-check).
 */

const APPLY = process.argv.includes('--apply');
const TRUST_FANTASY = process.argv.includes('--trust-fantasy');
const REF = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';
const FANTASY_SEASON = 2027; // ESPN fantasy season year for the 2026-27 campaign
const LEAGUE_ID = 201;

const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
};

// ---------------------------------------------------------------- core API
const teamAbbrByRef = new Map();
async function teamForRef(ref) {
  if (teamAbbrByRef.has(ref)) return teamAbbrByRef.get(ref);
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`team ${ref}: HTTP ${res.status}`);
  const t = await res.json();
  teamAbbrByRef.set(ref, t.abbreviation ?? null);
  return t.abbreviation ?? null;
}

async function coreTeamFor(id, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(
        `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${id}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (res.status === 404) return { status: 'no-athlete' };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (!j.team?.$ref) return { status: 'no-team' };
      return { status: 'ok', team: await teamForRef(j.team.$ref) };
    } catch (err) {
      if (i === tries - 1) return { status: 'error', err: err.message };
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ------------------------------------------------------------ fantasy pool
async function fantasyPool() {
  const { ESPN_S2, ESPN_SWID } = process.env;
  if (!ESPN_S2 || !ESPN_SWID) {
    console.log('(ESPN_S2/ESPN_SWID not set — skipping fantasy cross-check)');
    return null;
  }
  const PAGE = 50;
  const pool = new Map(); // espn id -> proTeamId
  for (let offset = 0; ; offset += PAGE) {
    const filter = JSON.stringify({
      players: { limit: PAGE, offset, sortStatId: { sortPriority: 1, sortAsc: true, value: 0 } },
    });
    const res = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${FANTASY_SEASON}/segments/0/leagues/${LEAGUE_ID}?view=kona_player_info`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'X-Fantasy-Filter': filter, Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID};` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!res.ok) throw new Error(`fantasy pool ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const page = await res.json();
    const players = page.players ?? [];
    for (const w of players) pool.set(String(w.player.id), w.player.proTeamId);
    if (players.length < PAGE) break;
  }
  return pool;
}

// ------------------------------------------------------------------- main
const rows = await q(`select id, name, espn_id, nba_team from players where espn_id is not null order by name`);
console.log(`espn-linked players: ${rows.length}`);

const core = [];
const BATCH = 8;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  core.push(...(await Promise.all(batch.map(async (p) => [p, await coreTeamFor(p.espn_id)]))));
  process.stdout.write(`core ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}
console.log('');

const pool = await fantasyPool();
if (pool) console.log(`fantasy pool: ${pool.size} players`);

// Derive proTeamId -> abbreviation empirically: for every proTeamId, majority
// vote of core-resolved teams among players we can cross-reference. This
// avoids hardcoding ESPN's internal id space (which has burned us before).
const abbrByProTeamId = new Map();
if (pool) {
  const votes = new Map(); // proTeamId -> Map(abbr -> count)
  for (const [p, r] of core) {
    if (r.status !== 'ok' || !r.team) continue;
    const ptid = pool.get(p.espn_id);
    if (ptid == null || ptid === 0) continue;
    if (!votes.has(ptid)) votes.set(ptid, new Map());
    const m = votes.get(ptid);
    m.set(r.team, (m.get(r.team) ?? 0) + 1);
  }
  for (const [ptid, m] of votes) {
    const [winner, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3) abbrByProTeamId.set(ptid, winner); // ignore tiny/ambiguous buckets
  }
  console.log(`derived fantasy team map: ${[...abbrByProTeamId.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`);
}
const fantasyTeamFor = (espnId) => {
  const ptid = pool?.get(espnId);
  if (ptid == null) return null; // not in fantasy universe
  if (ptid === 0) return 'FA';   // in transit / unsigned
  return abbrByProTeamId.get(ptid) ?? null;
};

// ------------------------------------------------------------ reconcile
const errors = core.filter(([, r]) => r.status === 'error');
const missing = core.filter(([, r]) => r.status === 'no-athlete' || r.status === 'no-team');
const ok = core.filter(([, r]) => r.status === 'ok' && r.team);

const coreChanges = ok.filter(([p, r]) => r.team !== p.nba_team);
const fantasyOnly = ok.filter(([p, r]) => {
  if (!pool) return false;
  const f = fantasyTeamFor(p.espn_id);
  return f && f !== 'FA' && f !== p.nba_team && f !== r.team;
});

console.log(`\ncore ok: ${ok.length}, no-team/no-athlete: ${missing.length}, errors: ${errors.length}`);
if (missing.length) console.log('  missing:', missing.map(([p, r]) => `${p.name} (${r.status})`).join(', '));
if (errors.length) console.log('  errors:', errors.map(([p, r]) => `${p.name}: ${r.err}`).join('; '));

console.log(`\n=== CORE CHANGES (${coreChanges.length}) ===`);
for (const [p, r] of coreChanges) {
  const f = fantasyTeamFor(p.espn_id);
  console.log(`${p.name}: ${p.nba_team} -> ${r.team}${f && f !== r.team ? `  [fantasy says ${f}]` : f === r.team ? '  [fantasy agrees]' : ''}`);
}

if (pool) {
  console.log(`\n=== FANTASY-ONLY DISAGREEMENTS (${fantasyOnly.length}) — not applied${TRUST_FANTASY ? ' (OVERRIDDEN)' : ''} ===`);
  for (const [p, r] of fantasyOnly) {
    const f = fantasyTeamFor(p.espn_id);
    console.log(`${p.name}: db ${p.nba_team}, core ${r.team}, fantasy ${f}`);
  }
}

// fantasy "FA" flags worth surfacing even when core agrees with db (in-transit)
if (pool) {
  const limbo = ok.filter(([p]) => {
    const f = fantasyTeamFor(p.espn_id);
    return !coreChanges.some(([cp]) => cp.id === p.id) && f === 'FA';
  });
  if (limbo.length) console.log(`\n=== FANTASY FLAGS "FA" (in transit — watch these) ===\n${limbo.map(([p]) => p.name).join(', ')}`);
}

if (APPLY && coreChanges.length) {
  const byTeam = new Map();
  for (const [p, r] of coreChanges) {
    if (!byTeam.has(r.team)) byTeam.set(r.team, []);
    byTeam.get(r.team).push(p.id);
  }
  for (const [team, ids] of byTeam) {
    const list = ids.map((i) => `'${i}'`).join(', ');
    await q(`update public.players set nba_team = '${team}' where id in (${list})`);
    console.log(`applied: ${ids.length} -> ${team}`);
  }
  console.log(`done: ${coreChanges.length} players updated from core API`);
} else if (APPLY) {
  console.log('nothing to apply');
} else {
  console.log('\n(dry run — rerun with --apply to write)');
}
