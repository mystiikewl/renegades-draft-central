import { describe, expect, it } from 'vitest';
import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import {
  availablePracticePlayers,
  buildPracticeBoard,
  makePracticePick,
  skipPracticePick,
} from './practiceDraft';

const settings: DraftSettings = {
  id: 'settings-1',
  season_id: 'season-1',
  league_size: 3,
  roster_size: 2,
  keeper_limit: 2,
  draft_type: 'snake',
  status: 'pre_draft',
  draft_order: ['team-a', 'team-b', 'team-c'],
  updated_at: '2026-08-27T00:00:00Z',
};

function player(id: string, name: string): PlayerWithStats {
  return {
    id,
    espn_id: id,
    name,
    position: 'PG',
    nba_team: 'BOS',
    image_url: null,
    created_at: '2026-08-27T00:00:00Z',
    player_seasons: [{
      season_id: 'season-1',
      stats: {
        games_played: 70,
        points: 20,
        total_rebounds: 5,
        assists: 5,
        steals: 1,
        blocks: 1,
        turnovers: 2,
      },
    }],
  };
}

describe('practice draft engine', () => {
  it('generates a local snake board from configured order when no real board exists', () => {
    const board = buildPracticeBoard(settings, []);

    expect(board).toHaveLength(6);
    expect(board.map((pick) => pick.team_id)).toEqual([
      'team-a', 'team-b', 'team-c',
      'team-c', 'team-b', 'team-a',
    ]);
    expect(board.every((pick) => !pick.is_used && pick.player_id === null)).toBe(true);
  });

  it('clones real slot ownership but strips every live draft result', () => {
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
});
