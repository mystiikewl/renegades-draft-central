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
