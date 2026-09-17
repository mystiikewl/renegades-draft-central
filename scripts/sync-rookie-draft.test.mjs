import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('draft-only sync validates identities, fails before writes, and is idempotent', async () => {
  const cwd = process.cwd();
  const temp = await mkdtemp(join(tmpdir(), 'rookie-sync-'));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SUPABASE_ACCESS_TOKEN;
  const originalArgs = process.argv;
  let writes = 0;
  let mismatch = false;
  const player = { id: 'test-id', espn_id: '5142718', name: 'AJ Dybantsa', draft_display: null };
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.supabase.com/')) {
      const { query } = JSON.parse(options.body);
      if (query.startsWith('select')) return Response.json([{ ...player }]);
      assert.match(query, /^update players p set draft_display =/);
      assert.match(query, /p.id = v.id and p.espn_id = v.espn_id and p.experience = 0/);
      assert.doesNotMatch(query, /insert|draft_picks|player_seasons/);
      writes++;
      player.draft_display = '2026: Rd 1, Pk 1 (WSH)';
      return Response.json([{ id: player.id }]);
    }
    assert.match(String(url), /athletes\/5142718$/);
    return Response.json({ athlete: { id: mismatch ? 'wrong' : player.espn_id, displayDraft: '2026: Rd 1, Pk 1 (WSH)' } });
  };
  process.env.SUPABASE_ACCESS_TOKEN = 'test-only-not-a-real-token';
  process.argv = ['node', 'sync-rookie-draft.mjs', '--apply'];
  process.chdir(temp);
  try {
    await import('./sync-rookie-draft.mjs?test=first');
    assert.equal(writes, 1);
    await import('./sync-rookie-draft.mjs?test=again');
    assert.equal(writes, 1);
    mismatch = true;
    await assert.rejects(import('./sync-rookie-draft.mjs?test=bad'), /Incomplete fetch/);
    assert.equal(writes, 1);
  } finally {
    process.chdir(cwd);
    globalThis.fetch = originalFetch;
    process.argv = originalArgs;
    if (originalToken === undefined) delete process.env.SUPABASE_ACCESS_TOKEN;
    else process.env.SUPABASE_ACCESS_TOKEN = originalToken;
    await rm(temp, { recursive: true, force: true });
  }
});
