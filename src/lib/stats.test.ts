import { describe, expect, it } from 'vitest';
import { isRookie, pickStatsSeason, statColumnValue, fmtStat, type StatsSeasonRow } from './stats';

describe('isRookie', () => {
  it('is true only for experience === 0', () => {
    expect(isRookie({ experience: 0 })).toBe(true);
    expect(isRookie({ experience: 3 })).toBe(false);
    expect(isRookie({ experience: null })).toBe(false);
    expect(isRookie({})).toBe(false);
  });
});

describe('statColumnValue', () => {
  const p = {
    player_seasons: [{
      stats: {
        games_played: 10, points: 20.5, field_goal_percentage: 48.7,
        double_doubles: 15, triple_doubles: 2,
      },
    }],
  };

  it('returns raw per-game values in averages mode', () => {
    expect(statColumnValue(p, 'pts', 'averages')).toBe(20.5);
    expect(statColumnValue(p, 'gp', 'averages')).toBe(10);
    expect(statColumnValue(p, 'fgPct', 'averages')).toBe(48.7);
  });

  it('multiplies averages by GP in totals mode', () => {
    expect(statColumnValue(p, 'pts', 'totals')).toBe(205);
    // pct cats are not scaled
    expect(statColumnValue(p, 'fgPct', 'totals')).toBe(48.7);
  });

  it('divides stored totals by GP for dd/td in averages mode', () => {
    expect(statColumnValue(p, 'dd', 'averages')).toBe(1.5);
    expect(statColumnValue(p, 'td', 'totals')).toBe(2);
  });

  it('handles missing stats as zero', () => {
    expect(statColumnValue({ player_seasons: [] }, 'pts', 'totals')).toBe(0);
  });
});

describe('fmtStat', () => {
  it('formats percentages at 1dp regardless of basis', () => {
    expect(fmtStat('fgPct', 'totals', 48.72)).toBe('48.7');
  });
  it('formats counting stats 1dp in avg mode, rounded int in totals mode', () => {
    expect(fmtStat('pts', 'averages', 20.54)).toBe('20.5');
    expect(fmtStat('pts', 'totals', 204.6)).toBe('205');
    expect(fmtStat('dd', 'averages', 1.5)).toBe('1.5');
    expect(fmtStat('dd', 'totals', 15)).toBe('15');
  });
});

describe('pickStatsSeason', () => {
  const row = (season_id: string, label: string, stats: StatsSeasonRow['stats']): StatsSeasonRow => ({
    season_id,
    stats,
    seasons: { label },
  });

  it('prefers the active season row when it has stats', () => {
    const rows = [row('s-old', '2025-26', { points: 20 }), row('s-now', '2026-27', { points: 21 })];
    expect(pickStatsSeason(rows, 's-now')?.season_id).toBe('s-now');
  });

  it('falls back to the most recent labeled season when the active row is empty', () => {
    const rows = [
      row('s-old', '2024-25', { points: 18 }),
      row('s-now', '2026-27', {}),
      row('s-prev', '2025-26', { points: 20 }),
    ];
    expect(pickStatsSeason(rows, 's-now')?.season_id).toBe('s-prev');
  });

  it('returns null when no row has stats', () => {
    const rows = [row('s-now', '2026-27', {}), row('s-old', '2025-26', null)];
    expect(pickStatsSeason(rows, 's-now')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickStatsSeason([], 's-now')).toBeNull();
  });
});
