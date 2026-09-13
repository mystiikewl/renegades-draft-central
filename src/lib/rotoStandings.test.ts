import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { rotoStandings } from './rotoStandings';

function player(id: string, stats: Record<string, number>): PlayerWithStats {
  return {
    id,
    name: id,
    position: 'G',
    nba_team: null,
    espn_id: id,
    image_url: null,
    created_at: '',
    player_seasons: [{ season_id: 's1', stats: { games_played: 2, ...stats } }],
  };
}

describe('rotoStandings', () => {
  it('awards standings points per category, inverting lower-is-better cats', () => {
    const teams = [
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ];
    // gp=2 everywhere. pts totals: A=50, B=60 -> B wins PTS. to totals: A=6, B=10 -> A wins TO (inverted).
    const playersByTeam = new Map([
      ['A', [player('a1', { points: 25, turnovers: 3 })]],
      ['B', [player('b1', { points: 30, turnovers: 5 })]],
    ]);

    const rows = rotoStandings(teams, playersByTeam);

    const alpha = rows.find((row) => row.teamId === 'A')!;
    const beta = rows.find((row) => row.teamId === 'B')!;
    expect(alpha.totals.pts).toBe(50);
    expect(beta.totals.pts).toBe(60);
    expect(alpha.points.pts).toBe(1);
    expect(beta.points.pts).toBe(2);
    expect(alpha.points.to).toBe(2);
    expect(beta.points.to).toBe(1);
    // The 11 all-zero categories are ties: standings points fall back to team
    // order (2 for the earlier team, 1 for the later), so Alpha nets
    // 11*2 + to(2) + pts(1) = 25 and Beta 11*1 + pts(2) + to(1) = 14.
    expect(alpha.totalPoints).toBe(25);
    expect(beta.totalPoints).toBe(14);
  });

  it('ranks teams by total standings points', () => {
    const teams = [
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
      { id: 'C', name: 'Gamma' },
    ];
    // tier 1/2/3 (A/B/C) strictly orders every category, turnovers included
    // (lower wins), so points are exactly 3/2/1 per category and totals 39/26/13.
    const line = (t: number) => ({
      points: t * 10,
      total_rebounds: t * 5,
      turnovers: 6 - t,
      field_goals_made: t * 4,
      field_goals_attempted: t * 8,
      field_goal_percentage: 0.4 + t * 0.05,
      free_throws_made: t * 3,
      free_throw_percentage: 0.7 + t * 0.05,
      three_pointers_made: t * 2,
      three_point_percentage: 0.3 + t * 0.04,
      assists: t * 4,
      steals: t,
      blocks: t * 0.5,
      double_doubles: t * 10,
      triple_doubles: t,
    });
    const playersByTeam = new Map([
      ['A', [player('a1', line(1))]],
      ['B', [player('b1', line(2))]],
      ['C', [player('c1', line(3))]],
    ]);

    const rows = rotoStandings(teams, playersByTeam);

    expect(rows.map((row) => row.teamId)).toEqual(['C', 'B', 'A']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows[0].totalPoints).toBe(39);
    expect(rows[1].totalPoints).toBe(26);
    expect(rows[2].totalPoints).toBe(13);
  });

  it('handles teams with empty rosters', () => {
    const rows = rotoStandings([{ id: 'A', name: 'Alpha' }], new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0].totalPoints).toBeGreaterThan(0);
  });
});
