import { describe, expect, it } from 'vitest';
import { selectPreferredStats } from './projectionData';

describe('selectPreferredStats', () => {
  const historical = [{
    season_id: 'old',
    seasons: { label: '2025-26' },
    stats: { points: 20, assists: 6, double_doubles: 8 },
  }];

  it('prefers active-season ESPN projections and fills unsupported categories from history', () => {
    const selected = selectPreferredStats(historical, [{
      season_id: 'active',
      source: 'espn',
      updated_at: '2026-09-10T01:00:00Z',
      stats: { points: 24, assists: 7, games_played: 78 },
    }], 'active');

    expect(selected).toEqual({
      row: {
        season_id: 'active',
        stats: { points: 24, assists: 7, games_played: 78, double_doubles: 8 },
      },
      source: 'espn',
      updatedAt: '2026-09-10T01:00:00Z',
      usesHistoricalFallback: true,
    });
  });

  it('falls back to the latest historical season when projections are unavailable', () => {
    const selected = selectPreferredStats(historical, [], 'active');

    expect(selected.source).toBe('historical');
    expect(selected.row?.season_id).toBe('old');
    expect(selected.usesHistoricalFallback).toBe(true);
  });
});
