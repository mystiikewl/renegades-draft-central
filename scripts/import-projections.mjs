#!/usr/bin/env node

/**
 * Import ESPN fantasy per-player projections into public.projections.
 *
 * ESPN publishes projections as stats rows with statSourceId=1 for the
 * upcoming fantasy season (e.g. seasonId 2027 = "2026-27"). Until ESPN
 * publishes them the API returns zero rows — this script exits cleanly
 * with a count of 0; just re-run after ESPN's fantasy basketball launch.
 *
 * Usage:
 *   node scripts/import-projections.mjs [--season 2027] [--dry-run]
 * Env: ESPN_S2, ESPN_SWID, SUPABASE_ACCESS_TOKEN (unless --dry-run)
 */

import { pathToFileURL } from 'url';

const PROJECT_REF_DEFAULT = 'xruqdjonzxkzwsslzpdl';

// ESPN stat key -> our player_seasons.stats JSONB keys (per-game averages).
const STAT_KEYS = {
  3: 'field_goals_made', 4: 'field_goals_attempted', 5: 'three_pointers_made',
  6: 'three_pointers_attempted', 8: 'free_throws_made', 9: 'free_throws_attempted',
  10: 'field_goal_percentage', 11: 'rebounds_offensive', 12: 'rebounds_defensive',
  13: 'total_rebounds', 14: 'assists', 15: 'steals', 16: 'blocks', 17: 'turnovers',
  18: 'points', 19: 'field_goal_percentage', 20: 'free_throw_percentage',
  21: 'three_point_percentage',
};

export async function importProjections({
  season = 2027,
  dryRun = false,
  espnS2 = process.env.ESPN_S2,
  espnSwid = process.env.ESPN_SWID,
  mgmtToken = process.env.SUPABASE_ACCESS_TOKEN,
  projectRef = process.env.SUPABASE_PROJECT_REF ?? PROJECT_REF_DEFAULT,
  log = console.log,
} = {}) {
  if (!espnS2 || !espnSwid) throw new Error('Missing ESPN_S2 / ESPN_SWID env vars.');
  if (!dryRun && !mgmtToken) throw new Error('Missing SUPABASE_ACCESS_TOKEN.');

  const applyQuery = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };

  // Page through the full player universe via kona_player_info.
  // ESPN caps this view at 50 players per page regardless of the requested limit.
  const PAGE = 50;
  const allPlayers = [];
  for (let offset = 0; ; offset += PAGE) {
    const filter = encodeURIComponent(
      JSON.stringify({ filter: { slotCategoryIds: [0] }, players: { limit: PAGE, offset } }),
    );
    const res = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/201` +
        `?view=kona_player_info&players=${filter}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: `espn_s2=${espnS2}; SWID=${espnSwid};` } },
    );
    if (!res.ok) throw new Error(`ESPN API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    const players = page.players ?? [];
    allPlayers.push(...players);
    if (players.length < PAGE) break;
  }

  // Extract statSourceId=1 rows for the target ESPN seasonId.
  const projections = new Map(); // espn_id -> stats
  for (const w of allPlayers) {
    const p = w.player;
    if (!p?.id) continue;
    const row = (p.stats ?? []).find((s) => s.statSourceId === 1 && s.seasonId === Number(season));
    if (!row || !row.stats || Object.keys(row.stats).length === 0) continue;
    // Prefer averageStats when present (per-game), fall back to totals row.
    const src = Object.keys(row.averageStats ?? {}).length > 0 ? row.averageStats : row.stats;
    const mapped = {};
    for (const [k, v] of Object.entries(src)) {
      const key = STAT_KEYS[Number(k)];
      if (key && typeof v === 'number') mapped[key] = v;
    }
    if (Object.keys(mapped).length > 0) projections.set(String(p.id), mapped);
  }

  log(`ESPN players scanned: ${allPlayers.length}; with ${season} projections: ${projections.size}`);
  if (projections.size === 0) {
    log('No projections published yet by ESPN. Re-run once fantasy basketball opens.');
    return { scanned: allPlayers.length, imported: 0 };
  }
  if (dryRun) {
    log('--dry-run: no writes. Sample:', [...projections.entries()][0]);
    return { scanned: allPlayers.length, imported: projections.size };
  }

  const esc = (s) => String(s).replace(/'/g, "''");
  const seasonLabel = `${season}-${String((Number(season) + 1) % 100).padStart(2, '0')}`;
  const seasonRows = await applyQuery(`select id from public.seasons where label = '${seasonLabel}'`);
  if (!seasonRows.length) throw new Error(`No seasons row for ${seasonLabel}.`);
  const seasonId = seasonRows[0].id;

  const espnIds = [...projections.keys()];
  let imported = 0;
  for (let i = 0; i < espnIds.length; i += 200) {
    const chunk = espnIds.slice(i, i + 200);
    const list = chunk.map((id) => `'${esc(id)}'`).join(',');
    const players = await applyQuery(
      `select id, espn_id from public.players where espn_id in (${list})`,
    );
    for (const p of players ?? []) {
      const stats = projections.get(p.espn_id);
      if (!stats) continue;
      await applyQuery(
        `insert into public.projections (season_id, player_id, source, stats) values ('${seasonId}', '${p.id}', 'espn', '${esc(JSON.stringify(stats))}'::jsonb) ` +
          `on conflict (season_id, player_id) do update set source = 'espn', stats = excluded.stats, updated_at = now()`,
      );
      imported++;
    }
  }
  log(`Upserted ${imported} projection rows into public.projections.`);
  return { scanned: allPlayers.length, imported };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  try {
    const result = await importProjections({ season: flag('season', '2027'), dryRun: args.includes('--dry-run') });
    console.log('Done:', result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
