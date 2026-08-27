import { describe, expect, it } from 'vitest';
import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import {
  CPU_STRATEGIES,
  assignCpuStrategies,
  availablePracticePlayers,
  buildPracticeBoard,
  buildPracticeOrder,
  chooseCpuPracticePlayer,
  makePracticePick,
  skipPracticePick,
} from './practiceDraft';

const settings: DraftSettings = {
  id: 'settings-1',
  season_id: 'season-1',
  league_size: 3,
  roster_size: 4,
  keeper_limit: 2,
  draft_type: 'snake',
  status: 'pre_draft',
  draft_order: ['team-a', 'team-b', 'team-c'],
  updated_at: '2026-08-27T00:00:00Z',
};

function player(
  id: string,
  name: string,
  position = 'PG',
  overrides: Record<string, number> = {},
): PlayerWithStats {
  return {
    id,
    espn_id: id,
    name,
    position,
    nba_team: 'BOS',
    image_url: null,
    created_at: '2026-08-27T00:00:00Z',
    player_seasons: [{
      season_id: 'season-1',
      stats: {
        games_played: 70,
        field_goals_made: 7,
        field_goal_percentage: 0.48,
        free_throw_percentage: 0.8,
        three_pointers_made: 2,
        three_point_percentage: 0.36,
        total_rebounds: 5,
        assists: 5,
        steals: 1,
        blocks: 1,
        turnovers: 2,
        double_doubles: 2,
        triple_doubles: 0,
        points: 20,
        ...overrides,
      },
    }],
  };
}

describe('practice draft engine', () => {
  it('generates the same keeper-adjusted snake rounds as draft finalization', () => {
    const board = buildPracticeBoard(settings, []);

    expect(board).toHaveLength(6);
    expect(board.map((pick) => pick.team_id)).toEqual([
      'team-a', 'team-b', 'team-c',
      'team-c', 'team-b', 'team-a',
    ]);
    expect(board.every((pick) => !pick.is_used && pick.player_id === null)).toBe(true);
  });

  it('puts the user in their chosen draft slot while randomising the CPU seats', () => {
    const order = buildPracticeOrder(
      ['team-a', 'team-b', 'team-c', 'team-d'],
      'team-a',
      3,
      () => 0,
    );

    expect(order).toHaveLength(4);
    expect(order[2]).toBe('team-a');
    expect(new Set(order)).toEqual(new Set(['team-a', 'team-b', 'team-c', 'team-d']));
  });

  it('uses the selected practice order instead of the live league order', () => {
    const board = buildPracticeBoard(settings, [], ['team-c', 'team-a', 'team-b']);

    expect(board.slice(0, 3).map((pick) => pick.team_id)).toEqual(['team-c', 'team-a', 'team-b']);
    expect(board.slice(3).map((pick) => pick.team_id)).toEqual(['team-b', 'team-a', 'team-c']);
  });

  it('assigns CPU strategies without assigning one to the human manager', () => {
    const strategies = assignCpuStrategies(
      ['team-a', 'team-b', 'team-c'],
      'team-a',
      () => 0.25,
    );

    expect(strategies['team-a']).toBeUndefined();
    expect(CPU_STRATEGIES.map((item) => item.key)).toContain(strategies['team-b']);
    expect(CPU_STRATEGIES.map((item) => item.key)).toContain(strategies['team-c']);
  });

  it('clones real slot ownership but strips every live draft result in legacy mode', () => {
    const livePick: DraftPick = {
      id: 'live-1',
      season_id: 'season-1',
      round: 1,
      pick_number: 1,
      team_id: 'team-b',
      original_team_id: 'team-a',
      player_id: 'player-live',
      is_used: true,
      is_skipped: false,
      picked_at: '2026-08-27T01:00:00Z',
      players: { name: 'Live Player', position: 'C', nba_team: 'NYK', espn_id: '99' },
    };

    const [practicePick] = buildPracticeBoard(settings, [livePick]);

    expect(practicePick.team_id).toBe('team-b');
    expect(practicePick.original_team_id).toBe('team-a');
    expect(practicePick.player_id).toBeNull();
    expect(practicePick.players).toBeNull();
    expect(practicePick.is_used).toBe(false);
    expect(practicePick.picked_at).toBeNull();
  });

  it('applies picks only to the supplied in-memory board and removes selected players from availability', () => {
    const board = buildPracticeBoard(settings, []);
    const alpha = player('alpha', 'Alpha');
    const beta = player('beta', 'Beta');

    const afterPick = makePracticePick(board, board[0].id, alpha);

    expect(board[0].is_used).toBe(false);
    expect(afterPick[0].is_used).toBe(true);
    expect(afterPick[0].player_id).toBe('alpha');
    expect(availablePracticePlayers([alpha, beta], afterPick).map((p) => p.id)).toEqual(['beta']);
  });

  it('does not allow the same player to be drafted twice and can skip locally', () => {
    const board = buildPracticeBoard(settings, []);
    const alpha = player('alpha', 'Alpha');
    const first = makePracticePick(board, board[0].id, alpha);
    const duplicate = makePracticePick(first, board[1].id, alpha);
    const skipped = skipPracticePick(duplicate, board[1].id);

    expect(duplicate[1].is_used).toBe(false);
    expect(skipped[1].is_used).toBe(true);
    expect(skipped[1].is_skipped).toBe(true);
    expect(skipped[1].player_id).toBeNull();
  });

  it('lets a big-heavy CPU favour a strong interior profile', () => {
    const guard = player('guard', 'Guard Star', 'PG', {
      points: 27,
      assists: 9,
      three_pointers_made: 4,
      blocks: 0.2,
      total_rebounds: 3,
      field_goal_percentage: 0.43,
    });
    const big = player('big', 'Big Star', 'C', {
      points: 20,
      assists: 2,
      three_pointers_made: 0.2,
      blocks: 3,
      total_rebounds: 13,
      field_goal_percentage: 0.64,
      double_doubles: 50,
    });
    const neutral = player('neutral', 'Neutral Wing', 'SF');
    const pool = [guard, big, neutral];

    const pick = chooseCpuPracticePlayer(pool, pool, [], 'big-heavy');

    expect(pick?.id).toBe('big');
  });
});
