import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { buildPlayerShapes, closestShapeMatches, shapeSimilarity } from '@/lib/playerShape';

function player(id: string, stats: Record<string, number>): PlayerWithStats {
  return {
    id,
    espn_id: id,
    name: id,
    position: 'SF',
    nba_team: 'BOS',
    image_url: null,
    created_at: '',
    player_seasons: [{ season_id: 'season', stats }],
  };
}

const base = {
  games_played: 82,
  field_goals_made: 8,
  field_goals_attempted: 16,
  field_goal_percentage: 0.5,
  free_throws_made: 5,
  free_throws_attempted: 6,
  free_throw_percentage: 0.833,
  three_pointers_made: 2,
  total_rebounds: 6,
  assists: 5,
  steals: 1,
  blocks: 0.5,
  points: 23,
};

describe('player shape analytics', () => {
  it('produces eight fantasy-native percentile axes', () => {
    const pool = [
      player('low', { ...base, points: 10, total_rebounds: 3 }),
      player('mid', base),
      player('high', { ...base, points: 30, total_rebounds: 10 }),
    ];
    const shapes = buildPlayerShapes(pool);
    const high = shapes.get('high');
    expect(high?.metrics).toHaveLength(8);
    expect(high?.metrics.find((metric) => metric.key === 'pts')?.percentile).toBeGreaterThan(90);
    expect(high?.metrics.find((metric) => metric.key === 'reb')?.percentile).toBeGreaterThan(90);
  });

  it('accounts for shooting volume in impact axes', () => {
    const lowVolume = player('low-volume', { ...base, field_goal_percentage: 0.55, field_goals_made: 2, field_goals_attempted: 3.64 });
    const highVolume = player('high-volume', { ...base, field_goal_percentage: 0.55, field_goals_made: 11, field_goals_attempted: 20 });
    const baseline = player('baseline', { ...base, field_goal_percentage: 0.48, field_goals_made: 7, field_goals_attempted: 14.58 });
    const shapes = buildPlayerShapes([lowVolume, highVolume, baseline]);
    const low = shapes.get('low-volume')?.metrics.find((metric) => metric.key === 'fgImpact');
    const high = shapes.get('high-volume')?.metrics.find((metric) => metric.key === 'fgImpact');
    expect((high?.raw ?? 0)).toBeGreaterThan(low?.raw ?? 0);
  });

  it('rates identical shapes as a perfect match and orders closest matches first', () => {
    const a = player('a', base);
    const b = player('b', { ...base });
    const c = player('c', { ...base, points: 8, assists: 1, total_rebounds: 2, blocks: 2.5 });
    const shapes = buildPlayerShapes([a, b, c]);
    expect(shapeSimilarity(shapes.get('a')!, shapes.get('b')!)).toBe(100);
    expect(closestShapeMatches('a', shapes, 1)[0]?.playerId).toBe('b');
  });
});
