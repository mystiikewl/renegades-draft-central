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
  it('sums counting categories on a season-totals basis (avg x GP)', () => {
    expect(categoryTotals(pool, ['pts', 'reb'])).toEqual({ pts: 600, reb: 150 });
  });

  it('uses dd/td directly because they are season totals', () => {
    const doubleDoubles = [P('a', 20, 5, 0.5, 10, { double_doubles: 30 })];
    expect(categoryTotals(doubleDoubles, ['dd']).dd).toBe(30);
  });

  it('weights percentage categories by attempt volume', () => {
    const shooters = [
      P('low-volume', 0, 0, 0.6, 10, { field_goals_made: 1, field_goals_attempted: 2 }),
      P('high-volume', 0, 0, 0.4, 10, { field_goals_made: 8, field_goals_attempted: 20 }),
    ];
    // (0.6 x 20 attempts + 0.4 x 200 attempts) / 220 attempts
    expect(categoryTotals(shooters, ['fgPct']).fgPct).toBeCloseTo(92 / 220);
  });

  it('derives attempts from makes and percentage when attempts are absent', () => {
    const shooters = [
      P('a', 0, 0, 0.5, 10, { field_goals_made: 5 }),
      P('b', 0, 0, 0.4, 10, { field_goals_made: 8 }),
    ];
    // a: 10 attempts/game; b: 20 attempts/game -> .4333 weighted percentage.
    expect(categoryTotals(shooters, ['fgPct']).fgPct).toBeCloseTo(13 / 30);
  });

  it('treats missing stats as zero', () => {
    const broken = [{ ...P('x', 1, 1, 0.5), player_seasons: [] }];
    expect(categoryTotals(broken, ['pts'])).toEqual({ pts: 0 });
  });
});

describe('baseline', () => {
  it('divides counting totals by team count', () => {
    expect(baseline(pool, 3, ['pts'])).toEqual({ pts: 200 });
  });

  it('keeps percentage baselines as rates instead of dividing by league size', () => {
    const even = [
      P('a', 0, 0, 0.5, 10, { field_goals_made: 5, field_goals_attempted: 10 }),
      P('b', 0, 0, 0.5, 10, { field_goals_made: 10, field_goals_attempted: 20 }),
    ];
    expect(baseline(even, 10, ['fgPct']).fgPct).toBeCloseTo(0.5);
  });
});

describe('zScores', () => {
  it('centers at zero mean and handles inverted turnover category', () => {
    const scores = zScores(pool, 'pts');
    expect(scores.get('b')).toBeLessThan(0);
    expect(scores.get('c')).toBeGreaterThan(0);
    const mean = [...scores.values()].reduce((sum, value) => sum + value, 0) / scores.size;
    expect(mean).toBeCloseTo(0);
  });

  it('recomputes on the averages basis with GP scaling removed', () => {
    const pair = [P('iron', 20, 0, 0.5, 82), P('glass', 20, 0, 0.5, 40)];
    const scores = zScores(pair, 'pts', 'averages');
    expect(scores.get('iron')).toBeCloseTo(0);
    expect(scores.get('glass')).toBeCloseTo(0);
  });

  it('rewards durability on the totals basis', () => {
    const pair = [P('iron', 20, 0, 0.5, 82), P('glass', 20, 0, 0.5, 40)];
    const scores = zScores(pair, 'pts');
    expect(scores.get('iron')).toBeGreaterThan(0);
    expect(scores.get('glass')).toBeLessThan(0);
  });

  it('values high-volume percentage impact above the same percentage on low volume', () => {
    const shooters = [
      P('high-volume-good', 0, 0, 0.55, 82, { field_goals_made: 11, field_goals_attempted: 20 }),
      P('low-volume-good', 0, 0, 0.55, 82, { field_goals_made: 1.1, field_goals_attempted: 2 }),
      P('high-volume-poor', 0, 0, 0.45, 82, { field_goals_made: 9, field_goals_attempted: 20 }),
    ];
    const scores = zScores(shooters, 'fgPct');
    expect(scores.get('high-volume-good')).toBeGreaterThan(scores.get('low-volume-good') ?? 0);
    expect(scores.get('high-volume-poor')).toBeLessThan(0);
  });

  it('keeps missing percentage data neutral instead of treating it as 0%', () => {
    const missing = {
      ...P('missing', 0, 0, 0, 82),
      player_seasons: [{ season_id: 's1', stats: { games_played: 82 } }],
    };
    const shooters = [
      P('good', 0, 0, 0.55, 82, { field_goals_made: 11, field_goals_attempted: 20 }),
      P('poor', 0, 0, 0.45, 82, { field_goals_made: 9, field_goals_attempted: 20 }),
      missing,
    ];
    expect(zScores(shooters, 'fgPct').get('missing')).toBeCloseTo(0);
  });
});

describe('impact', () => {
  const cats = ['pts', 'reb'] as const;
  const base = baseline(pool, 3, cats);

  it('reports deltas and baseline crossings', () => {
    const team = [P('a', 20, 5, 0.5)];
    const result = impact(team, P('c', 30, 2, 0.6), base, cats);
    const points = result.find((item) => item.cat === 'pts')!;
    const rebounds = result.find((item) => item.cat === 'reb')!;
    expect(points.delta).toBe(300);
    expect(points.flipsVsBaseline).toBe(false);
    expect(rebounds.delta).toBe(20);
    expect(rebounds.flipsVsBaseline).toBe(false);
  });
});
