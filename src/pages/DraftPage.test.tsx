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
}));

const undoMutate = vi.fn();
vi.mock('@/api/mutations', () => ({
  useUndoLastPick: vi.fn(() => ({ mutate: undoMutate, isPending: false })),
}));

vi.mock('@/api/realtime', () => ({ useDraftRealtime: vi.fn(), useRealtimeStatus: () => 'connected' }));

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

import { useDraftPicks } from '@/api/queries';
import { useOfflineQueue } from '@/api/offlineQueue';
import { DraftPage } from './DraftPage';

const mockedPicks = vi.mocked(useDraftPicks);

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

describe('DraftPage', () => {
  beforeEach(() => {
    undoMutate.mockReset();
    profile = { team_id: 't1', is_admin: false };
    useOfflineQueue.setState({ queue: [] });
    mockedPicks.mockReturnValue({ data: [], isLoading: false } as never);
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
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getAllByText('Drafted Star').length).toBe(2);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick' })).not.toBeInTheDocument();
  });

  it('shows the live room and Player Pool CTA when it is your pick', () => {
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.getAllByText('Alpha Team').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('YOUR PICK')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /Open Player Pool/i });
    expect(cta).toHaveAttribute('href', '/pool');
  });

  it('no your-turn CTA when another team is on the clock', () => {
    profile = { team_id: 't2', is_admin: false };
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.queryByText('YOUR PICK')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Player Pool/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('On the clock').length).toBeGreaterThanOrEqual(1);
  });

  it('queued offline pick shows the banner', () => {
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);
    useOfflineQueue.setState({
      queue: [{ seasonId: 's1', playerId: 'q1', playerName: 'Queued Guy', queuedAt: 1 }],
    });

    render(<DraftPage />);

    expect(screen.getByText(/Offline — 1 pick queued \(Queued Guy\)/)).toBeInTheDocument();
  });

  it('undo button (own last pick) opens confirm and calls undo', async () => {
    const user = userEvent.setup();
    mockedPicks.mockReturnValue({
      data: [
        pick({
          team_id: 't1',
          is_used: true,
          player_id: 'pl1',
          picked_at: '2026-08-25T12:01:00Z',
          players: { name: 'Drafted Star' } as DraftPick['players'],
        }),
        pick({ id: 'next', round: 1, pick_number: 2, team_id: 't2', is_used: false }),
      ],
      isLoading: false,
    } as never);

    render(<DraftPage />);
    await user.click(screen.getByRole('button', { name: 'Undo last pick' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Undo last pick?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Undo pick' }));
    expect(undoMutate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });
});
