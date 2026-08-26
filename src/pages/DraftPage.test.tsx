import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DraftPick } from '@/api/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useDraftSettings: vi.fn(() => ({
    data: {
      status: 'running',
      draft_type: 'snake',
      league_size: 10,
      roster_size: 15,
      pick_time_limit_seconds: 120,
      turn_deadline_at: null,
      paused_remaining_seconds: null,
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
  useRosters: vi.fn(() => ({ data: [] })),
}));

const undoMutate = vi.fn();
const skipMutate = vi.fn();
vi.mock('@/api/draftTurnActions', () => ({
  useUndoDraftActionForSlot: vi.fn(() => ({ mutate: undoMutate, isPending: false })),
  useSkipPickForSlot: vi.fn(() => ({ mutate: skipMutate, isPending: false })),
}));

vi.mock('@/api/realtime', () => ({ useDraftRealtime: vi.fn(), useRealtimeStatus: () => 'connected' }));
vi.mock('@/hooks/useCanPickNow', () => ({ useCanPickNow: vi.fn(() => true) }));

let profile: { team_id: string | null; is_admin: boolean } | null = {
  team_id: 't1',
  is_admin: false,
};
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { useDraftPicks, useDraftSettings } from '@/api/queries';
import { useOfflineQueue } from '@/api/offlineQueue';
import { DraftPage } from './DraftPage';

const mockedPicks = vi.mocked(useDraftPicks);
const mockedSettings = vi.mocked(useDraftSettings);

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

const runningSettings = {
  status: 'running',
  draft_type: 'snake',
  league_size: 10,
  roster_size: 15,
  pick_time_limit_seconds: 120,
  turn_deadline_at: null,
  paused_remaining_seconds: null,
  updated_at: '2026-08-25T12:00:00Z',
};

describe('DraftPage', () => {
  beforeEach(() => {
    undoMutate.mockReset();
    skipMutate.mockReset();
    profile = { team_id: 't1', is_admin: false };
    useOfflineQueue.setState({ queue: [] });
    mockedPicks.mockReturnValue({ data: [], isLoading: false } as never);
    mockedSettings.mockReturnValue({ data: runningSettings } as never);
  });

  it('renders board rounds and slots from picks', () => {
    mockedPicks.mockReturnValue({
      data: [
        pick({
          id: 'p1',
          round: 1,
          pick_number: 1,
          team_id: 't1',
          is_used: true,
          player_id: 'pl-drafted',
          players: { name: 'Drafted Star' } as DraftPick['players'],
        }),
        pick({ id: 'p2', round: 2, pick_number: 2, team_id: 't2', is_used: false }),
      ],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.getByText('2026-27 Draft')).toBeInTheDocument();
    expect(screen.getAllByText('Round')).toHaveLength(2);
    expect(screen.getAllByText('Drafted Star').length).toBe(2);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('shows Player Pool and skip actions when it is your running pick', () => {
    mockedPicks.mockReturnValue({ data: [pick({ id: 'turn-1', team_id: 't1' })], isLoading: false } as never);

    render(<DraftPage />);

    expect(screen.getByText('YOUR PICK')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Player Pool/i })).toHaveAttribute('href', '/pool');
    expect(screen.getByRole('button', { name: /^Skip$/i })).toBeEnabled();
  });

  it('shows the next owned pick when another team is on the clock', () => {
    profile = { team_id: 't2', is_admin: false };
    mockedPicks.mockReturnValue({
      data: [
        pick({ id: 'p1', pick_number: 1, team_id: 't1' }),
        pick({ id: 'p2', pick_number: 2, team_id: 't1' }),
        pick({ id: 'p3', pick_number: 3, team_id: 't2' }),
      ],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.getByText(/Your next pick is #3 · 2 picks away/)).toBeInTheDocument();
  });

  it('locks pick actions while paused', () => {
    mockedSettings.mockReturnValue({
      data: { ...runningSettings, status: 'paused', paused_remaining_seconds: 47 },
    } as never);
    mockedPicks.mockReturnValue({ data: [pick({ id: 'turn-1', team_id: 't1' })], isLoading: false } as never);

    render(<DraftPage />);

    expect(screen.getByText('YOUR PICK · WAITING FOR RESUME')).toBeInTheDocument();
    expect(screen.getByText(/Draft actions are locked while paused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Skip$/i })).toBeDisabled();
  });

  it('queued offline pick shows exact slot context', () => {
    mockedPicks.mockReturnValue({ data: [pick({ id: 'turn-1', team_id: 't1' })], isLoading: false } as never);
    useOfflineQueue.setState({
      queue: [{ seasonId: 's1', pickId: 'turn-1', pickNumber: 1, playerId: 'q1', playerName: 'Queued Guy', queuedAt: 1 }],
    });

    render(<DraftPage />);

    expect(screen.getByText(/#1 Queued Guy/)).toBeInTheDocument();
    expect(screen.getByText(/stale intent will be rejected/i)).toBeInTheDocument();
  });

  it('skip confirmation submits the exact current pick id', async () => {
    const user = userEvent.setup();
    mockedPicks.mockReturnValue({ data: [pick({ id: 'turn-7', pick_number: 7, team_id: 't1' })], isLoading: false } as never);

    render(<DraftPage />);
    await user.click(screen.getByRole('button', { name: /^Skip$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Skip pick' }));
    expect(skipMutate).toHaveBeenCalledWith(
      { pickId: 'turn-7', pickNumber: 7 },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('undo confirmation submits the exact last action id', async () => {
    const user = userEvent.setup();
    mockedPicks.mockReturnValue({
      data: [
        pick({ id: 'done-1', team_id: 't1', is_used: true, player_id: 'pl1', players: { name: 'Drafted Star' } as DraftPick['players'] }),
        pick({ id: 'next', pick_number: 2, team_id: 't2' }),
      ],
      isLoading: false,
    } as never);

    render(<DraftPage />);
    await user.click(screen.getByRole('button', { name: 'Undo last action' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Undo action' }));
    expect(undoMutate).toHaveBeenCalledWith(
      { pickId: 'done-1' },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });
});
