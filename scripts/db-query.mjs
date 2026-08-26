#!/usr/bin/env node

/**
 * Execute a SQL file against the linked Supabase project via the
 * Management API (works where `supabase db push` cannot create its
 * ephemeral login role).
 *
 * Usage: node scripts/db-query.mjs path/to/file.sql [--show]
 * Env:   SUPABASE_ACCESS_TOKEN (required), SUPABASE_PROJECT_REF (default xruqdjonzxkzwsslzpdl)
 */

import fs from 'fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';
const [file, ...flags] = process.argv.slice(2);

if (!token || !file) {
  console.error('Usage: SUPABASE_ACCESS_TOKEN=... node scripts/db-query.mjs <file.sql> [--show]');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`);
  console.error(body.slice(0, 3000));
  process.exit(1);
}
// Successful DDL returns empty array; SELECTs return rows.
try {
  const rows = JSON.parse(body);
  if (Array.isArray(rows) && rows.length) {
    console.log(JSON.stringify(rows, null, 2).slice(0, 5000));
  } else {
    console.log(`OK (${file})`);
  }
} catch {
  if (flags.includes('--show')) console.log(body.slice(0, 3000));
  else console.log(`OK (${file})`);
}
