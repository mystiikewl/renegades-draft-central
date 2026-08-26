import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DraftPick, PlayerWithStats } from '@/api/types';

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useDraftSettings: vi.fn(() => ({
    data: {
      status: 'running',
      draft_type: 'snake',
      league_size: 10,
      roster_size: 15,
      pick_time_limit_seconds: 120,
      updated_at: '2026-08-25T12:00:00Z',
    },
  })),
  useDraftPicks: vi.fn(() => ({ data: [], isLoading: false })),
  useTeams: vi.fn(() => ({
    data: [
      { id: 't1', name: 'Alpha Team' },
      { id: 't2', name: 'Beta Team' },
    ],
  })),
  usePlayerPool: vi.fn(() => ({ data: [], isLoading: false })),
}));

const mutate = vi.fn();
vi.mock('@/api/mutations', () => ({
  useMakePick: vi.fn(() => ({ mutate, isPending: false })),
}));

vi.mock('@/api/realtime', () => ({ useDraftRealtime: vi.fn(), useRealtimeStatus: () => 'connected' }));
vi.mock('@/api/gameLog', () => ({ useGameLog: vi.fn(() => ({ data: undefined, isLoading: false })) }));

let profile: { team_id: string | null; is_admin: boolean } | null = {
  team_id: 't1',
  is_admin: false,
};
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

import { useDraftPicks, usePlayerPool } from '@/api/queries';
import { useOfflineQueue } from '@/api/offlineQueue';
import { PlayerPoolPage } from './PlayerPoolPage';

const mockedPicks = vi.mocked(useDraftPicks);
const mockedPool = vi.mocked(usePlayerPool);

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
    players: null,
    team: null,
    ...partial,
  } as DraftPick;
}

function player(partial: Partial<PlayerWithStats> = {}): PlayerWithStats {
  return {
    id: 'pl1',
    name: 'Test Player',
    position: 'PG',
    nba_team: 'BOS',
    espn_id: '1',
    player_seasons: [{ stats: { points: 25.1, total_rebounds: 4.2, assists: 6.7, games_played: 70 } }],
    ...partial,
  } as PlayerWithStats;
}

describe('PlayerPoolPage', () => {
  beforeEach(() => {
    mutate.mockReset();
    profile = { team_id: 't1', is_admin: false };
    useOfflineQueue.setState({ queue: [] });
    mockedPicks.mockReturnValue({ data: [], isLoading: false } as never);
    mockedPool.mockReturnValue({ data: [] as PlayerWithStats[], isLoading: false } as never);
  });

  it('renders players with stats', () => {
    mockedPool.mockReturnValue({ data: [player()], isLoading: false } as never);

    render(<PlayerPoolPage />);

    expect(screen.getByText('Test Player')).toBeInTheDocument();
    expect(screen.getByText('25.1')).toBeInTheDocument();
    expect(screen.getByText('BOS · PG')).toBeInTheDocument();
  });

  it("shows the on-clock banner with compact your-turn state", () => {
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);

    render(<PlayerPoolPage />);

    expect(screen.getAllByText('Alpha Team').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Your pick')).toBeInTheDocument();
  });

  it('row click opens the profile dialog; confirm calls makePick with player id/name', async () => {
    const user = userEvent.setup();
    const guy = player({ id: 'pl1', name: 'Confirm Me' });
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);
    mockedPool.mockReturnValue({ data: [guy], isLoading: false } as never);

    render(<PlayerPoolPage />);

    await user.click(screen.getByText('Confirm Me'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Confirm Me')).toBeInTheDocument();
    expect(within(dialog).getByText('BOS')).toBeInTheDocument();

    // Both desktop and mobile action markup remains intentionally tolerant.
    const draftButtons = within(dialog).getAllByRole('button', { name: /pick|draft/i });
    expect(draftButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(draftButtons[0]);
    expect(mutate).toHaveBeenCalledWith(
      { playerId: 'pl1', playerName: 'Confirm Me' },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it("does not show a draft action when it isn't your turn", async () => {
    const user = userEvent.setup();
    profile = { team_id: 't2', is_admin: false };
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);
    mockedPool.mockReturnValue({ data: [player()], isLoading: false } as never);

    render(<PlayerPoolPage />);

    expect(screen.getByText('On clock')).toBeInTheDocument();

    await user.click(screen.getByText('Test Player'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /pick|draft/i })).not.toBeInTheDocument();
  });

  it('queued offline pick shows the banner and blocks re-picking from the dialog', async () => {
    const user = userEvent.setup();
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);
    mockedPool.mockReturnValue({
      data: [player({ id: 'q1', name: 'Queued Guy' })],
      isLoading: false,
    } as never);
    useOfflineQueue.setState({
      queue: [{ seasonId: 's1', playerId: 'q1', playerName: 'Queued Guy', queuedAt: 1 }],
    });

    render(<PlayerPoolPage />);

    expect(screen.getByText(/Offline — 1 pick queued/)).toBeInTheDocument();

    await user.click(screen.getByText('Queued Guy'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /pick|draft/i })).not.toBeInTheDocument();
  });
});
