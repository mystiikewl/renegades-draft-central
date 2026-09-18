import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import type { CategoryNeed, NeedStatus } from '@/lib/draftIntelligence';
import { LEAGUE_CATEGORIES, type Category } from '@/lib/leagueCategories';
import {
  categoryStanding,
  categoryVerdict,
  marketDepthByCat,
  strongCategories,
  type CategoryStanding,
  type MarketDepth,
} from './categoryMarket';

function player(id: string, overrides: Record<string, number> = {}): PlayerWithStats {
  return {
    id,
    name: id,
    position: 'PG',
    nba_team: 'BOS',
    espn_id: id,
    player_seasons: [
      {
        season_id: 's1',
        stats: {
          games_played: 10,
          points: 1,
          total_rebounds: 1,
          assists: 1,
          steals: 1,
          blocks: 0,
          turnovers: 1,
          field_goals_made: 0.4,
          field_goals_attempted: 1,
          field_goal_percentage: 0.4,
          free_throws_made: 0.8,
          free_throws_attempted: 1,
          free_throw_percentage: 0.8,
          three_pointers_made: 0.1,
          three_pointers_attempted: 0.3,
          three_point_percentage: 0.33,
          double_doubles: 0,
          triple_doubles: 0,
          ...overrides,
        },
      },
    ],
  } as PlayerWithStats;
}

// One 25-player pool covering all three depth levels: 1 blk provider (4%,
// scarce + top-heavy), 3 ast providers (12%, moderate, flat), 6 pts providers
// (24%, deep). Everything else identical, so every other category is flat.
const overlay = [
  player('blk-1', { blocks: 10 }),
  player('ast-1', { assists: 5 }),
  player('ast-2', { assists: 5 }),
  player('ast-3', { assists: 5 }),
  player('pts-1', { points: 10 }),
  player('pts-2', { points: 10 }),
  player('pts-3', { points: 10 }),
  player('pts-4', { points: 10 }),
  player('pts-5', { points: 10 }),
  player('pts-6', { points: 10 }),
];
const pool = [...overlay, ...Array.from({ length: 15 }, (_, i) => player(`filler-${i}`))];

describe('marketDepthByCat', () => {
  it('classifies scarce, moderate and deep markets from provider share', () => {
    const depths = marketDepthByCat(pool, 10);

    const blk = depths.get('blk')!;
    expect(blk.depth).toBe('scarce');
    expect(blk.providers).toBe(1);
    expect(blk.providerShare).toBeCloseTo(0.04, 5);
    expect(blk.perTeam).toBeCloseTo(0.1, 5);

    const ast = depths.get('ast')!;
    expect(ast.depth).toBe('moderate');
    expect(ast.providers).toBe(3);

    const pts = depths.get('pts')!;
    expect(pts.depth).toBe('deep');
    expect(pts.providers).toBe(6);
  });

  it('flags top-heavy markets from the drop to the ~5th provider', () => {
    const depths = marketDepthByCat(pool, 10);

    // blk has a lone elite provider; nothing backs him up below.
    expect(depths.get('blk')!.topHeavy).toBe(true);
    expect(depths.get('blk')!.dropOff).toBeGreaterThan(0.75);
  });

  it('reads a level market when the ~5th value is still provider-grade', () => {
    // 5 of 34 providers ≈ 15% (moderate) and the 5th-best z equals the top.
    const flatPool = [
      ...Array.from({ length: 5 }, (_, i) => player(`flat-ast-${i}`, { assists: 5 })),
      ...Array.from({ length: 29 }, (_, i) => player(`flat-filler-${i}`)),
    ];
    const ast = marketDepthByCat(flatPool, 10).get('ast')!;
    expect(ast.depth).toBe('moderate');
    expect(ast.topHeavy).toBe(false);
    expect(ast.dropOff).toBe(0);
  });

  it('covers every category', () => {
    const depths = marketDepthByCat(pool, 10);
    expect([...depths.keys()].sort()).toEqual([...LEAGUE_CATEGORIES].sort());
  });

  it('treats an empty pool as a flat market', () => {
    const depths = marketDepthByCat([], 10);
    expect(depths.get('pts')).toMatchObject({ providers: 0, providerShare: 0, depth: 'scarce', topHeavy: false });
  });
});

