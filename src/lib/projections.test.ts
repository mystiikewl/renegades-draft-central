import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { baseline, categoryTotals, impact, zScores } from './projections';

const P = (id: string, pts: number, reb: number, fgPct: number, gp = 10): PlayerWithStats => ({
  id,
  espn_id: id,
  name: id,
  position: 'G',
  nba_team: null,
  image_url: null,
  created_at: '',
  player_seasons: [{ season_id: 's1', stats: { points: pts, total_rebounds: reb, field_goal_percentage: fgPct, games_played: gp } }],
});

const pool = [P('a', 20, 5, 0.5), P('b', 10, 8, 0.4), P('c', 30, 2, 0.6)];

describe('categoryTotals', () => {
  it('sums counting categories', () => {
    expect(categoryTotals(pool, ['pts', 'reb'])).toEqual({ pts: 60, reb: 15 });
  });
  it('weights percentage categories by games played', () => {
    // (0.5*10 + 0.4*10 + 0.6*10) / 30
    expect(categoryTotals(pool, ['fgPct']).fgPct).toBeCloseTo(0.5);
  });
  it('treats missing stats as zero', () => {
    const broken = [{ ...P('x', 1, 1, 0.5), player_seasons: [] }];
    expect(categoryTotals(broken, ['pts'])).toEqual({ pts: 0 });
  });
});

describe('baseline', () => {
  it('divides pool totals by team count', () => {
    expect(baseline(pool, 3, ['pts'])).toEqual({ pts: 20 });
  });
});

describe('zScores', () => {
  it('centers at zero mean and handles inverted turnover category', () => {
    const zs = zScores(pool, 'pts');
    expect(zs.get('b')).toBeLessThan(0);
    expect(zs.get('c')).toBeGreaterThan(0);
    const mean = [...zs.values()].reduce((a, b) => a + b, 0) / zs.size;
    expect(mean).toBeCloseTo(0);
  });
});

describe('impact', () => {
  const cats = ['pts', 'reb'] as const;
  const base = baseline(pool, 3, cats); // pts 20, reb 5
  it('reports deltas and baseline crossings', () => {
    const team = [P('a', 20, 5, 0.5)]; // exactly at baseline
    const imp = impact(team, P('c', 30, 2, 0.6), base, cats);
    const ptsImp = imp.find((i) => i.cat === 'pts')!;
    const rebImp = imp.find((i) => i.cat === 'reb')!;
    expect(ptsImp.delta).toBe(30);
    // Strict crossing: starting exactly AT baseline and moving up is not a flip
    // (same structural move as reb below — consistent semantics).
    expect(ptsImp.flipsVsBaseline).toBe(false);
    expect(rebImp.delta).toBe(2);
    expect(rebImp.flipsVsBaseline).toBe(false); // stays above baseline
  });
});
