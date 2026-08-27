/**
 * Pure projection math for the Team Builder / rankings surfaces.
 * All functions operate on PlayerWithStats[] (see src/api/types.ts) using
 * the ESPN stat keys stored in player_seasons.stats JSONB.
 */
import type { PlayerWithStats } from '@/api/types';

export const CATEGORY_STAT_KEYS = {
  fgm: 'field_goals_made',
  fgPct: 'field_goal_percentage',
  ftPct: 'free_throw_percentage',
  tp: 'three_pointers_made',
  tpPct: 'three_point_percentage',
  reb: 'total_rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  to: 'turnovers',
  dd: 'double_doubles',
  td: 'triple_doubles',
  pts: 'points',
} as const;

export type Category = keyof typeof CATEGORY_STAT_KEYS;
/** The league's 13 ROTO categories, in standings order. */
export const LEAGUE_CATEGORIES = Object.keys(CATEGORY_STAT_KEYS) as Category[];
/** Categories where LOWER is better (counted negatively in rankings). */
export const INVERTED_CATEGORIES: ReadonlySet<Category> = new Set(['to']);
/** Percentage categories require volume-aware aggregation and ranking. */
export const PERCENTAGE_CATEGORIES: ReadonlySet<Category> = new Set(['fgPct', 'ftPct', 'tpPct']);
/** Counting cats stored as per-game averages — valued at season totals (avg x GP). */
const AVERAGE_CATEGORIES: ReadonlySet<Category> = new Set([
  'fgm', 'tp', 'reb', 'ast', 'stl', 'blk', 'to', 'pts',
]);

const PERCENTAGE_VOLUME_KEYS: Partial<
  Record<Category, { made: string; attempts: string }>
> = {
  fgPct: { made: 'field_goals_made', attempts: 'field_goals_attempted' },
  ftPct: { made: 'free_throws_made', attempts: 'free_throws_attempted' },
  tpPct: { made: 'three_pointers_made', attempts: 'three_pointers_attempted' },
};

/** Value basis: 'totals' (ROTO season totals) or 'averages' (per-game). */
export type Basis = 'totals' | 'averages';

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(value: unknown): number {
  const parsed = num(value);
  // The current feed stores fractions, but accepting 49.5 as 49.5% keeps the
  // projection layer resilient to alternate import sources.
  return parsed > 1.5 ? parsed / 100 : parsed;
}

function gamesPlayed(player: PlayerWithStats): number {
  return Math.max(0, num(player.player_seasons[0]?.stats?.games_played));
}

function percentageVolume(
  player: PlayerWithStats,
  cat: Category,
  basis: Basis = 'totals',
): number {
  const stats = player.player_seasons[0]?.stats;
  const keys = PERCENTAGE_VOLUME_KEYS[cat];
  if (!stats || !keys) return basis === 'totals' ? Math.max(1, gamesPlayed(player)) : 1;

  const pct = percentage(stats[CATEGORY_STAT_KEYS[cat]]);
  const directAttempts = num(stats[keys.attempts]);
  const made = num(stats[keys.made]);
  const attempts = directAttempts > 0 ? directAttempts : pct > 0 && made > 0 ? made / pct : 0;
  const perGameVolume = attempts > 0 ? attempts : 1;

  if (basis === 'averages') return perGameVolume;
  const games = gamesPlayed(player);
  return perGameVolume * (games > 0 ? games : 1);
}

export function playerValue(p: PlayerWithStats, cat: Category, basis: Basis = 'totals'): number {
  const stats = p.player_seasons[0]?.stats;
  const raw = stats?.[CATEGORY_STAT_KEYS[cat]];
  const value = PERCENTAGE_CATEGORIES.has(cat) ? percentage(raw) : num(raw);
  if (!Number.isFinite(value) || value === 0) return 0;

  if (AVERAGE_CATEGORIES.has(cat)) {
    if (basis === 'averages') return value;
    const games = gamesPlayed(p);
    return games > 0 ? value * games : 0;
  }

  if (cat === 'dd' || cat === 'td') {
    // DD/TD are stored as season totals; expose per-game rates in averages mode.
    if (basis === 'averages') {
      const games = gamesPlayed(p);
      return games > 0 ? value / games : 0;
    }
  }

  return value;
}

