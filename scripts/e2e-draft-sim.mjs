#!/usr/bin/env node

/**
 * Phase 5 — End-to-end draft simulation against the LIVE Supabase project,
 * on a throwaway season (label '2400-02'). Never touches 2025-26/2026-27.
 *
 * All draft mutations are called as real authenticated users via the anon-key
 * REST endpoint (exercises RLS + turn checks). SUPABASE_ACCESS_TOKEN
 * (Management API) is used ONLY for setup/teardown/verification SQL:
 * sizing the sim season's draft_settings, fetching ids, and hard-deleting
 * the sim season at the end.
 *
 * Env (put in .env or export):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN
 *   SIM_ADMIN_EMAIL / SIM_ADMIN_PASSWORD   — admin test user
 *   SIM_USER_EMAIL  / SIM_USER_PASSWORD    — non-admin test user who owns a team
 *
 * Usage: node scripts/e2e-draft-sim.mjs
 */

import { e2eHarness } from './lib/e2e.mjs';

const SIM_LABEL = '2400-02'; // format-valid throwaway label (seasons_label_format)
const h = e2eHarness(); // loads .env; exits if VITE_*/anon/ACCESS_TOKEN missing
const { step, assert, expectRpcError, login, rpc, sql } = h;

async function picks(seasonId) {
  return sql(`select id, pick_number, round, team_id, original_team_id, player_id, is_used
              from public.draft_picks where season_id = '${seasonId}'::uuid order by pick_number`);
}

// ---------------------------------------------------------------- main
const ADMIN_EMAIL = process.env.SIM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SIM_ADMIN_PASSWORD;
const USER_EMAIL = process.env.SIM_USER_EMAIL;
const USER_PASSWORD = process.env.SIM_USER_PASSWORD;

let admin, user; // access tokens
let seasonId, settings;
let userTeamId, otherTeamA, otherTeamB, otherTeamC;
let playerIds = [];
let madePicks = [];

console.log(`\n=== E2E draft sim — season label "${SIM_LABEL}" ===\n`);

// -- Setup ----------------------------------------------------------
await step('cleanup any leftover sim season + login test users', async () => {
  await sql(`delete from public.seasons where label = '${SIM_LABEL}'`);
  assert(ADMIN_EMAIL, 'SIM_ADMIN_EMAIL not set');
  admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (USER_EMAIL) user = await login(USER_EMAIL, USER_PASSWORD);
});

await step(`create throwaway season ${SIM_LABEL} (setup SQL, never steals is_active)`, async () => {
  // create_season is deliberately guarded now (label contract, no twin seasons,
  // no premature rollover while the live season is undrafted), so setup inserts
  // the throwaway season directly with is_active = false.
  const created = await sql(`insert into public.seasons (label, is_active) values ('${SIM_LABEL}', false) returning id`);
  const id = created[0].id;
  assert(typeof id === 'string' && id.length === 36, `expected uuid, got ${JSON.stringify(id)}`);
  await sql(`insert into public.draft_settings (season_id) values ('${id}'::uuid)`);
  seasonId = id;
});

await step('shrink sim settings to 4 teams x 2 rounds (Management API, setup only)', async () => {
  await sql(`update public.draft_settings set league_size = 4, roster_size = 2, keeper_limit = 0
             where season_id = '${seasonId}'::uuid`);
  const rows = await sql(`select league_size, roster_size, status, draft_order from public.draft_settings
                          where season_id = '${seasonId}'::uuid`);
  assert(rows.length === 1, 'draft_settings row missing');
  settings = rows[0];
  assert(settings.league_size === 4 && settings.roster_size === 2, 'settings not updated');
});

await step('pick 4 teams for the order (incl. the non-admin user’s team)', async () => {
  const teams = await sql('select id, name, owner_profile_id from public.teams order by name');
  assert(teams.length >= 4, `need 4 teams, found ${teams.length}`);
  if (user) {
    const mine = await sql(`select t.id from public.teams t
                            join public.profiles p on p.team_id = t.id
                            where p.email = '${USER_EMAIL.replace(/'/g, "''")}'`);
    assert(mine.length === 1, `SIM_USER does not own exactly one team (found ${mine.length})`);
    userTeamId = mine[0].id;
  } else {
    console.log('     (no SIM_USER creds — wrong-turn step will assert the generic turn check is unreachable without a team)');
  }
  const rest = teams.filter((t) => t.id !== userTeamId).slice(0, user ? 3 : 4);
  [otherTeamA, otherTeamB, otherTeamC] = rest.map((t) => t.id);
  const order = user ? [userTeamId, ...rest.map((t) => t.id)] : rest.map((t) => t.id);
  globalThis.__order = order;
});

await step('set_draft_order with 4 teams → 8 snake slots generated', async () => {
  await rpc('set_draft_order', { p_season_id: seasonId, p_order: globalThis.__order }, admin);
  const board = await picks(seasonId);
  assert(board.length === 8, `expected 8 slots, got ${board.length}`);
  // snake: round 2 reverses
  assert(board[0].team_id === globalThis.__order[0], 'pick 1 should go to slot-1 team');
  assert(board[4].team_id === globalThis.__order[3], 'pick 5 (round 2 slot 1) should reverse the snake');
  for (let i = 0; i < board.length; i++) {
    assert(board[i].pick_number === i + 1, `pick_number should be overall ${i + 1}`);
    assert(board[i].is_used === false && board[i].player_id === null, 'slots must start empty');
  }
});

