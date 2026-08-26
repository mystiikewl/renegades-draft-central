#!/usr/bin/env node

/**
 * Trade/draft integrity simulation against a throwaway Supabase season.
 *
 * Exercises commissioner overrides, pick ownership across reset, exact-slot
 * skip/pick/undo behavior, reset protection for traded drafted players,
 * reversal, and post-completion locks.
 */

import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFile = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const MGMT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';
const ADMIN_EMAIL = process.env.SIM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SIM_ADMIN_PASSWORD;
const LABEL = 'E2E-TRADE-INTEGRITY';

for (const [name, value] of Object.entries({
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_ANON_KEY: ANON,
  SUPABASE_ACCESS_TOKEN: MGMT,
  SIM_ADMIN_EMAIL: ADMIN_EMAIL,
  SIM_ADMIN_PASSWORD: ADMIN_PASSWORD,
})) {
  if (!value) {
    console.error(`FAIL env: missing ${name}`);
    process.exit(1);
  }
}

let failures = 0;
let stepNumber = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function step(name, fn) {
  stepNumber += 1;
  try {
    await fn();
    console.log(`PASS [${String(stepNumber).padStart(2, '0')}] ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL [${String(stepNumber).padStart(2, '0')}] ${name}\n     ${error.message}`);
  }
}
async function expectError(promise, needle) {
  try {
    await promise;
    throw new Error(`expected error containing "${needle}", got success`);
  } catch (error) {
    if (!String(error.message).includes(needle)) throw error;
  }
}

async function login() {
  const response = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.msg ?? body.error_description ?? `login ${response.status}`);
  return body.access_token;
}

async function rpc(name, params, token) {
  const response = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* text response */ }
  if (!response.ok) {
    const message = body && typeof body === 'object' ? body.message ?? JSON.stringify(body) : String(body);
    throw new Error(`${name}: ${message}`);
  }
  return body;
}

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`management SQL ${response.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return []; }
}

const picks = (seasonId) => sql(`
  select id, pick_number, round, team_id, original_team_id, player_id, is_used, is_skipped
  from public.draft_picks
  where season_id = '${seasonId}'::uuid
  order by pick_number