function percentagePoolBaseline(
  pool: PlayerWithStats[],
  cat: Category,
  basis: Basis = 'totals',
): number {
  let weightedMakes = 0;
  let volume = 0;
  for (const player of pool) {
    const weight = percentageVolume(player, cat, basis);
    const value = playerValue(player, cat, basis);
    if (weight <= 0 || value <= 0) continue;
    weightedMakes += value * weight;
    volume += weight;
  }
  return volume > 0 ? weightedMakes / volume : 0;
}

/**
 * Cumulative totals per category for a set of players.
 * Counting cats are summed; percentage cats are attempt-volume weighted.
 */
export function categoryTotals(
  players: PlayerWithStats[],
  cats: readonly Category[],
): Record<Category, number> {
  const out = {} as Record<Category, number>;
  for (const cat of cats) {
    if (!PERCENTAGE_CATEGORIES.has(cat)) {
      out[cat] = players.reduce((sum, player) => sum + playerValue(player, cat), 0);
      continue;
    }
    out[cat] = percentagePoolBaseline(players, cat, 'totals');
  }
  return out;
}

/** Average-team totals: what a team that drafted evenly from the pool would have. */
export function baseline(
  pool: PlayerWithStats[],
  teams: number,
  cats: readonly Category[],
): Record<Category, number> {
  const totals = categoryTotals(pool, cats);
  const out = {} as Record<Category, number>;
  for (const cat of cats) {
    // Percentages are rates, not additive totals. Dividing a .500 pool FG% by
    // ten teams would produce a nonsensical .050 target.
    out[cat] = PERCENTAGE_CATEGORIES.has(cat)
      ? totals[cat]
      : teams > 0
        ? totals[cat] / teams
        : 0;
  }
  return out;
}

/** Per-category z-scores across the pool: playerId -> z. */
export function zScores(
  pool: PlayerWithStats[],
  cat: Category,
  basis: Basis = 'totals',
): Map<string, number> {
  const poolPct = PERCENTAGE_CATEGORIES.has(cat)
    ? percentagePoolBaseline(pool, cat, basis)
    : 0;
  const values = pool.map((player) => {
    if (!PERCENTAGE_CATEGORIES.has(cat)) return playerValue(player, cat, basis);
    // Percentage fantasy value depends on both efficiency and shot volume.
    return (playerValue(player, cat, basis) - poolPct) * percentageVolume(player, cat, basis);
  });

  const count = values.length;
  const scores = new Map<string, number>();
  if (count === 0) return scores;
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation < 1e-9) {
    for (const player of pool) scores.set(player.id, 0);
    return scores;
  }

  const sign = INVERTED_CATEGORIES.has(cat) ? -1 : 1;
  for (let index = 0; index < count; index += 1) {
    scores.set(pool[index].id, (sign * (values[index] - mean)) / standardDeviation);
  }
  return scores;
}

export interface CategoryImpact {
  cat: Category;
  before: number;
  after: number;
  delta: number;
  /** true if adding the candidate moves this category across the baseline. */
  flipsVsBaseline: boolean;
}

/** Delta on each category from adding `candidate`, plus baseline crossings. */
export function impact(
  currentTeam: PlayerWithStats[],
  candidate: PlayerWithStats,
  base: Record<Category, number>,
  cats: readonly Category[],
): CategoryImpact[] {
  const beforeTotals = categoryTotals(currentTeam, cats);
  const afterTotals = categoryTotals([...currentTeam, candidate], cats);
  return cats.map((cat) => {
    const before = beforeTotals[cat];
    const after = afterTotals[cat];
    const beforeGap = before - base[cat];
    const afterGap = after - base[cat];
    return {
      cat,
      before,
      after,
      delta: after - before,
      flipsVsBaseline: beforeGap * afterGap < 0,
    };
  });
}
