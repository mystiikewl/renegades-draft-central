/**
 * Category market context: how scarce (premium) or replaceable (commodity)
 * a player's category strengths are league-wide, crossed with whether the
 * viewer's roster actually needs them. Depth comes from provider share of
 * the pool, not the Decision Board's needs-based categoryMarkets.
 */

import type { PlayerWithStats } from '@/api/types';
import type { CategoryNeed } from '@/lib/draftIntelligence';
import { LEAGUE_CATEGORIES, type Category } from '@/lib/leagueCategories';
import { zScores } from '@/lib/projections';

/** A "provider" is any player whose category z-score clears this bar. */
export const PROVIDER_Z = 1;
/** Pool share of providers below which a market is scarce. */
export const SCARCE_SHARE = 0.08;
/** Pool share of providers above which a market is deep. */
export const DEEP_SHARE = 0.15;
/** z gap between the top provider and the ~5th that marks an elite-steep market. */
export const TOP_HEAVY_DROP = 0.75;
/** Percentile a candidate must clear for scarcity to translate into a buy verdict. */
export const STRONG_PERCENTILE = 65;
/** Verdict rows shown at most — keep the section skimmable. */
export const MAX_ROWS = 5;

export type MarketDepthLevel = 'scarce' | 'moderate' | 'deep';

export interface MarketDepth {
  cat: Category;
  providers: number;
  providerShare: number;
  /** providers / leagueSize — the "how many per team" intuition. */
  perTeam: number;
  topZ: number;
  fifthZ: number;
  dropOff: number;
  depth: MarketDepthLevel;
  topHeavy: boolean;
}

export interface CategoryStanding {
  cat: Category;
  z: number;
  rank: number;
  poolSize: number;
  percentile: number;
}

export type MarketVerdict = 'premium' | 'hold' | 'value' | 'filler' | 'replaceable' | 'punting';

export interface StrongCategories {
  rows: CategoryStanding[];
  /** True when nothing cleared the provider bar — rows are relative strengths only. */
  fallback: boolean;
}

function clampPercentile(value: number): number {
  return Math.max(1, Math.min(99, value));
}

/** Provider-share depth for every category over the pool (season totals). */
export function marketDepthByCat(pool: PlayerWithStats[], leagueSize: number): Map<Category, MarketDepth> {
  const teams = Math.max(1, leagueSize);
  const size = Math.max(1, pool.length);
  return new Map(
    LEAGUE_CATEGORIES.map((cat) => {
      const sorted = [...zScores(pool, cat, 'totals').values()].sort((a, b) => b - a);
      const providers = sorted.filter((z) => z >= PROVIDER_Z).length;
      const providerShare = pool.length > 0 ? providers / size : 0;
      const topZ = sorted[0] ?? 0;
      const fifthZ = sorted[4] ?? topZ;
      const dropOff = topZ - fifthZ;
      return [
        cat,
        {
          cat,
          providers,
          providerShare,
          perTeam: providers / teams,
          topZ,
          fifthZ,
          dropOff,
          depth: providerShare < SCARCE_SHARE ? 'scarce' : providerShare > DEEP_SHARE ? 'deep' : 'moderate',
          topHeavy: dropOff >= TOP_HEAVY_DROP,
        },
      ];
    }),
  );
}

/** Where one player stands in one category's pool-wide z ranking (midrank percentile, like playerShape). */
export function categoryStanding(
  zByPlayer: Map<string, number>,
  cat: Category,
  playerId: string,
): CategoryStanding | null {
  const z = zByPlayer.get(playerId);
  if (z === undefined || zByPlayer.size === 0) return null;
  const rank = 1 + [...zByPlayer.values()].filter((value) => value > z).length;
  const percentile = clampPercentile(Math.round((1 - (rank - 0.5) / zByPlayer.size) * 100));
  return { cat, z, rank, poolSize: zByPlayer.size, percentile };
}

/** His provider-level categories, best first; falls back to his top 3 when nothing clears the bar. */
export function strongCategories(
  zByCat: Map<Category, Map<string, number>>,
  playerId: string,
): StrongCategories {
  const standings = LEAGUE_CATEGORIES
    .map((cat) => categoryStanding(zByCat.get(cat) ?? new Map(), cat, playerId))
    .filter((standing): standing is CategoryStanding => standing !== null);
  const providers = standings
    .filter((standing) => standing.z >= PROVIDER_Z)
    .sort((a, b) => b.z - a.z);
  if (providers.length > 0) return { rows: providers.slice(0, MAX_ROWS), fallback: false };
  const relative = [...standings].sort((a, b) => b.z - a.z).slice(0, 3);
  return { rows: relative, fallback: true };
}

/**
 * Buy/avoid verdict per category. Precedence: a punt dominates; a thin market
 * (scarce, or moderate-but-top-heavy) plus a real need plus a strong rank is a
 * premium; deep markets commoditise everyone the roster doesn't need.
 */
export function categoryVerdict(
  depth: MarketDepth,
  standing: CategoryStanding,
  need?: CategoryNeed,
): MarketVerdict {
  if (need?.status === 'punt') return 'punting';
  const thin = depth.depth === 'scarce' || (depth.depth === 'moderate' && depth.topHeavy);
  const strong = standing.percentile >= STRONG_PERCENTILE;
  const priority = need?.status === 'priority';
  if (strong && thin && priority) return 'premium';
  if (strong && thin) return 'hold';
  if (depth.depth === 'deep' && !priority) return 'replaceable';
  if (strong && priority) return 'value';
  return 'filler';
}
