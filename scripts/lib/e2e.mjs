/**
 * E2E harness — the shared runtime of the three live-project scripts
 * (e2e-draft-sim, e2e-keepers, e2e-trade-draft-integrity).
 *
 * Contract those scripts run under (CLAUDE.md): draft mutations happen ONLY
 * as real authenticated users through rpc() (exercising RLS + turn checks);
 * sql() is Management-API SQL reserved for setup/teardown/verification and
 * must never perform the mutation under test.
 *
 * Throwaway-season semantics live in the scripts, not here: this module owns
 * only transport (.env parsing, login/RPC/SQL), step bookkeeping and asserts.
 */

import fs from 'fs';
import path from 'path';
import { mgmtClient } from './supabase-mgmt.mjs';

/** Load .env from the cwd into process.env; exported vars always win. */
export function loadEnv() {
  const envFile = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const DEFAULT_REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ACCESS_TOKEN'];

export function e2eHarness({
  requiredEnv = DEFAULT_REQUIRED,
  env = process.env,
  mgmt, // injectable Management-API client ({ query }); defaults to the adapter
} = {}) {
  loadEnv();
  for (const k of requiredEnv) {
    if (!env[k]) {
      console.error(`FAIL env: missing ${k}`);
      process.exit(1);
      return; // real runs never get here; keeps first-miss semantics under test mocks
    }
  }
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  const sqlClient = mgmt ?? mgmtClient({ token: env.SUPABASE_ACCESS_TOKEN });

  let failures = 0;
  let stepNo = 0;
  function step(name, fn) {
    stepNo += 1;
    const label = `[${String(stepNo).padStart(2, '0')}] ${name}`;
    return Promise.resolve()
      .then(fn)
      .then(() => console.log(`PASS ${label}`))
      .catch((err) => { failures += 1; console.error(`FAIL ${label}\n     ${err.message}`); });
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  /** Resolve when the promise rejects with a message containing `needle`. */
  function expectRpcError(promise, needle) {
    return promise.then(
      () => { throw new Error(`expected RPC error containing "${needle}", got success`); },
      (err) => {
        if (!String(err.message).includes(needle)) {
          throw new Error(`expected RPC error containing "${needle}", got: ${err.message}`);
        }
        return err.message;
      },
    );
  }

  /** Password-grant login as a real user; returns the JWT for rpc(). */
  async function login(email, password) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`login failed for ${email}: ${body.msg ?? body.error_description ?? res.status}`);
    return body.access_token;
  }

  /** Call an RPC as an authenticated user (anon key + user JWT). Throws on RPC error. */
  async function rpc(fn, params, token) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const text = await res.text();
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch { body = text; } }
    if (!res.ok) {
      const msg = body && typeof body === 'object' ? (body.message ?? JSON.stringify(body)) : String(body);
      throw new Error(`${fn}: ${msg}`);
    }
    return body;
  }

  /** Management API SQL — setup/teardown/verification only, never draft mutations. */
  async function sql(query) {
    return sqlClient.query(query);
  }

  return {
    step,
    assert,
    expectRpcError,
    login,
    rpc,
    sql,
    get failures() { return failures; },
  };
}
