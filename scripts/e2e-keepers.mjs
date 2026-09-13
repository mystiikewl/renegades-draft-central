#!/usr/bin/env node

/**
 * E2E — keeper marking against the LIVE Supabase project, using the shadow
 * guest team ("E2E Shadow Squad", is_shadow=true, in no draft). Never touches
 * real teams' data and leaves no rows behind (final step asserts zero).
 *
 * Exercises the exact RPCs the UI calls:
 *   assign_keeper / remove_keeper — owner happy path, ownership rejection,
 *   already-rostered rejection, keeper_limit enforcement, admin override.
 *
 * Env (.env): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *   SUPABASE_ACCESS_TOKEN, SIM_ADMIN_EMAIL/PASSWORD, SIM_USER_EMAIL/PASSWORD
 *
 * Usage: node scripts/e2e-keepers.mjs
 */

import { e2eHarness } from './lib/e2e.mjs';

const SEASON_LABEL = '2026-27';
const h = e2eHarness({
  requiredEnv: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ACCESS_TOKEN',
    'SIM_ADMIN_EMAIL', 'SIM_ADMIN_PASSWORD', 'SIM_USER_EMAIL', 'SIM_USER_PASSWORD'],
});
const { step, assert, expectRpcError, login, rpc, sql } = h;

async function shadowKeeperRows(seasonId, shadowTeamId) {
  return sql(`select player_id, acquisition from public.rosters
              where season_id = '${seasonId}'::uuid and team_id = '${shadowTeamId}'::uuid
                and acquisition = 'keeper'`);
}

let admin, user;
let seasonId, shadowTeamId, otherTeamId;
let players = [];

console.log('\n=== E2E keepers — shadow team, active 2026-27 ===\n');

await step('login users + resolve season/shadow team/free players', async () => {
  admin = await login(process.env.SIM_ADMIN_EMAIL, process.env.SIM_ADMIN_PASSWORD);
  user = await login(process.env.SIM_USER_EMAIL, process.env.SIM_USER_PASSWORD);

  const seasons = await sql(`select id from public.seasons where label = '${SEASON_LABEL}' and is_active`);
  assert(seasons.length === 1, `expected 1 active '${SEASON_LABEL}' season`);
  seasonId = seasons[0].id;

  const teams = await sql(`select id, name, owner_profile_id from public.teams where is_shadow`);
  assert(teams.length === 1, `expected 1 shadow team, got ${teams.length}`);
  shadowTeamId = teams[0].id;
  assert(teams[0].owner_profile_id, 'shadow team has no owner');

  const others = await sql(`select id from public.teams where not is_shadow order by name limit 1`);
  assert(others.length === 1, 'no non-shadow team found');
  otherTeamId = others[0].id;

  players = await sql(`select id from public.players
                       where id not in (select player_id from public.rosters where season_id = '${seasonId}'::uuid)
                       order by id limit 12`);
  assert(players.length >= 11, `need 12 free players for the limit test, got ${players.length}`);
});

await step('owner assigns a keeper to own team', async () => {
  await rpc('assign_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[0].id }, user);
  const rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 1 && rows[0].player_id === players[0].id, 'keeper row not persisted');
});

await step('owner CANNOT assign a keeper to another team', async () => {
  await expectRpcError(
    rpc('assign_keeper', { p_season_id: seasonId, p_team_id: otherTeamId, p_player_id: players[1].id }, user),
    'your own team',
  );
});

await step('assigning an already-rostered player is rejected', async () => {
  await expectRpcError(
    rpc('assign_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[0].id }, user),
    'already on a roster',
  );
});

await step('keeper_limit enforced: 9 ok, 10th rejected', async () => {
  // players[0] is already kept; fill slots 2..9
  for (const p of players.slice(1, 9)) {
    await rpc('assign_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: p.id }, user);
  }
  let rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 9, `expected 9 keepers, got ${rows.length}`);
  await expectRpcError(
    rpc('assign_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[9].id }, user),
    'Keeper limit',
  );
  rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 9, 'rejected assign must not create a row');
});

await step('owner removes a keeper', async () => {
  await rpc('remove_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[0].id }, user);
  const rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 8 && !rows.some((r) => r.player_id === players[0].id), 'remove_keeper did not delete');
});

await step('admin override: admin assigns/removes for the shadow team', async () => {
  await rpc('assign_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[9].id }, admin);
  let rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 9, 'admin assign failed');
  await rpc('remove_keeper', { p_season_id: seasonId, p_team_id: shadowTeamId, p_player_id: players[9].id }, admin);
  rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 8, 'admin remove failed');
});

await step('TEARDOWN: zero keeper rows remain for the shadow team', async () => {
  await sql(`delete from public.rosters
             where season_id = '${seasonId}'::uuid and team_id = '${shadowTeamId}'::uuid
               and acquisition = 'keeper'`);
  const rows = await shadowKeeperRows(seasonId, shadowTeamId);
  assert(rows.length === 0, 'cleanup left rows behind');
});

console.log(h.failures === 0 ? '\nALL KEEPER E2E STEPS PASS\n' : `\n${h.failures} STEP(S) FAILED\n`);
process.exit(h.failures === 0 ? 0 : 1);
