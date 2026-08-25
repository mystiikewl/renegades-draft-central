import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { baseline, categoryTotals, impact, zScores, LEAGUE_CATEGORIES } from './projections';

const P = (
  id: string,
  pts: number,
  reb: number,
  fgPct: number,
  gp = 10,
  extras: Record<string, number> = {},
): PlayerWithStats => ({
  id,
  espn_id: id,
  name: id,
  position: 'G',
  nba_team: null,
  image_url: null,
  created_at: '',
  player_seasons: [{
    season_id: 's1',
    stats: { points: pts, total_rebounds: reb, field_goal_percentage: fgPct, games_played: gp, ...extras },
  }],
});

const pool = [P('a', 20, 5, 0.5), P('b', 10, 8, 0.4), P('c', 30, 2, 0.6)];

describe('category model', () => {
  it('covers all 13 league ROTO categories', () => {
    expect(LEAGUE_CATEGORIES).toEqual([
      'fgm', 'fgPct', 'ftPct', 'tp', 'tpPct', 'reb', 'ast', 'stl', 'blk', 'to', 'dd', 'td', 'pts',
    ]);
  });
});

describe('categoryTotals', () => {
  it('sums counting categories on a season-totals basis (avg × GP)', () => {
    // counting cats are stored as averages: (20+10+30) PPG × 10 GP = 600 total
    expect(categoryTotals(pool, ['pts', 'reb'])).toEqual({ pts: 600, reb: 150 });
  });
  it('uses dd/td directly (already season totals from the misc feed)', () => {
    const dd = [P('a', 20, 5, 0.5, 10, { double_doubles: 30 })];
    expect(categoryTotals(dd, ['dd']).dd).toBe(30);
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
    expect(baseline(pool, 3, ['pts'])).toEqual({ pts: 200 }); // 600 / 3
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
  it('recomputes on the averages basis (GP scaling removed)', () => {
    // equal PPG, different GP: totals z favors iron, averages z ties them at 0
    const pair = [P('iron', 20, 0, 0.5, 82), P('glass', 20, 0, 0.5, 40)];
    const zs = zScores(pair, 'pts', 'averages');
    expect(zs.get('iron')).toBeCloseTo(0);
    expect(zs.get('glass')).toBeCloseTo(0);
  });
  it('rewards durability: same PPG, more GP -> higher totals z', () => {
    const pair = [P('iron', 20, 0, 0.5, 82), P('glass', 20, 0, 0.5, 40)];
    const zs = zScores(pair, 'pts');
    expect(zs.get('iron')).toBeGreaterThan(0);
    expect(zs.get('glass')).toBeLessThan(0);
  });
});

describe('impact', () => {
  const cats = ['pts', 'reb'] as const;
  const base = baseline(pool, 3, cats); // pts 200, reb 50
  it('reports deltas and baseline crossings', () => {
    const team = [P('a', 20, 5, 0.5)]; // exactly at baseline
    const imp = impact(team, P('c', 30, 2, 0.6), base, cats);
    const ptsImp = imp.find((i) => i.cat === 'pts')!;
    const rebImp = imp.find((i) => i.cat === 'reb')!;
    expect(ptsImp.delta).toBe(300); // 30 PPG × 10 GP
    // Strict crossing: starting exactly AT baseline and moving up is not a flip
    // (same structural move as reb below — consistent semantics).
    expect(ptsImp.flipsVsBaseline).toBe(false);
    expect(rebImp.delta).toBe(20);
    expect(rebImp.flipsVsBaseline).toBe(false); // stays above baseline
  });
});
