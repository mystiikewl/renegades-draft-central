import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { syncLeague } from './import-league.mjs';

const espnTeam = (id, name, extra = {}) => ({
  id,
  name,
  abbrev: `T${id}`,
  primaryOwner: null,
  logo: null,
  roster: { entries: [] },
  ...extra,
});

/**
 * Mock both transports syncLeague talks to: the ESPN league API and the
 * Supabase Management API. `mgmtRows` maps a SQL substring -> rows; every
 * mgmt query is recorded in `queries` for write-path assertions.
 */
function mockTransports(t, { league, upcomingLeague, mgmtRows = {} }) {
  const queries = [];
  const snapshot = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const u = String(url);
    if (u.includes('lm-api-reads.fantasy.espn.com')) {
      // The sync reads the target season plus season+1 (upcoming keepers).
      const isUpcoming = /\/seasons\/\d+\//.exec(u) && !u.includes('/seasons/2027/');
      return { ok: true, json: async () => (isUpcoming ? (upcomingLeague ?? { name: 'U', members: [], teams: [] }) : league) };
    }
    if (u.includes('api.supabase.com')) {
      const { query } = JSON.parse(init.body ?? '{}');
      queries.push(query);
      const hit = Object.entries(mgmtRows).find(([needle]) => query.includes(needle));
      return { ok: true, json: async () => (hit ? hit[1] : []) };
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
  t.mock.method(fs, 'writeFileSync', (file, contents) => snapshot.push({ file, contents }));
  return { queries, snapshot };
}

const run = (overrides = {}) => syncLeague({
  espnS2: 's2',
  espnSwid: 'swid',
  mgmtToken: 'token',
  log: () => {},
  ...overrides,
});

test('dry-run builds the match plan without issuing writes', async (t) => {
  const { queries, snapshot } = mockTransports(t, {
    league: { name: 'L', members: [], teams: [espnTeam(7, 'Alpha')] },
    mgmtRows: { 'select id, name, espn_team_id from public.teams': [{ id: 'db-1', name: 'Alpha', espn_team_id: 7 }] },
  });

  const result = await run({ season: 2027, dryRun: true });

  assert.deepEqual(result, { teamsMatched: 1, teamsUpdated: 0, rosterUpserted: 0, playersResolved: 0, playersSkipped: 0 });
  assert.equal(queries.length, 1, 'dry-run must only read teams');
  assert.match(queries[0], /^select id, name, espn_team_id from public\.teams/);
  assert.equal(snapshot.length, 1, 'snapshot still written for the record');
});

test('unmatched ESPN team aborts — insert is forbidden', async (t) => {
  mockTransports(t, {
    league: { name: 'L', members: [], teams: [espnTeam(99, 'Stranger')] },
    mgmtRows: { 'from public.teams': [{ id: 'db-1', name: 'Alpha', espn_team_id: 7 }] },
  });

  await assert.rejects(run({ dryRun: true }), /1 ESPN team\(s\) have no matching DB row\. Insert is forbidden/);
});

test('LEGACY_NAME_MAP reconciles a renamed hand-typed DB row', async (t) => {
  mockTransports(t, {
    league: { name: 'L', members: [], teams: [espnTeam(10, 'Totally Renamed')] },
    mgmtRows: { 'from public.teams': [{ id: 'db-legacy', name: 'Innocent Until Proven Giddey', espn_team_id: null }] },
  });

  const result = await run({ dryRun: true });

  assert.equal(result.teamsMatched, 1, 'legacy alias must bridge the name change');
});

test('roster mirror goes read-only once keepers are finalized', async (t) => {
  const { queries } = mockTransports(t, {
    league: { name: 'L', members: [], teams: [espnTeam(7, 'Alpha')] },
    mgmtRows: {
      'select id, name, espn_team_id from public.teams': [{ id: 'db-1', name: 'Alpha', espn_team_id: 7 }],
      'from public.seasons where label': [{ id: 'season-1' }],
      'where espn_team_id is not null': [{ id: 'db-1', espn_team_id: 7 }],
      'keepers_finalized_at': [{ keepers_finalized_at: '2026-09-01T00:00:00Z' }],
    },
  });

  const result = await run({ season: 2027 });

  assert.deepEqual(result, { teamsMatched: 1, teamsUpdated: 1, rosterUpserted: 0, playersResolved: 0, playersSkipped: 0 });
  assert.ok(queries.some((q) => q.startsWith('update public.teams')), 'team updates still applied');
  assert.ok(!queries.some((q) => q.includes('insert into public.rosters')), 'finalized keepers must gate roster writes');
});

test('roster mirror upserts non-keeper rows and protects tagged keepers', async (t) => {
  const { queries } = mockTransports(t, {
    league: {
      name: 'L',
      members: [],
      teams: [espnTeam(7, 'Alpha', {
        roster: {
          entries: [
            { playerPoolEntry: { player: { id: 111 } }, acquisitionType: 'DRAFT', acquisitionDate: '1700000000000' },
            { playerPoolEntry: { player: { id: 222 } }, acquisitionType: 'KEEPER', acquisitionDate: null },
          ],
        },
      })],
    },
    mgmtRows: {
      'select id, name, espn_team_id from public.teams': [{ id: 'db-1', name: 'Alpha', espn_team_id: 7 }],
      'from public.seasons where label': [{ id: 'season-1' }],
      'where espn_team_id is not null': [{ id: 'db-1', espn_team_id: 7 }],
      'keepers_finalized_at': [{ keepers_finalized_at: null }],
      "acquisition = 'keeper'": [{ player_id: 'uuid-222' }],
      'from public.players where espn_id in': [
        { id: 'uuid-111', espn_id: '111' },
        { id: 'uuid-222', espn_id: '222' },
      ],
    },
  });

  const result = await run({ season: 2027 });

  assert.deepEqual(result, { teamsMatched: 1, teamsUpdated: 1, rosterUpserted: 1, playersResolved: 2, playersSkipped: 0 });
  const insert = queries.find((q) => q.includes('insert into public.rosters'));
  assert.ok(insert, 'draft entry upserted');
  assert.match(insert, /'uuid-111'/);
  assert.doesNotMatch(insert, /'uuid-222'/, 'tagged keeper row must be protected from overwrite');
});

test('ESPN keeper selections win: kept players tagged keeper, stale DB tags overwritten', async (t) => {
  const { queries } = mockTransports(t, {
    league: {
      name: 'L',
      members: [],
      teams: [espnTeam(7, 'Alpha', {
        roster: {
          entries: [
            { playerPoolEntry: { player: { id: 111 } }, acquisitionType: 'DRAFT' },
            { playerPoolEntry: { player: { id: 222 } }, acquisitionType: 'TRADE' }, // stale DB tag says keeper
          ],
        },
      })],
    },
    // Upcoming season rosters = keeper selections: 111 kept by Alpha, 222 NOT kept.
    upcomingLeague: {
      name: 'U',
      members: [],
      teams: [espnTeam(7, 'Alpha', {
        roster: { entries: [{ playerPoolEntry: { player: { id: 111 } } }] },
      })],
    },
    mgmtRows: {
      'select id, name, espn_team_id from public.teams': [{ id: 'db-1', name: 'Alpha', espn_team_id: 7 }],
      'from public.seasons where label': [{ id: 'season-1' }],
      'where espn_team_id is not null': [{ id: 'db-1', espn_team_id: 7 }],
      'keepers_finalized_at': [{ keepers_finalized_at: null }],
      "acquisition = 'keeper'": [{ player_id: 'uuid-222' }],
      'from public.players where espn_id in': [
        { id: 'uuid-111', espn_id: '111' },
        { id: 'uuid-222', espn_id: '222' },
      ],
    },
  });

  const result = await run({ season: 2027 });

  assert.equal(result.rosterUpserted, 2, 'both rows synced — nothing protected once ESPN speaks');
  const insert = queries.find((q) => q.includes('insert into public.rosters'));
  assert.ok(insert);
  assert.match(insert, /\('season-1', 'db-1', 'uuid-111', 'keeper'/, 'ESPN-kept player tagged keeper');
  assert.match(insert, /\('season-1', 'db-1', 'uuid-222', 'trade'/, 'stale DB keeper tag demoted to ESPN acquisition');
});
