import { beforeEach, describe, expect, it } from 'vitest';
import type { DraftPick, PlayerWithStats } from '@/api/types';
import type { CpuDifficulty, CpuDraftStrategy } from '@/lib/practiceDraft';
import { usePracticeDraftSession } from './practiceDraftSession';

const STORAGE_KEY = 'renegades-practice-draft-session';

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

interface SessionOverrides {
  selectedSlot?: number;
  draftOrder?: string[];
  cpuStrategies?: Record<string, CpuDraftStrategy>;
  cpuSkills?: Record<string, number>;
  difficulty?: CpuDifficulty;
}

function startSession(overrides: SessionOverrides = {}) {
  usePracticeDraftSession.getState().start({
    seasonId: 'season-1',
    humanTeamId: 'team-human',
    selectedSlot: 1,
    draftOrder: ['team-human'],
    cpuStrategies: {},
    cpuSkills: {},
    difficulty: 'veteran',
    picks: [pick],
    ...overrides,
  });
}

describe('practice draft session store', () => {
  beforeEach(() => {
    localStorage.clear();
    usePracticeDraftSession.getState().end();
  });

  it('keeps an active simulation in shared app state until explicitly ended', () => {
    startSession({
      selectedSlot: 3,
      draftOrder: ['team-a', 'team-b', 'team-human'],
      cpuStrategies: { 'team-a': 'balanced', 'team-b': 'big-heavy' },
      cpuSkills: { 'team-a': 0.4, 'team-b': -0.6 },
      difficulty: 'elite',
    });

    const active = usePracticeDraftSession.getState();
    expect(active.active).toBe(true);
    expect(active.seasonId).toBe('season-1');
    expect(active.selectedSlot).toBe(3);
    expect(active.difficulty).toBe('elite');
    expect(active.cpuSkills['team-b']).toBe(-0.6);
    expect(active.picks).toHaveLength(1);
  });

  it('applies a human pick to the exact in-memory slot', () => {
    startSession();

    usePracticeDraftSession.getState().makeHumanPick('practice-1', player);

    const [selected] = usePracticeDraftSession.getState().picks;
    expect(selected.is_used).toBe(true);
    expect(selected.player_id).toBe('player-1');
    expect(selected.players?.name).toBe('Test Player');
  });

  it('clears all practice context when the simulation ends', () => {
    startSession({
      selectedSlot: 2,
      draftOrder: ['team-a', 'team-human'],
      cpuStrategies: { 'team-a': 'punt-ft' },
    });

    usePracticeDraftSession.getState().end();
    const state = usePracticeDraftSession.getState();

    expect(state.active).toBe(false);
    expect(state.seasonId).toBeNull();
    expect(state.humanTeamId).toBeNull();
    expect(state.picks).toEqual([]);
    expect(state.draftOrder).toEqual([]);
  });

  it('persists the running simulation so a page refresh can resume it', () => {
    startSession({
      selectedSlot: 4,
      draftOrder: ['team-a', 'team-human'],
      cpuSkills: { 'team-a': 0.5 },
      difficulty: 'rookie',
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string);
    expect(stored.version).toBe(1);
    expect(stored.state.active).toBe(true);
    expect(stored.state.selectedSlot).toBe(4);
    expect(stored.state.difficulty).toBe('rookie');
    expect(stored.state.cpuSkills['team-a']).toBe(0.5);
    // The ephemeral thinking flag stays out of storage.
    expect(stored.state.cpuThinking).toBeUndefined();
  });

  it('persists the cleared state when the simulation ends', () => {
    startSession();
    usePracticeDraftSession.getState().end();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.state.active).toBe(false);
    expect(stored.state.picks).toEqual([]);
  });
});
