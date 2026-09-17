import assert from 'node:assert/strict';
import test from 'node:test';

import { importProjections } from './import-projections.mjs';

test('defaults to ESPN season 2026 for the 2026-27 league season', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      json: async () => ({ players: [] }),
    };
  });

  await importProjections({
    dryRun: true,
    espnS2: 'test-s2',
    espnSwid: 'test-swid',
    log: () => {},
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/seasons\/2026\//);
});

test('maps ESPN projection stat ids to the correct fantasy categories', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      players: [{
        player: {
          id: 5104157,
          eligibleSlots: [4],
          stats: [{
            statSourceId: 1,
            seasonId: 2026,
            averageStats: {
              0: 24.7,
              1: 4,
              2: 1.2,
              3: 3.9,
              6: 11.5,
              11: 3.5,
              13: 9,
              14: 19,
              15: 4,
              16: 5,
              17: 2.8,
              18: 8,
              19: 0.473,
              20: 0.823,
              21: 0.347,
              42: 71,
            },
            stats: { 0: 1755 },
          }],
        },
      }],
    }),
  }));
  const messages = [];

  const result = await importProjections({
    dryRun: true,
    espnS2: 'test-s2',
    espnSwid: 'test-swid',
    log: (...args) => messages.push(args),
  });

  const sample = messages.find(([message]) => message === '--dry-run: no writes. Sample:')?.[1];
  assert.equal(result.imported, 1);
  assert.deepEqual(sample, ['5104157', {
    points: 24.7,
    blocks: 4,
    steals: 1.2,
    assists: 3.9,
    total_rebounds: 11.5,
    turnovers: 3.5,
    field_goals_made: 9,
    field_goals_attempted: 19,
    free_throws_made: 4,
    free_throws_attempted: 5,
    three_pointers_made: 2.8,
    three_pointers_attempted: 8,
    field_goal_percentage: 0.473,
    free_throw_percentage: 0.823,
    three_point_percentage: 0.347,
    games_played: 71,
  }]);
});
