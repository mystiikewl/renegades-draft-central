import { beforeEach, describe, expect, it } from 'vitest';
import type { DraftPick, PlayerWithStats } from '@/api/types';
import { usePracticeDraftSession } from './practiceDraftSession';

const pick: DraftPick = {
  id: 'practice-1',
  season_id: 'season-1',
  round: 1,
  pick_number: 1,
  team_id: 'team-human',
  original_team_id: 'team-human',
  player_id: null,
  is_used: false,
  is_skipped: false,
  skipped_at: null,
  picked_at: null,
  players: null,
  team: null,
};

const player: PlayerWithStats = {
  id: 'player-1',
  espn_id: '100',
  name: 'Test Player',
  position: 'PG',
  nba_team: 'BOS',
  image_url: null,
  created_at: '2026-08-27T00:00:00Z',
  player_seasons: [{
    season_id: 'season-1',
    stats: { games_played: 70, points: 20 },
  }],
};

describe('practice draft session store', () => {
  beforeEach(() => usePracticeDraftSession.getState().end());

  it('keeps an active simulation in shared app state until explicitly ended', () => {
    usePracticeDraftSession.getState().start({
      seasonId: 'season-1',
      humanTeamId: 'team-human',
      selectedSlot: 3,
      draftOrder: ['team-a', 'team-b', 'team-human'],
      cpuStrategies: { 'team-a': 'balanced', 'team-b': 'big-heavy' },
      picks: [pick],
    });

    const active = usePracticeDraftSession.getState();
    expect(active.active).toBe(true);
    expect(active.seasonId).toBe('season-1');
    expect(active.selectedSlot).toBe(3);
    expect(active.picks).toHaveLength(1);
  });

  it('applies a human pick to the exact in-memory slot', () => {
    usePracticeDraftSession.getState().start({
      seasonId: 'season-1',
      humanTeamId: 'team-human',
      selectedSlot: 1,
      draftOrder: ['team-human'],
      cpuStrategies: {},
      picks: [pick],
    });

    usePracticeDraftSession.getState().makeHumanPick('practice-1', player);

    const [selected] = usePracticeDraftSession.getState().picks;
    expect(selected.is_used).toBe(true);
    expect(selected.player_id).toBe('player-1');
    expect(selected.players?.name).toBe('Test Player');
  });

  it('clears all practice context when the simulation ends', () => {
    usePracticeDraftSession.getState().start({
      seasonId: 'season-1',
      humanTeamId: 'team-human',
      selectedSlot: 2,
      draftOrder: ['team-a', 'team-human'],
      cpuStrategies: { 'team-a': 'punt-ft' },
      picks: [pick],
    });

    usePracticeDraftSession.getState().end();
    const state = usePracticeDraftSession.getState();

    expect(state.active).toBe(false);
    expect(state.seasonId).toBeNull();
    expect(state.humanTeamId).toBeNull();
    expect(state.picks).toEqual([]);
    expect(state.draftOrder).toEqual([]);
  });
});