`);

let admin;
let seasonId;
let teamA;
let teamB;
let playerA;
let playerB;
let tradedPickId;
let draftedRosterId;
let draftedPlayerTradeId;

console.log(`\n=== Trade/draft integrity E2E: ${LABEL} ===\n`);

await step('clean leftovers and authenticate admin', async () => {
  await sql(`delete from public.seasons where label = '${LABEL}'`);
  admin = await login();
});

await step('create isolated 2-team test season', async () => {
  seasonId = await rpc('create_season', { p_label: LABEL }, admin);
  assert(typeof seasonId === 'string' && seasonId.length === 36, 'season UUID missing');
  await sql(`update public.draft_settings set league_size = 2, roster_size = 3 where season_id = '${seasonId}'::uuid`);
  const teams = await sql(`select id from public.teams where not is_shadow order by name limit 2`);
  assert(teams.length === 2, 'need two real teams');
  [teamA, teamB] = teams.map((row) => row.id);
  const players = await sql(`select id from public.players order by name limit 2`);
  assert(players.length === 2, 'need two players');
  [playerA, playerB] = players.map((row) => row.id);
  await rpc('set_draft_order', { p_season_id: seasonId, p_order: [teamA, teamB] }, admin);
  const board = await picks(seasonId);
  assert(board.length === 6, `expected 6 picks, got ${board.length}`);
});

await step('commissioner override transfers an unused pick and logs it', async () => {
  const board = await picks(seasonId);
  const target = board.find((pick) => pick.team_id === teamA);
  assert(target, 'no Team A pick found');
  tradedPickId = target.id;
  const tradeId = await rpc('admin_override_trade', {
    p_season_id: seasonId,
    p_from_team_id: teamA,
    p_to_team_id: teamB,
    p_from_roster_ids: [],
    p_from_pick_ids: [tradedPickId],
    p_to_roster_ids: [],
    p_to_pick_ids: [],
    p_note: 'E2E pick override',
  }, admin);
  assert(typeof tradeId === 'string', 'override trade id missing');
  const after = await picks(seasonId);
  assert(after.find((pick) => pick.id === tradedPickId)?.team_id === teamB, 'pick holder did not move');
  const ledger = await sql(`select status, is_admin_override from public.trades where id = '${tradeId}'::uuid`);
  assert(ledger[0]?.status === 'accepted' && ledger[0]?.is_admin_override === true, 'override not logged as accepted commissioner trade');
});

await step('reset preserves accepted traded pick ownership', async () => {
  await rpc('reset_draft', { p_season_id: seasonId }, admin);
  const board = await picks(seasonId);
  const target = board.find((pick) => pick.id === tradedPickId);
  assert(target?.team_id === teamB, 'reset incorrectly restored traded pick to original team');
  assert(target?.original_team_id === teamA, 'original pick owner history changed');
  assert(target?.is_used === false && target?.is_skipped === false, 'reset did not clear outcome state');
});

await step('draft-order regeneration is blocked while pick ownership is traded', async () => {
  await expectError(
    rpc('set_draft_order', { p_season_id: seasonId, p_order: [teamB, teamA] }, admin),
    'traded picks have changed ownership',
  );
});

await step('skip pick is exact-slot and undo restores that exact slot', async () => {
  await rpc('set_draft_status', { p_season_id: seasonId, p_status: 'running' }, admin);
  const before = (await picks(seasonId)).find((pick) => !pick.is_used);
  const skipped = await rpc('skip_pick_for_slot', {
    p_season_id: seasonId,
    p_pick_id: before.id,
  }, admin);
  assert(skipped.id === before.id, 'skip resolved wrong slot');
  assert(skipped.is_used === true && skipped.is_skipped === true && skipped.player_id === null, 'skip state invalid');
  await rpc('undo_draft_action_for_slot', {
    p_season_id: seasonId,
    p_pick_id: before.id,
  }, admin);
  const restored = (await picks(seasonId)).find((pick) => pick.id === before.id);
  assert(restored.is_used === false && restored.is_skipped === false && restored.player_id === null, 'undo did not restore skipped slot');
});

await step('stale exact-slot intent is rejected after board advances', async () => {
  const before = (await picks(seasonId)).find((pick) => !pick.is_used);
  await rpc('skip_pick_for_slot', { p_season_id: seasonId, p_pick_id: before.id }, admin);
  await expectError(
    rpc('make_pick_for_slot', {
      p_season_id: seasonId,
      p_pick_id: before.id,
      p_player_id: playerB,
    }, admin),
    'Draft moved to another pick',
  );
  const after = await picks(seasonId);
  const next = after.find((pick) => !pick.is_used);
  assert(next && next.id !== before.id && next.player_id === null, 'stale intent affected the next slot');
  await rpc('undo_draft_action_for_slot', { p_season_id: seasonId, p_pick_id: before.id }, admin);
});

await step('draft a player through exact-slot contract then trade that roster row', async () => {
  const onClock = (await picks(seasonId)).find((pick) => !pick.is_used);
  const made = await rpc('make_pick_for_slot', {
    p_season_id: seasonId,
    p_pick_id: onClock.id,
    p_player_id: playerA,
  }, admin);
  const roster = await sql(`select id, team_id, draft_pick_id from public.rosters where season_id = '${seasonId}'::uuid and player_id = '${playerA}'::uuid`);
  assert(roster.length === 1 && roster[0].draft_pick_id === made.id, 'draft roster provenance missing');
  draftedRosterId = roster[0].id;
  const currentTeam = roster[0].team_id;
  const destination = currentTeam === teamA ? teamB : teamA;
  draftedPlayerTradeId = await rpc('admin_override_trade', {
    p_season_id: seasonId,
    p_from_team_id: currentTeam,
    p_to_team_id: destination,
    p_from_roster_ids: [draftedRosterId],
    p_from_pick_ids: [],
    p_to_roster_ids: [],
    p_to_pick_ids: [],
    p_note: 'E2E drafted player trade',
  }, admin);
  const moved = await sql(`select team_id, draft_pick_id from public.rosters where id = '${draftedRosterId}'::uuid`);
  assert(moved[0]?.team_id === destination && moved[0]?.draft_pick_id != null, 'traded drafted player lost draft provenance');
});

await step('reset refuses to tear apart accepted drafted-player trade', async () => {
  await expectError(
    rpc('reset_draft', { p_season_id: seasonId }, admin),
    'drafted player is part of an accepted trade',
  );
  const roster = await sql(`select id from public.rosters where id = '${draftedRosterId}'::uuid`);
  assert(roster.length === 1, 'blocked reset partially deleted roster state');
});

await step('commissioner reverses trade, then reset safely clears drafted player', async () => {
  await rpc('admin_reverse_trade', { p_trade_id: draftedPlayerTradeId, p_reason: 'E2E correction' }, admin);
  const reversed = await sql(`select status, reversed_at from public.trades where id = '${draftedPlayerTradeId}'::uuid`);
  assert(reversed[0]?.status === 'cancelled' && reversed[0]?.reversed_at, 'reversal was not logged');
  await rpc('reset_draft', { p_season_id: seasonId }, admin);
  const roster = await sql(`select id from public.rosters where id = '${draftedRosterId}'::uuid`);
  assert(roster.length === 0, 'reset did not remove draft-created roster row after safe reversal');
  const board = await picks(seasonId);
  assert(board.find((pick) => pick.id === tradedPickId)?.team_id === teamB, 'accepted pick trade did not survive second reset');
});

await step('trade overrides lock once draft status is complete', async () => {
  await rpc('set_draft_status', { p_season_id: seasonId, p_status: 'complete' }, admin);
  await expectError(
    rpc('admin_override_trade', {
      p_season_id: seasonId,
      p_from_team_id: teamA,
      p_to_team_id: teamB,
      p_from_roster_ids: [],
      p_from_pick_ids: [],
      p_to_roster_ids: [],
      p_to_pick_ids: [],
      p_note: 'should fail',
    }, admin),
    'locked after draft completion',
  );
});

await step('cleanup isolated season', async () => {
  await sql(`delete from public.seasons where id = '${seasonId}'::uuid`);
  const rows = await sql(`select count(*)::int as n from public.seasons where label = '${LABEL}'`);
  assert(rows[0].n === 0, 'test season still exists');
});

console.log(`\n=== ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===\n`);
process.exit(failures === 0 ? 0 : 1);
