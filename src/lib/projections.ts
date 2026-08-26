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
const PCT_CATEGORIES: ReadonlySet<Category> = new Set(['fgPct', 'ftPct', 'tpPct']);
/** Counting cats stored as per-game averages — valued at season totals (avg × GP). */
const AVERAGE_CATEGORIES: ReadonlySet<Category> = new Set([
  'fgm', 'tp', 'reb', 'ast', 'stl', 'blk', 'to', 'pts',
]);

/** Value basis: 'totals' (ROTO season totals) or 'averages' (per-game). */
export type Basis = 'totals' | 'averages';

export function playerValue(p: PlayerWithStats, cat: Category, basis: Basis = 'totals'): number {
  const s = p.player_seasons[0]?.stats;
  const raw = s?.[CATEGORY_STAT_KEYS[cat]];
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(v) || v === 0) return 0;
  if (AVERAGE_CATEGORIES.has(cat)) {
    if (basis === 'averages') return v;
    // ROTO ranks season totals: per-game average × games played
    const gpRaw = s?.games_played;
    const gp = typeof gpRaw === 'number' ? gpRaw : parseFloat(String(gpRaw ?? ''));
    return Number.isFinite(gp) ? v * gp : 0;
  }
  if (cat === 'dd' || cat === 'td') {
    // stored as season totals; per-game in averages mode
    if (basis === 'averages') {
      const gpRaw = s?.games_played;
      const gp = typeof gpRaw === 'number' ? gpRaw : parseFloat(String(gpRaw ?? ''));
      return Number.isFinite(gp) && gp > 0 ? v / gp : 0;
    }
  }
  return v;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cumulative totals per category for a set of players.
 * Counting cats are summed; percentage cats are games-weighted averages
 * (falls back to a plain mean when GP is missing).
 */
export function categoryTotals(players: PlayerWithStats[], cats: readonly Category[]): Record<Category, number> {
  const out = {} as Record<Category, number>;
  for (const cat of cats) {
    if (!PCT_CATEGORIES.has(cat)) {
      out[cat] = players.reduce((sum, p) => sum + playerValue(p, cat), 0);
    } else {
      let weight = 0;
      let acc = 0;
      for (const p of players) {
        const gp = num(p.player_seasons[0]?.stats?.games_played);
        const w = gp > 0 ? gp : 1;
        weight += w;
        acc += playerValue(p, cat) * w;
      }
      out[cat] = weight > 0 ? acc / weight : 0;
    }
  }
  return out;
}

/** Average-team totals: what a team that drafted evenly from the pool would have. */
export function baseline(pool: PlayerWithStats[], teams: number, cats: readonly Category[]): Record<Category, number> {
  const totals = categoryTotals(pool, cats);
  const out = {} as Record<Category, number>;
  for (const cat of cats) out[cat] = teams > 0 ? totals[cat] / teams : 0;
  return out;
}

/** Per-category z-scores across the pool: playerId -> z. */
export function zScores(pool: PlayerWithStats[], cat: Category, basis: Basis = 'totals'): Map<string, number> {
  const values = pool.map((p) => playerValue(p, cat, basis));
  const n = values.length;
  const zs = new Map<string, number>();
  if (n === 0) return zs;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  // ponytail: population sd, no sample correction — ranking-only use
  if (sd < 1e-9) {
    for (const p of pool) zs.set(p.id, 0);
    return zs;
  }
  const sign = INVERTED_CATEGORIES.has(cat) ? -1 : 1;
  for (let i = 0; i < n; i++) zs.set(pool[i].id, (sign * (values[i] - mean)) / sd);
  return zs;
}

export interface CategoryImpact {
  cat: Category;
  before: number;
  after: number;
  delta: number;
  /** true if adding the candidate moves this category across the baseline (below→above or above→below). */
  flipsVsBaseline: boolean;
}

/** Delta on each category from adding `candidate` to the current team, plus rank-vs-baseline flips. */
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
    const b = before - base[cat];
    const a = after - base[cat];
    return { cat, before, after, delta: after - before, flipsVsBaseline: b * a < 0 };
  });
}
