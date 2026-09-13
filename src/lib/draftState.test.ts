import { describe, expect, it } from 'vitest';
import type { DraftPick, Team } from '@/api/types';
import { nextPick, teamById } from './draftState';

function pick(partial: Partial<DraftPick>): DraftPick {
  return {
    id: 'p1',
    season_id: 's1',
    round: 1,
    pick_number: 1,
    team_id: 't1',
    original_team_id: 't1',
    player_id: null,
    is_used: false,
    picked_at: null,
    ...partial,
  } as DraftPick;
}

describe('nextPick', () => {
  it('returns the first unused pick in list order', () => {
    const picks = [
      pick({ id: 'a', pick_number: 1, is_used: true }),
      pick({ id: 'b', pick_number: 2, is_used: false }),
      pick({ id: 'c', pick_number: 3, is_used: false }),
    ];
    expect(nextPick(picks)?.id).toBe('b');
  });

  it('returns null when every pick is used or the board is empty', () => {
    expect(nextPick([pick({ is_used: true })])).toBeNull();
    expect(nextPick([])).toBeNull();
  });
});

describe('teamById', () => {
  it('indexes teams by id and tolerates a missing list', () => {
    const teams = [{ id: 't1', name: 'Alpha', owner_profile_id: null, created_at: '' }] as Team[];
    const index = teamById(teams);
    expect(index.get('t1')?.name).toBe('Alpha');
    expect(index.get('t2')).toBeUndefined();
    expect(teamById(undefined).size).toBe(0);
  });
});