describe('categoryStanding', () => {
  const zByPlayer = new Map([
    ['a', 3],
    ['b', 2],
    ['c', 2],
    ['d', 0],
  ]);

  it('ranks with ties sharing a rank and derives a midrank percentile', () => {
    expect(categoryStanding(zByPlayer, 'pts', 'a')).toMatchObject({ rank: 1, percentile: 88, poolSize: 4 });
    expect(categoryStanding(zByPlayer, 'pts', 'b')!.rank).toBe(2);
    expect(categoryStanding(zByPlayer, 'pts', 'c')!.rank).toBe(2);
    expect(categoryStanding(zByPlayer, 'pts', 'd')).toMatchObject({ rank: 4, percentile: 13 });
  });

  it('returns null for players outside the pool', () => {
    expect(categoryStanding(zByPlayer, 'pts', 'missing')).toBeNull();
    expect(categoryStanding(new Map(), 'pts', 'a')).toBeNull();
  });
});

describe('strongCategories', () => {
  const zByCat = new Map<Category, Map<string, number>>([
    ['pts', new Map([['p1', 2], ['p1b', 1.5]])],
    ['blk', new Map([['p1', 1.2]])],
    ['ast', new Map([['p1', 0.5]])],
    ['reb', new Map([['p1', -1]])],
  ]);

  it('keeps provider-level categories, best first, capped at 5', () => {
    const { rows, fallback } = strongCategories(zByCat, 'p1');
    expect(fallback).toBe(false);
    expect(rows.map((row) => row.cat)).toEqual(['pts', 'blk']);
  });

  it('falls back to the top 3 relative strengths when nothing clears the bar', () => {
    const zByCatSub = new Map<Category, Map<string, number>>([
      ['pts', new Map([['p1b', 0.9]])],
      ['ast', new Map([['p1b', 0.5]])],
      ['reb', new Map([['p1b', -1]])],
    ]);
    const { rows, fallback } = strongCategories(zByCatSub, 'p1b');
    expect(fallback).toBe(true);
    expect(rows.map((row) => row.cat)).toEqual(['pts', 'ast', 'reb']);
  });
});

const depth = (overrides: Partial<MarketDepth>): MarketDepth => ({
  cat: 'pts',
  providers: 10,
  providerShare: 0.2,
  perTeam: 1,
  topZ: 2,
  fifthZ: 2,
  dropOff: 0,
  depth: 'deep',
  topHeavy: false,
  ...overrides,
});

const standing = (overrides: Partial<CategoryStanding>): CategoryStanding => ({
  cat: 'pts',
  z: 2,
  rank: 1,
  poolSize: 25,
  percentile: 90,
  ...overrides,
});

const need = (status: NeedStatus): CategoryNeed => ({
  cat: 'pts',
  current: 0,
  target: 10,
  rawGap: 10,
  priority: 1,
  status,
});

describe('categoryVerdict', () => {
  const cases: [string, MarketDepth, CategoryStanding, CategoryNeed | undefined, string][] = [
    ['punt dominates everything', depth({ depth: 'scarce' }), standing({ percentile: 95 }), need('punt'), 'punting'],
    ['scarce + priority + strong rank is premium', depth({ depth: 'scarce' }), standing({ percentile: 70 }), need('priority'), 'premium'],
    ['moderate top-heavy counts as thin', depth({ depth: 'moderate', topHeavy: true }), standing({ percentile: 70 }), need('priority'), 'premium'],
    ['scarce without a real need is a hold', depth({ depth: 'scarce' }), standing({ percentile: 70 }), need('watch'), 'hold'],
    ['scarce with no need data is a hold', depth({ depth: 'scarce' }), standing({ percentile: 70 }), undefined, 'hold'],
    ['deep market still fills a priority need', depth(), standing({ percentile: 70 }), need('priority'), 'value'],
    ['moderate flat + priority is a value fill', depth({ depth: 'moderate' }), standing({ percentile: 70 }), need('priority'), 'value'],
    ['deep market commoditises covered categories', depth(), standing({ percentile: 95 }), need('healthy'), 'replaceable'],
    ['deep + watch is replaceable at any rank', depth(), standing({ percentile: 40 }), need('watch'), 'replaceable'],
    ['mid player in a scarce market you need is a filler', depth({ depth: 'scarce' }), standing({ percentile: 40 }), need('priority'), 'filler'],
    ['mid player in a flat moderate market is a filler', depth({ depth: 'moderate' }), standing({ percentile: 40 }), need('watch'), 'filler'],
    ['mid player in a deep market you need is a filler', depth(), standing({ percentile: 40 }), need('priority'), 'filler'],
  ];

  for (const [name, d, s, n, expected] of cases) {
    it(name, () => {
      expect(categoryVerdict(d, s, n)).toBe(expected);
    });
  }
});
