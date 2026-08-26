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

// ESPN fantasy slot ids -> our position tokens. 5/6 are combined G/F; 7+ are
// UTIL/IR/bench slots with no position meaning.
const SLOT_POSITIONS = { 0: 'PG', 1: 'SG', 2: 'SF', 3: 'PF', 4: 'C' };

function slotsToPosition(eligibleSlots) {
  const ids = (eligibleSlots ?? []).map(Number);
  const positions = Object.entries(SLOT_POSITIONS)
    .filter(([id]) => ids.includes(Number(id)))
    .map(([, pos]) => pos);
  if (!positions.length) {
    if (ids.includes(5)) return 'PG,SG'; // listed only as G
    if (ids.includes(6)) return 'SF,PF'; // listed only as F
    return null;
  }
  return positions.join(',');
}

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
  const esc = (s) => String(s).replace(/'/g, "''");

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
  // The players filter must go in the X-Fantasy-Filter header (the query-param
  // form silently ignores `offset` and returns the same 50 players forever),
  // and ESPN requires an explicit sort when a limit/offset is given.
  // A seen-ID guard stops paging even if ESPN regresses to repeated pages.
  const PAGE = 50;
  const allPlayers = [];
  const seen = new Set();
  for (let offset = 0; ; offset += PAGE) {
    const filter = JSON.stringify({
      players: { limit: PAGE, offset, sortStatId: { sortPriority: 1, sortAsc: true, value: 0 } },
    });
    const res = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/201` +
        `?view=kona_player_info`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Fantasy-Filter': filter,
          Cookie: `espn_s2=${espnS2}; SWID=${espnSwid};`,
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!res.ok) throw new Error(`ESPN API ${res.status} (offset ${offset}): ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    if (page.messages?.length) throw new Error(`ESPN filter rejected (offset ${offset}): ${page.messages.join('; ')}`);
    const players = page.players ?? [];
    const fresh = players.filter((w) => w.player?.id && !seen.has(String(w.player.id)));
    for (const w of fresh) seen.add(String(w.player.id));
    allPlayers.push(...fresh);
    log(`  fetched offset ${offset}: ${players.length} players, ${fresh.length} new (total ${allPlayers.length})`);
    if (players.length < PAGE || fresh.length === 0) break;
  }

  // Extract statSourceId=1 rows for the target ESPN seasonId, plus the richer
  // PG/SG/SF/PF/C eligibility from the same feed (roster bios only give G/F/C).
  const projections = new Map(); // espn_id -> stats
  const positions = new Map(); // espn_id -> 'PG,SG,...'
  for (const w of allPlayers) {
    const p = w.player;
    if (!p?.id) continue;
    const pos = slotsToPosition(p.eligibleSlots);
    if (pos) positions.set(String(p.id), pos);
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

  log(`ESPN players scanned: ${allPlayers.length}; with ${season} projections: ${projections.size}; with positions: ${positions.size}`);

  // Position backfill works even before ESPN publishes projections, so run it
  // whenever we have mgmt access (also in dry-run? no — keep dry-run read-free).
  if (!dryRun && positions.size > 0) {
    let updated = 0;
    const posIds = [...positions.keys()];
    for (let i = 0; i < posIds.length; i += 200) {
      const chunk = posIds.slice(i, i + 200);
      const list = chunk.map((id) => `'${esc(id)}'`).join(',');
      const rows = await applyQuery(
        `update public.players set position = v.pos::text ` +
          `from (values ${chunk.map((id) => `('${esc(id)}', '${esc(positions.get(id))}')`).join(',')}) as v(espn_id, pos) ` +
          `where public.players.espn_id = v.espn_id and (public.players.position is distinct from v.pos::text) ` +
          `returning id`,
      );
      updated += rows?.length ?? 0;
    }
    log(`Positions updated: ${updated} (of ${positions.size} eligible).`);
  }

  if (projections.size === 0) {
    log('No projections published yet by ESPN. Re-run once fantasy basketball opens.');
    return { scanned: allPlayers.length, imported: 0 };
  }
  if (dryRun) {
    log('--dry-run: no writes. Sample:', [...projections.entries()][0]);
    return { scanned: allPlayers.length, imported: projections.size };
  }

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
