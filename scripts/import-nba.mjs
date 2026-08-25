#!/usr/bin/env node

/**
 * Phase 2: ESPN NBA import pipeline (2026 rebuild).
 *
 * Pulls player bios from ESPN team rosters and per-player season stats from
 * ESPN's common/v3 stats endpoint, then idempotently upserts into the new
 * schema: players (by espn_id) + player_seasons (by player+season).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-nba.mjs \
 *     [--league-season 2026-27] [--stats-season 2025] [--bio-only] [--limit N]
 *
 *   --league-season  label for the seasons row (default 2026-27)
 *   --stats-season   ESPN season year to pull stats for (default 2025 = 2025-26);
 *                    pass 'none' to skip stats entirely (same as --bio-only)
 *   --bio-only       import rosters/bios only, no stats requests
 *   --limit N        debug: only import N players
 */

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const LEAGUE_SEASON = flag('league-season', '2026-27');
const STATS_SEASON = flag('stats-season', '2025');
const BIO_ONLY = args.includes('--bio-only') || STATS_SEASON === 'none';
const LIMIT = parseInt(flag('limit', '0'), 10);

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xruqdjonzxkzwsslzpdl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const COMMON = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

async function getJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'renegades-draft-central/2.0' } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ---------------------------------------------------------------------
// 1. Player bios from all 30 team rosters
// ---------------------------------------------------------------------
async function fetchRosters() {
  const teamsRes = await getJson(`${SITE}/teams`);
  const teams = teamsRes.sports[0].leagues[0].teams
    .map((t) => t.team)
    .filter((t) => t.abbreviation);

  console.log(`Fetching rosters for ${teams.length} teams...`);
  const athletes = new Map(); // espn_id -> bio
  for (const team of teams) {
    try {
      const roster = await getJson(`${SITE}/teams/${team.abbreviation}/roster`);
      for (const a of roster.athletes ?? []) {
        if (!a.id || !a.fullName) continue;
        athletes.set(a.id, {
          espn_id: a.id,
          name: a.fullName,
          position: a.position?.abbreviation ?? null,
          nba_team: team.abbreviation,
          image_url: a.headshot?.href ?? null,
        });
      }
    } catch (err) {
      console.warn(`  WARN roster ${team.abbreviation}: ${err.message}`);
    }
  }
  return [...athletes.values()];
}

// ---------------------------------------------------------------------
// 2. Per-player season stats (averages category), matched by season label
// ---------------------------------------------------------------------
async function fetchStats(espnId) {
  const res = await getJson(
    `${COMMON}/athletes/${espnId}/stats?season=${STATS_SEASON}&seasontype=2`
  );
  const averages = res.categories?.find((c) => c.name === 'averages');
  if (!averages?.names || !averages.statistics) return null;

  // statistics rows are per season/team; find the one for the requested year
  const wantedYear = String(parseInt(STATS_SEASON, 10));
  const row =
    averages.statistics.find((s) => String(s.season?.year) === wantedYear) ??
    averages.statistics[averages.statistics.length - 1];

  if (!row?.stats) return null;
  const stats = {};
  averages.names.forEach((name, i) => {
    const raw = row.stats[i];
    if (raw == null || raw === '--') return;
    // made-attempted cells like "7.9-18.9" -> both fields as numbers
    if (name.includes('-')) {
      const [a, b] = name.split('-');
      const [va, vb] = raw.split('-').map(Number);
      stats[a] = Number.isFinite(va) ? va : null;
      stats[b] = Number.isFinite(vb) ? vb : null;
    } else {
      const v = Number(raw);
      stats[name] = Number.isFinite(v) ? v : null;
    }
  });
  stats.espn_season_label = row.season?.displayName ?? null;
  return stats;
}

// Bounded-concurrency map
async function mapConcurrent(items, fn, concurrency = 6) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i).catch((err) => ({ __error: err.message }));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  const bios = await fetchRosters();
  const players = LIMIT > 0 ? bios.slice(0, LIMIT) : bios;
  console.log(`Unique athletes: ${bios.length}${LIMIT ? ` (limit ${LIMIT})` : ''}`);

  // Ensure the season row exists
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .upsert({ label: LEAGUE_SEASON, status: 'pre_draft' }, { onConflict: 'label' })
    .select('id, label, status')
    .single();
  if (seasonErr) throw new Error(`seasons: ${seasonErr.message}`);
  console.log(`Season: ${season.label} -> ${season.id} (${season.status})`);

  // Upsert players by espn_id
  const { error: playerErr } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'espn_id' });
  if (playerErr) throw new Error(`players: ${playerErr.message}`);
  console.log(`players: ${players.length} upserted`);

  // Resolve espn_id -> uuid for player_seasons
  const { data: inserted, error: selErr } = await supabase
    .from('players')
    .select('id, espn_id')
    .in('espn_id', players.map((p) => p.espn_id));
  if (selErr) throw new Error(`players select: ${selErr.message}`);
  const idByEspn = new Map(inserted.map((p) => [p.espn_id, p.id]));

  if (BIO_ONLY) {
    console.log('--bio-only: skipping stats.');
    return;
  }

  // Fetch stats with bounded concurrency, then upsert in batches
  console.log(`Fetching ${STATS_SEASON} stats for ${players.length} players (concurrency 6)...`);
  const statRows = [];
  let done = 0;
  const statsResults = await mapConcurrent(players, async (p) => {
    const stats = await fetchStats(p.espn_id);
    done++;
    if (done % 50 === 0) console.log(`  stats: ${done}/${players.length}`);
    return { espn_id: p.espn_id, stats };
  });

  let withStats = 0;
  for (const r of statsResults) {
    if (!r?.stats || r.__error) continue;
    const uuid = idByEspn.get(r.espn_id);
    if (!uuid) continue;
    statRows.push({ player_id: uuid, season_id: season.id, stats: r.stats });
    withStats++;
  }

  const BATCH = 200;
  for (let i = 0; i < statRows.length; i += BATCH) {
    const { error } = await supabase
      .from('player_seasons')
      .upsert(statRows.slice(i, i + BATCH), { onConflict: 'player_id,season_id' });
    if (error) throw new Error(`player_seasons batch ${i}: ${error.message}`);
  }
  console.log(`player_seasons: ${withStats} upserted (of ${players.length} — zero-stat/rookie players have no row)`);
  console.log('\nDone. Re-running is safe (all upserts).');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
