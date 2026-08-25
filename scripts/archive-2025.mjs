#!/usr/bin/env node

/**
 * Archive 2025 season data from Supabase (public schema) into archive/*.json.
 *
 * One-time script for the 2026 rebuild. Uses the service-role key from env
 * (SUPABASE_SERVICE_ROLE_KEY) — never hardcoded. Output files are the source
 * for scripts/import-2025-archive.ts when re-importing as an archived season.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/archive-2025.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'archive');

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xruqdjonzxkzwsslzpdl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Every public table from the 2025 schema, with FK-dependency ordering noted.
// Row counts are small (a league of friends), so full-table fetches are fine.
const TABLES = [
  'teams',
  'profiles',
  'players',
  'player_seasons',
  'draft_settings',
  'draft_picks',
  'keepers',
  'user_favourites',
  'draft_rollback_audit',
  'draft_rollback_snapshots',
];

async function fetchWithRetries(name, attempts = 8) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.from(name).select('*').limit(100000);
    if (!error) return { data };
    lastError = error;
    // The project was just unpaused — Cloudflare 521s surface as fetch failures/HTML bodies.
    // Retry with backoff before giving up. A genuine 404 (relation does not exist) is final.
    if (/relation .* does not exist|Does Not Exist/i.test(error.message ?? '')) break;
    const wait = 15000 * (i + 1);
    console.log(`  retry ${i + 1}/${attempts} for ${name} in ${wait / 1000}s (${String(error.message).slice(0, 60)})...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  return { error: lastError };
}

async function dumpTable(name) {
  const { data, error } = await fetchWithRetries(name);
  if (error) {
    // Table may not exist in this project — record that rather than failing the whole dump.
    console.warn(`WARN  ${name}: ${String(error.message).slice(0, 120)}`);
    return { table: name, exists: false };
  }
  const file = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`OK    ${name}: ${data.length} rows -> archive/${name}.json`);
  return { table: name, exists: true, rows: data.length };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  for (const table of TABLES) {
    results.push(await dumpTable(table));
  }

  // Manifest: what we archived, when, and from where.
  const manifest = {
    exported_at: new Date().toISOString(),
    project: SUPABASE_URL,
    schema: 'public (2025 season, pre-rebuild)',
    tables: results,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('\nManifest written to archive/manifest.json');
  console.log('NOTE: auth users are NOT in this dump — they live in the auth schema and are preserved in place by the rebuild.');

  const missing = results.filter((r) => !r.exists).map((r) => r.table);
  if (missing.length) {
    console.warn(`\nMissing/failed tables: ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Archive failed:', err);
  process.exit(1);
});
