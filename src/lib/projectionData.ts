import { pickStatsSeason, type StatsSeasonRow } from '@/lib/stats';

export interface ProjectionStatsRow {
  season_id: string;
  source: string;
  stats: Record<string, number | string | null> | null;
  updated_at: string;
}

export interface PreferredStatsSelection {
  row: StatsSeasonRow | null;
  source: 'espn' | 'historical' | 'none';
  updatedAt: string | null;
  usesHistoricalFallback: boolean;
}

/** Prefer active ESPN projections while retaining historical values for fields ESPN omits. */
export function selectPreferredStats(
  historicalRows: StatsSeasonRow[],
  projectionRows: ProjectionStatsRow[],
  activeSeasonId: string,
): PreferredStatsSelection {
  const historical = pickStatsSeason(historicalRows, activeSeasonId);
  const projection = projectionRows.find(
    (candidate) =>
      candidate.season_id === activeSeasonId &&
      candidate.stats &&
      Object.keys(candidate.stats).length > 0,
  );

  if (projection?.stats) {
    const historicalStats = historical?.stats ?? {};
    const usesHistoricalFallback = Object.keys(historicalStats).some(
      (key) => projection.stats?.[key] == null,
    );
    return {
      row: {
        season_id: activeSeasonId,
        stats: { ...historicalStats, ...projection.stats },
      },
      source: 'espn',
      updatedAt: projection.updated_at,
      usesHistoricalFallback,
    };
  }

  if (historical) {
    return {
      row: historical,
      source: 'historical',
      updatedAt: null,
      usesHistoricalFallback: true,
    };
  }

  return { row: null, source: 'none', updatedAt: null, usesHistoricalFallback: false };
}
