/**
 * Supabase Management-API adapter — the org's one sanctioned SQL path
 * (`supabase db push` cannot create its ephemeral login role on this project,
 * so scripts go through api.supabase.com directly).
 *
 * Every script that talks to the database imports `mgmt` from here instead of
 * hand-rolling the fetch: auth, project ref and error shape live once.
 */

export const PROJECT_REF_DEFAULT = 'xruqdjonzxkzwsslzpdl';

/** Quote a SQL string literal. */
export const esc = (s) => String(s).replace(/'/g, "''");

export function mgmtClient({
  token = process.env.SUPABASE_ACCESS_TOKEN,
  projectRef = process.env.SUPABASE_PROJECT_REF ?? PROJECT_REF_DEFAULT,
} = {}) {
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN.');
  return {
    projectRef,
    /** Run SQL; returns parsed rows (empty array for DDL). */
    async query(sql) {
      const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (!r.ok) throw new Error(`query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return r.json();
    },
  };
}
