import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { e2eHarness, loadEnv } from './e2e.mjs';
import { mgmtClient } from './supabase-mgmt.mjs';

const ENV = {
  VITE_SUPABASE_URL: 'https://fake.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_ACCESS_TOKEN: 'mgmt-token',
};
const mgmtStub = { query: async (sql) => [{ n: 1, sql }] };

function mockFetch(t, handler) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  });
  return calls;
}

test('loadEnv fills unset vars from .env, never overrides exported ones', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-lib-'));
  fs.writeFileSync(
    path.join(dir, '.env'),
    ['E2E_LIB_PLAIN=fromfile', 'E2E_LIB_QUOTED="quoted value"', 'E2E_LIB_EXPORTED=fromfile', ''].join('\n'),
  );
  const prevCwd = process.cwd();
  const hadExported = 'E2E_LIB_EXPORTED' in process.env;
  const prevExported = process.env.E2E_LIB_EXPORTED;
  process.env.E2E_LIB_EXPORTED = 'fromshell';
  try {
    process.chdir(dir);
    loadEnv();
    assert.equal(process.env.E2E_LIB_PLAIN, 'fromfile');
    assert.equal(process.env.E2E_LIB_QUOTED, 'quoted value');
    assert.equal(process.env.E2E_LIB_EXPORTED, 'fromshell', 'exported var must win');
  } finally {
    process.chdir(prevCwd);
    for (const k of ['E2E_LIB_PLAIN', 'E2E_LIB_QUOTED']) delete process.env[k];
    if (hadExported) process.env.E2E_LIB_EXPORTED = prevExported;
    else delete process.env.E2E_LIB_EXPORTED;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('harness exits with FAIL env on the first missing required var', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (m) => errors.push(m));
  const exits = [];
  t.mock.method(process, 'exit', (code) => { exits.push(code); });
  const env = { VITE_SUPABASE_URL: 'https://fake.supabase.co' };

  e2eHarness({ env, mgmt: mgmtStub });
  assert.deepEqual(exits, [1]);
  assert.equal(errors[0], 'FAIL env: missing VITE_SUPABASE_ANON_KEY');
});

test('login posts password grant and returns the access token', async (t) => {
  const calls = mockFetch(t, () => ({ ok: true, json: async () => ({ access_token: 'tok-1' }) }));
  const { login } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  const token = await login('user@example.com', 'pw');
  assert.equal(token, 'tok-1');
  assert.equal(calls[0].url, 'https://fake.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(calls[0].init.headers.apikey, 'anon-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'user@example.com', password: 'pw' });
});

test('login failure surfaces the server message', async (t) => {
  mockFetch(t, () => ({ ok: false, json: async () => ({ msg: 'Invalid login credentials' }) }));
  const { login } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  await assert.rejects(login('user@example.com', 'pw'), /login failed for user@example\.com: Invalid login credentials/);
});

test('rpc posts anon key + user JWT and parses the JSON body', async (t) => {
  const calls = mockFetch(t, () => ({ ok: true, text: async () => JSON.stringify({ pick_number: 3 }) }));
  const { rpc } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  const out = await rpc('make_pick', { p_season_id: 's' }, 'jwt-1');
  assert.deepEqual(out, { pick_number: 3 });
  assert.equal(calls[0].url, 'https://fake.supabase.co/rest/v1/rpc/make_pick');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer jwt-1');
  assert.equal(calls[0].init.headers.apikey, 'anon-key');
});

test('rpc error throws with the RPC name and server message', async (t) => {
  mockFetch(t, () => ({ ok: false, text: async () => JSON.stringify({ message: 'Not your pick' }) }));
  const { rpc } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  await assert.rejects(rpc('make_pick', {}, 'jwt-1'), (err) => err.message === 'make_pick: Not your pick');
});

test('rpc passes non-JSON bodies through as text', async (t) => {
  mockFetch(t, () => ({ ok: true, text: async () => 'raw text' }));
  const { rpc } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  assert.equal(await rpc('some_fn', {}, 'jwt-1'), 'raw text');
});

test('sql runs Management-API SQL with the project ref + token', async (t) => {
  const calls = mockFetch(t, () => ({ ok: true, json: async () => [{ id: 'a' }] }));
  const { sql } = e2eHarness({
    env: ENV,
    mgmt: mgmtClient({ token: ENV.SUPABASE_ACCESS_TOKEN, projectRef: 'ref-1' }),
  });

  const rows = await sql('select 1');
  assert.deepEqual(rows, [{ id: 'a' }]);
  assert.equal(calls[0].url, 'https://api.supabase.com/v1/projects/ref-1/database/query');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer mgmt-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: 'select 1' });
});

test('step logs PASS, keeps going on failure, and counts failures', async (t) => {
  const logs = [];
  const errors = [];
  t.mock.method(console, 'log', (m) => logs.push(m));
  t.mock.method(console, 'error', (m) => errors.push(m));
  const h = e2eHarness({ env: ENV, mgmt: mgmtStub });

  await h.step('first', async () => {});
  await h.step('second', async () => { throw new Error('boom'); });
  await h.step('third', async () => {});

  assert.equal(h.failures, 1);
  assert.deepEqual(logs, ['PASS [01] first', 'PASS [03] third']);
  assert.equal(errors[0], 'FAIL [02] second\n     boom');
});

test('expectRpcError passes only when the needle is in the message', async () => {
  const { expectRpcError } = e2eHarness({ env: ENV, mgmt: mgmtStub });

  const msg = await expectRpcError(Promise.reject(new Error('Not your pick')), 'Not your pick');
  assert.equal(msg, 'Not your pick');
  await assert.rejects(expectRpcError(Promise.resolve({}), 'Not your pick'), /got success/);
  await assert.rejects(
    expectRpcError(Promise.reject(new Error('other')), 'Not your pick'),
    /expected RPC error containing "Not your pick", got: other/,
  );
});
