import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DraftPick, PlayerWithStats } from '@/api/types';

// --- Module mocks: everything under src/api + auth, so only layout/flow logic runs ---

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
  useUndoLastPick: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useTradePick: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSwapPicks: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/api/realtime', () => ({ useDraftRealtime: vi.fn() }));

let profile: { team_id: string | null; is_admin: boolean } | null = {
  team_id: 't1',
  is_admin: false,
};
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

// Radix ScrollArea wants ResizeObserver; Tabs/Dialog are fine without.
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { useDraftPicks, usePlayerPool } from '@/api/queries';
import { useOfflineQueue } from '@/api/offlineQueue';
import { DraftPage } from './DraftPage';

const mockedPicks = vi.mocked(useDraftPicks);
const mockedPool = vi.mocked(usePlayerPool);

function pick(partial: Partial<DraftPick>): DraftPick {
  return {
    id: 'p1',
    season_id: 's1',
    round: 1,
    pick_number: 1,
    team_id: 't1',
    player_id: null,
    is_used: false,
    picked_at: null,
    players: null,
    teams: null,
    ...partial,
  } as DraftPick;
}

function player(partial: Partial<PlayerWithStats>): PlayerWithStats {
  return {
    id: 'pl1',
    name: 'Test Player',
    position: 'PG',
    nba_team: 'BOS',
    espn_id: 1,
    player_seasons: [{ stats: { avgPoints: 25.1, avgRebounds: 4.2, avgAssists: 6.7, gamesPlayed: 70 } }],
    ...partial,
  } as PlayerWithStats;
}

describe('DraftPage', () => {
  beforeEach(() => {
    mutate.mockReset();
    profile = { team_id: 't1', is_admin: false };
    useOfflineQueue.setState({ queue: [] });
    mockedPicks.mockReturnValue({ data: [], isLoading: false } as never);
    mockedPool.mockReturnValue({ data: [] as PlayerWithStats[], isLoading: false } as never);
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
    // Board renders twice (mobile tabs + desktop grid).
    expect(screen.getAllByText('Round 1').length).toBe(2);
    expect(screen.getAllByText('Round 2').length).toBe(2);
    // Twice on the boards + once in the "Last pick" strip.
    expect(screen.getAllByText('Drafted Star').length).toBe(3);
    // Unused slot shows an em dash, not a player.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the on-clock banner and your-turn marker when it is your pick', () => {
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    // Banner + board slot both show the team name.
    expect(screen.getAllByText('Alpha Team').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('YOUR PICK — choose a player below')).toBeInTheDocument();
  });

  it("no your-turn marker when another team is on the clock, and Pick buttons disabled", async () => {
    profile = { team_id: 't2', is_admin: false };
    mockedPicks.mockReturnValue({
      data: [pick({ team_id: 't1', is_used: false })],
      isLoading: false,
    } as never);
    mockedPool.mockReturnValue({
      data: [player()],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.queryByText('YOUR PICK — choose a player below')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick' })).toBeDisabled();
    expect(
      screen.getByText("Picks unlock when you're on the clock (admins can always pick)."),
    ).toBeInTheDocument();
  });

  it('Pick click opens confirm dialog; confirming calls makePick with player id/name', async () => {
    const user = userEvent.setup();
    const guy = player({ id: 'pl1', name: 'Confirm Me' });
    mockedPicks.mockReturnValue({
      data: [
        pick({
          team_id: 't1',
          is_used: true,
          player_id: 'pl-gone',
          picked_at: '2026-08-25T12:01:00Z',
        }),
        pick({ id: 'next', round: 1, pick_number: 2, team_id: 't1', is_used: false }),
      ],
      isLoading: false,
    } as never);
    // Drafted player must be filtered out of the pool.
    mockedPool.mockReturnValue({
      data: [player({ id: 'pl-gone', name: 'Already Gone' }), guy],
      isLoading: false,
    } as never);

    render(<DraftPage />);

    expect(screen.queryByText('Already Gone')).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'Pick' });
    await user.click(buttons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Confirm pick')).toBeInTheDocument();
    expect(within(dialog).getByText('Confirm Me')).toBeInTheDocument();
    expect(within(dialog).getByText('PG · BOS')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Pick Confirm Me/ }));
    expect(mutate).toHaveBeenCalledWith(
      { playerId: 'pl1', playerName: 'Confirm Me' },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('queued offline pick shows badge and banner', () => {
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

    render(<DraftPage />);

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText(/Offline — 1 pick queued \(Queued Guy\)/)).toBeInTheDocument();
    // Queued player's Pick button is disabled to prevent double-submission.
    expect(screen.getByRole('button', { name: 'Pick' })).toBeDisabled();
  });
});
