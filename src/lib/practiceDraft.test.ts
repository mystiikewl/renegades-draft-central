import { describe, expect, it } from 'vitest';
import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import {
  CPU_STRATEGIES,
  assignCpuSkills,
  assignCpuStrategies,
  availablePracticePlayers,
  buildPracticeBoard,
  buildPracticeOrder,
  chooseCpuPracticePlayer,
  cpuPracticeShortlist,
  cpuThinkDelayMs,
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

/** A player whose only production is points, so z-score tests stay hand-checkable. */
function sparsePlayer(
  id: string,
  name: string,
  position: string,
  pointsPerGame: number,
  games = 70,
): PlayerWithStats {
  return player(id, name, position, {
    games_played: games,
    points: pointsPerGame,
    field_goals_made: 0,
    three_pointers_made: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    double_doubles: 0,
    triple_doubles: 0,
  });
}

/** Mid-sequence noise leaves every candidate untouched: (0.5 * 2 - 1) === 0. */
const NEUTRAL_RANDOM = () => 0.5;

/** Deterministic pseudo-random that walks a fixed value sequence. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe('practice draft engine', () => {
  it('generates the same keeper-adjusted snake rounds as draft finalization', () => {
    const board = buildPracticeBoard(settings);

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
    const board = buildPracticeBoard(settings, ['team-c', 'team-a', 'team-b']);

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

  it('assigns per-bot skill jitter only to CPU managers and inside [-1, 1]', () => {
    const skills = assignCpuSkills(['team-a', 'team-human', 'team-b'], 'team-human', () => 0.75);

    expect(skills['team-human']).toBeUndefined();
    expect(skills['team-a']).toBe(0.5);
    expect(skills['team-b']).toBe(0.5);
  });

  it('applies picks only to the supplied in-memory board and removes selected players from availability', () => {
    const board = buildPracticeBoard(settings);
    const alpha = player('alpha', 'Alpha');
    const beta = player('beta', 'Beta');

    const afterPick = makePracticePick(board, board[0].id, alpha);

    expect(board[0].is_used).toBe(false);
    expect(afterPick[0].is_used).toBe(true);
    expect(afterPick[0].player_id).toBe('alpha');
    expect(availablePracticePlayers([alpha, beta], afterPick).map((p) => p.id)).toEqual(['beta']);
  });

  it('does not allow the same player to be drafted twice and can skip locally', () => {
    const board = buildPracticeBoard(settings);
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

    const pick = chooseCpuPracticePlayer(pool, pool, [], 'big-heavy', { random: NEUTRAL_RANDOM });

    expect(pick?.id).toBe('big');
  });

  it('reproduces the same pick from the same seeded randomness', () => {
    const pool = [
      sparsePlayer('alpha', 'Alpha Star', 'PG', 30),
      sparsePlayer('beta', 'Beta Star', 'PG', 24),
      sparsePlayer('mid-one', 'Mid One', 'PG', 10),
      sparsePlayer('mid-two', 'Mid Two', 'PG', 10),
    ];

    const first = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'veteran',
      random: sequence(0.5, 0.5, 0.5, 0.5),
    });
    const second = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'veteran',
      random: sequence(0.5, 0.5, 0.5, 0.5),
    });

    expect(first?.id).toBe('alpha');
    expect(second?.id).toBe(first?.id);
  });

  it('lets rookie variance reach past top value while elite stays sharp', () => {
    const pool = [
      sparsePlayer('alpha', 'Alpha Star', 'PG', 30),
      sparsePlayer('beta', 'Beta Star', 'PG', 24),
      sparsePlayer('mid-one', 'Mid One', 'PG', 10),
      sparsePlayer('mid-two', 'Mid Two', 'PG', 10),
    ];
    const wobble = sequence(0, 1, 0.5, 0.5);

    const rookie = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'rookie',
      random: sequence(0, 1, 0.5, 0.5),
    });
    const elite = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'elite',
      random: wobble,
    });
    expect(rookie?.id).toBe('beta');
    expect(elite?.id).toBe('alpha');
  });

  it('discounts injury risk for sharp CPUs but not for rookies', () => {
    const healthy = sparsePlayer('healthy', 'Anchor', 'PG', 24, 70); // 1680 total pts
    const fragile = sparsePlayer('fragile', 'Zeus', 'PG', 67.9, 25); // 1697.5 total pts
    const pool = [
      healthy,
      fragile,
      sparsePlayer('mid-one', 'Mid One', 'PG', 10),
      sparsePlayer('mid-two', 'Mid Two', 'PG', 10),
    ];

    const elite = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'elite',
      random: NEUTRAL_RANDOM,
    });
    const rookie = chooseCpuPracticePlayer(pool, pool, [], 'balanced', {
      difficulty: 'rookie',
      random: NEUTRAL_RANDOM,
    });

    expect(elite?.id).toBe('healthy');
    expect(rookie?.id).toBe('fragile');
  });

  it('fills a missing position under coverage pressure only when disciplined', () => {
    const ace = sparsePlayer('ace', 'Ace Guard', 'PG', 30);
    const big = sparsePlayer('big', 'Big Man', 'C', 28);
    const available = [
      ace,
      big,
      sparsePlayer('pg-filler', 'PG Filler', 'PG', 10),
      sparsePlayer('c-filler', 'C Filler', 'C', 10),
    ];
    const roster = [
      sparsePlayer('r1', 'R One', 'PG', 10),
      sparsePlayer('r2', 'R Two', 'PG', 10),
      sparsePlayer('r3', 'R Three', 'PG', 10),
    ];
    const fullPool = [...available, ...roster];
    const rosterIds = roster.map((entry) => entry.id);

    const elite = chooseCpuPracticePlayer(available, fullPool, rosterIds, 'balanced', {
      difficulty: 'elite',
      random: NEUTRAL_RANDOM,
    });
    const rookie = chooseCpuPracticePlayer(available, fullPool, rosterIds, 'balanced', {
      difficulty: 'rookie',
      random: NEUTRAL_RANDOM,
    });

    expect(elite?.id).toBe('big');
    expect(rookie?.id).toBe('ace');
  });

  it('publishes a live shortlist of the top candidates', () => {
    const pool = [
      sparsePlayer('alpha', 'Alpha Star', 'PG', 30),
      sparsePlayer('beta', 'Beta Star', 'PG', 24),
      sparsePlayer('mid-one', 'Mid One', 'PG', 10),
      sparsePlayer('mid-two', 'Mid Two', 'PG', 10),
    ];

    const shortlist = cpuPracticeShortlist(pool, pool, [], 'balanced', {
      difficulty: 'veteran',
      random: NEUTRAL_RANDOM,
    });

    expect(shortlist.map((entry) => entry.id)).toEqual(['alpha', 'beta', 'mid-one']);
  });

  it('thinks deliberately early and quicker deep in the draft', () => {
    expect(cpuThinkDelayMs(1, 100, () => 0.5)).toBe(2160);
    expect(cpuThinkDelayMs(100, 100, () => 0.5)).toBe(990);
    const loosest = cpuThinkDelayMs(1, 100, () => 1);
    const tightest = cpuThinkDelayMs(1, 100, () => 0);
    expect(tightest).toBeGreaterThanOrEqual(2400 * 0.65);
    expect(loosest).toBeLessThanOrEqual(2400 * 1.15);
  });
});