await step('set_draft_status(running) — season must be live for make_pick', async () => {
  await rpc('set_draft_status', { p_season_id: seasonId, p_status: 'running' }, admin);
  const rows = await sql(`select ds.status, s.status as season_status from public.draft_settings ds
                          join public.seasons s on s.id = ds.season_id
                          where ds.season_id = '${seasonId}'::uuid`);
  assert(rows[0].status === 'running', `draft status = ${rows[0].status}`);
  assert(rows[0].season_status === 'live', `season status = ${rows[0].season_status} (make_pick requires 'live')`);
});

// -- Pick loop -------------------------------------------------------
await step('fetch player pool ids for picks', async () => {
  const rows = await sql('select id from public.players order by name limit 20');
  assert(rows.length >= 12, `need >=12 players, found ${rows.length}`);
  playerIds = rows.map((r) => r.id);
});

await step('pick #1 by the on-clock non-admin user (real turn enforcement)', async () => {
  if (!user) { console.log('     skipped — no SIM_USER creds'); return; }
  const made = await rpc('make_pick', { p_season_id: seasonId, p_player_id: playerIds[0] }, user);
  madePicks.push({ pick: 1, playerId: playerIds[0] });
  assert(made && made.pick_number === 1, `expected pick_number 1, got ${JSON.stringify(made)}`);
});

await step('picks #2–#5 by admin (snake order, overall numbers)', async () => {
  const start = madePicks.length; // 1 if user picked, else 0
  for (let i = start; i < 5; i++) {
    const playerId = playerIds[i];
    const made = await rpc('make_pick', { p_season_id: seasonId, p_player_id: playerId }, admin);
    assert(made.pick_number === i + 1, `expected pick_number ${i + 1}, got ${made.pick_number}`);
    madePicks.push({ pick: i + 1, playerId });
  }
  const board = await picks(seasonId);
  assert(board.filter((p) => p.is_used).length === 5, '5 picks used');
  for (const { pick, playerId } of madePicks) {
    assert(board[pick - 1].player_id === playerId, `board slot ${pick} wrong player`);
  }
});

await step('wrong-turn rejection: non-admin picks out of turn', async () => {
  const board = await picks(seasonId);
  const onClock = board.find((p) => !p.is_used).team_id;
  if (!user) { console.log('     skipped — no SIM_USER creds'); return; }
  if (onClock === userTeamId) throw new Error('test setup: user is on clock — adjust pick count');
  await expectRpcError(
    rpc('make_pick', { p_season_id: seasonId, p_player_id: playerIds[10] }, user),
    'Not your pick',
  );
});

await step('player-taken rejection: repeat a drafted player_id', async () => {
  await expectRpcError(
    rpc('make_pick', { p_season_id: seasonId, p_player_id: madePicks[0].playerId }, admin),
    'already on a roster',
  );
});

await step('undo_last_pick → slot cleared, team back on the clock', async () => {
  await rpc('undo_last_pick', { p_season_id: seasonId }, admin);
  const board = await picks(seasonId);
  const last = board[4];
  assert(last.is_used === false && last.player_id === null, 'pick 5 not cleared');
  const next = board.find((p) => !p.is_used);
  assert(next.pick_number === 5, `next pick should be 5, got ${next.pick_number}`);
  madePicks.pop();
});

await step('paused: make_pick rejected while paused', async () => {
  await rpc('set_draft_status', { p_season_id: seasonId, p_status: 'paused' }, admin);
  await expectRpcError(
    rpc('make_pick', { p_season_id: seasonId, p_player_id: playerIds[7] }, admin),
    'not running',
  );
});

await step('resume: pick succeeds after running again', async () => {
  await rpc('set_draft_status', { p_season_id: seasonId, p_status: 'running' }, admin);
  const made = await rpc('make_pick', { p_season_id: seasonId, p_player_id: playerIds[7] }, admin);
  assert(made.pick_number === 5, `expected pick_number 5, got ${made.pick_number}`);
  madePicks.push({ pick: 5, playerId: playerIds[7] });
});

await step('trade_pick between two teams → future slot swaps holder', async () => {
  const board = await picks(seasonId);
  const future = board.find((p) => !p.is_used);
  assert(future, 'no unused pick to trade');
  const to = future.team_id === globalThis.__order[1] ? globalThis.__order[2] : globalThis.__order[1];
  await rpc('trade_pick', { p_pick_id: future.id, p_to_team_id: to }, admin);
  const after = await picks(seasonId);
  const traded = after.find((p) => p.id === future.id);
  assert(traded.team_id === to, `holder not swapped (got ${traded.team_id})`);
  assert(traded.original_team_id === future.original_team_id, 'original_team_id must be preserved');
  console.log(`     pick ${future.pick_number} holder swapped; original_team_id preserved`);
});

await step('cleanup: hard-delete sim season, restore 2026-27 active', async () => {
  await sql(`delete from public.draft_picks where season_id = '${seasonId}'::uuid;
             delete from public.rosters where season_id = '${seasonId}'::uuid;
             delete from public.draft_settings where season_id = '${seasonId}'::uuid;
             delete from public.seasons where id = '${seasonId}'::uuid;
             update public.seasons set is_active = (label = '2026-27');`);
  const rows = await sql(`select count(*)::int as n from public.seasons where label = '${SIM_LABEL}'`);
  assert(rows[0].n === 0, 'sim season still exists');
  const active = await sql(`select label from public.seasons where is_active`);
  assert(active.length === 1 && active[0].label === '2026-27', `active season = ${JSON.stringify(active)}`);
});

console.log(`\n=== ${h.failures === 0 ? 'ALL PASS' : `${h.failures} FAILURE(S)`} ===\n`);
process.exit(h.failures === 0 ? 0 : 1);
