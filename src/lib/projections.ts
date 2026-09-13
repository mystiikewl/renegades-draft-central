/**
 * Pure projection math for the Team Builder / rankings surfaces.
 * All functions operate on PlayerWithStats[] (see src/api/types.ts) using
 * the ESPN stat keys stored in player_seasons.stats JSONB. The category
 * vocabulary itself lives in ./leagueCategories.ts.
 */
import type { PlayerWithStats } from '@/api/types';
import {
  AVERAGE_CATEGORIES,
  ATTEMPT_KEYS,
  attemptsPerGame,
  CATEGORY_STAT_KEYS,
  GAMES_PLAYED_KEY,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  statNumber,
  type Category,
} from '@/lib/leagueCategories';

export { CATEGORY_STAT_KEYS, INVERTED_CATEGORIES, LEAGUE_CATEGORIES, PERCENTAGE_CATEGORIES };
export type { Category } from '@/lib/leagueCategories';

/** Value basis: 'totals' (ROTO season totals) or 'averages' (per-game). */
export type Basis = 'totals' | 'averages';

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function gamesPlayed(player: PlayerWithStats): number {
  return Math.max(0, num(player.player_seasons[0]?.stats?.[GAMES_PLAYED_KEY]));
}

function percentageVolume(
  player: PlayerWithStats,
  cat: Category,
  basis: Basis = 'totals',
): number {
  const stats = player.player_seasons[0]?.stats;
  if (!stats || !ATTEMPT_KEYS[cat]) return basis === 'totals' ? Math.max(1, gamesPlayed(player)) : 1;

  const perGameVolume = Math.max(attemptsPerGame(stats, cat), 1);

  if (basis === 'averages') return perGameVolume;
  const games = gamesPlayed(player);
  return perGameVolume * (games > 0 ? games : 1);
}

export function playerValue(p: PlayerWithStats, cat: Category, basis: Basis = 'totals'): number {
  const stats = p.player_seasons[0]?.stats;
  const value = statNumber(stats, cat);
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
    const value = playerValue(player, cat, basis);
    // Missing percentage data should be neutral rather than treated as a
    // catastrophic 0% shooter. When data exists, fantasy value depends on both
    // efficiency and shot volume.
    if (value <= 0) return 0;
    return (value - poolPct) * percentageVolume(player, cat, basis);
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

export interface ValueScoreOptions {
  basis?: Basis;
  /** Pool the z-scores are computed against — defaults to `pool` itself. */
  scoreUniverse?: PlayerWithStats[];
  /** Category weights: missing counts as 1, zero removes (punts) the category. */
  weights?: Partial<Record<Category, number>>;
}

/**
 * The player-value interface: a weighted composite of per-category z-scores
 * across the league's 13 ROTO categories, normalised by the sum of positive
 * weights. Every consumer — pool VAL column, strategy boards, practice CPU,
 * custom rankings — reads value through this one seam so their answers stay
 * on a single scale.
 */
export function valueScores(
  pool: PlayerWithStats[],
  options: ValueScoreOptions = {},
): Map<string, number> {
  const { basis = 'totals', scoreUniverse = pool, weights = {} } = options;
  const categoryScores = LEAGUE_CATEGORIES.map((category) => zScores(scoreUniverse, category, basis));
  const activeWeights = LEAGUE_CATEGORIES.map((category) => Math.max(0, weights[category] ?? 1));
  const weightSum = activeWeights.reduce((sum, weight) => sum + weight, 0);

  const scores = new Map<string, number>();
  for (const player of pool) {
    const total = categoryScores.reduce(
      (sum, values, index) => sum + (values.get(player.id) ?? 0) * activeWeights[index],
      0,
    );
    scores.set(player.id, weightSum > 0 ? total / weightSum : 0);
  }
  return scores;
}

/** Equal-weight composite value across the league's 13 ROTO categories. */
export function leagueValueScores(
  pool: PlayerWithStats[],
  basis: Basis = 'totals',
): Map<string, number> {
  return valueScores(pool, { basis });
}

export interface CategoryImpact {
  cat: Category;
  before: number;
  after: number;
  baseline: number;
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
      baseline: base[cat],
      delta: after - before,
      flipsVsBaseline:
        (beforeGap < 0 && afterGap >= 0) ||
        (beforeGap > 0 && afterGap <= 0),
    };
  });
}
