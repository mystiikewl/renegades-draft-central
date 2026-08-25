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
 *   --stats-season   ESPN season year to pull stats for (default 2026 = 2025-26,
 *                    the most recent completed campaign);
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
const STATS_SEASON = flag('stats-season', '2026');
const BIO_ONLY = args.includes('--bio-only') || STATS_SEASON === 'none';
const LIMIT = parseInt(flag('limit', '0'), 10);

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://xruqdjonzxkzwsslzpdl.supabase.co';
// service_role key if available; else Management API via access token (this
// project's .env has no service_role key — same path as db-query.mjs).
let SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// sbp_ = Supabase personal access token (Management API), not a service_role
// JWT. Route through the MGMT shim instead of postgrest.
if (!SERVICE_KEY && process.env.SUPABASE_ACCESS_TOKEN) {
  SERVICE_KEY = 'MGMT';
}
if (SERVICE_KEY?.startsWith('sbp_')) {
  SERVICE_KEY = 'MGMT';
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ACCESS_TOKEN env var.');
  process.exit(1);
}
const supabase = SERVICE_KEY === 'MGMT'
  ? mgmtClient(process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl')
  : createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

// Minimal supabase-like shim over the Management API for the ops we use.
const mgmtFrom = (table) => ({});
function mgmtClient(projectRef) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const q = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`mgmt query: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  return {
    from(table) {
      const build = (clauses) => ({
        upsert: async (rawRows, { onConflict } = {}) => {
          const rows = Array.isArray(rawRows) ? rawRows : [rawRows];
          const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          const values = rows
            .map((row) => `(${cols.map((c) => sqlVal(row[c])).join(', ')})`)
            .join(',\n  ');
          await q(
            `insert into public.${table} (${cols.map((c) => `"${c}"`).join(', ')}) values ${values} ` +
              `on conflict (${onConflict}) do update set ${cols.filter((c) => c !== onConflict).map((c) => `"${c}" = excluded."${c}"`).join(', ')}`,
          );
          return { data: null, error: null };
        },
        select: () => build(clauses),
      });
      // simple chainable shim: .select('cols').eq(...).in(...)
      const api = {
        select: async (cols) => q(`select ${cols} from public.${table}`),
      };
      // filter helpers used by the script
      api.eq = (col, val) => api; // no-op for shim; select returns all rows, caller filters
      api.in = async (col, vals) => {
        const list = vals.map((v) => sqlVal(v)).join(',');
        return { data: await q(`select * from public.${table} where ${col} in (${list})`), error: null };
      };
      return new Proxy({}, {
        get: (_, prop) => {
          if (prop === 'upsert') {
            // awaitable directly (upsert(...) with no chain) AND supports the
            // .select(...).single() chain — plain-await upserts previously
            // returned a non-thenable and silently never ran.
            const up = (rows, opts) => ({
              select: async () => {
                await build().upsert(rows, opts);
                const data = await api.select('*');
                return { data, error: null };
              },
              then: (res, rej) => build().upsert(rows, opts).then(() => res({ data: null, error: null }), rej),
            });
            return up;
          }
          if (prop === 'then') return undefined;
          return (...args) => api;
        },
      });
    },
  };
}
function sqlVal(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

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
          experience: a.experience?.years ?? null,
        });
      }
    } catch (err) {
      console.warn(`  WARN roster ${team.abbreviation}: ${err.message}`);
    }
  }
  return [...athletes.values()];
}

// ---------------------------------------------------------------------
// 2. Per-player season stats (averages category), matched by season year
// ---------------------------------------------------------------------
// ESPN's averages feed uses camelCase display names; the app's stats JSONB
// uses the snake_case keys from CATEGORY_STAT_KEYS / parseStats.
const STAT_KEY_MAP = {
  gamesPlayed: 'games_played',
  gamesStarted: 'games_started',
  avgMinutes: 'minutes_per_game',
  avgFieldGoalsMade: 'field_goals_made',
  avgFieldGoalsAttempted: 'field_goals_attempted',
  fieldGoalPct: 'field_goal_percentage',
  avgThreePointFieldGoalsMade: 'three_pointers_made',
  avgThreePointFieldGoalsAttempted: 'three_pointers_attempted',
  threePointFieldGoalPct: 'three_point_percentage',
  avgFreeThrowsMade: 'free_throws_made',
  avgFreeThrowsAttempted: 'free_throws_attempted',
  freeThrowPct: 'free_throw_percentage',
  avgOffensiveRebounds: 'offensive_rebounds',
  avgDefensiveRebounds: 'defensive_rebounds',
  avgRebounds: 'total_rebounds',
  avgAssists: 'assists',
  avgBlocks: 'blocks',
  avgSteals: 'steals',
  avgFouls: 'fouls',
  avgTurnovers: 'turnovers',
  avgPoints: 'points',
};

async function fetchStats(espnId) {
  const res = await getJson(
    `${COMMON}/athletes/${espnId}/stats?season=${STATS_SEASON}&seasontype=2`
  );
  const averages = res.categories?.find((c) => c.name === 'averages');
  if (!averages?.names || !averages.statistics) return null;

  // ESPN season semantics: season=N & row year=N => the '(N-1)-N' campaign
  // (e.g. season=2026 -> yr 2026 -> '2025-26'). No fallback row: a mismatch
  // means the requested season simply has no data yet.
  const wantedYear = String(parseInt(STATS_SEASON, 10));
  const row = averages.statistics.find((s) => String(s.season?.year) === wantedYear);
  if (!row?.stats) return null;

  const stats = {};
  averages.names.forEach((name, i) => {
    const raw = row.stats[i];
    if (raw == null || raw === '--') return;
    // made-attempted cells like "7.9-18.9" -> both fields as numbers
    if (name.includes('-')) {
      const [a, b] = name.split('-');
      const set = (n, v) => {
        const key = STAT_KEY_MAP[n] ?? n;
        stats[key] = Number.isFinite(v) ? v : null;
      };
      const [va, vb] = raw.split('-').map(Number);
      set(a, va);
      set(b, vb);
    } else {
      const v = Number(raw);
      stats[STAT_KEY_MAP[name] ?? name] = Number.isFinite(v) ? v : null;
    }
  });

  // ROTO DD/TD live in the "miscellaneous" category (season totals); grab the
  // matching-year row from the same response.
  const misc = res.categories?.find((c) => c.name === 'miscellaneous');
  if (misc?.names && misc.statistics) {
    const miscRow = misc.statistics.find((s) => String(s.season?.year) === wantedYear);
    if (miscRow?.stats) {
      misc.names.forEach((name, i) => {
        if (name !== 'doubleDouble' && name !== 'tripleDouble') return;
        const v = Number(miscRow.stats[i]);
        if (Number.isFinite(v)) stats[name === 'doubleDouble' ? 'double_doubles' : 'triple_doubles'] = v;
      });
    }
  }

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
  const { data: seasonData, error: seasonErr } = await supabase
    .from('seasons')
    .upsert({ label: LEAGUE_SEASON, status: 'pre_draft' }, { onConflict: 'label' })
    .select('id, label, status');
  if (seasonErr) throw new Error(`seasons: ${seasonErr.message}`);
  const season = Array.isArray(seasonData)
    ? seasonData.find((s) => s.label === LEAGUE_SEASON) ?? seasonData[0]
    : seasonData;
  if (!season) throw new Error('season row missing after upsert');
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
  const idByEspn = new Map((inserted ?? []).filter(Boolean).map((p) => [p.espn_id, p.id]));

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
  console.error('Import failed:', err.stack ?? err.message);
  process.exit(1);
});
