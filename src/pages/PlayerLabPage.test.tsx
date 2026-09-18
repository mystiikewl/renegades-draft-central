import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useStatsEnrichedPlayers: vi.fn(() => ({ data: [], isLoading: false })),
  useDraftSettings: vi.fn(() => ({ data: { league_size: 10 } })),
  useRosterWithStats: vi.fn(() => ({ data: [], isLoading: false })),
  useTeams: vi.fn(() => ({ data: [{ id: 't1', name: 'Mine' }] })),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile: { id: 'u1', team_id: 't1' } })),
}));

// Read at render time so tests can reassign per scenario.
let favouriteIds = new Set<string>();
vi.mock('@/api/favourites', () => ({
  useFavouriteIds: vi.fn(() => favouriteIds),
  useToggleFavourite: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

import { useStatsEnrichedPlayers } from '@/api/queries';
import { PlayerLabPage } from './PlayerLabPage';

const mockedPool = vi.mocked(useStatsEnrichedPlayers);

function player(partial: Partial<PlayerWithStats> = {}): PlayerWithStats {
  return {
    id: 'pl1',
    name: 'Test Guard',
    position: 'PG',
    nba_team: 'BOS',
    espn_id: '1',
    player_seasons: [
      {
        season_id: 's1',
        stats: {
          points: 24.5,
          total_rebounds: 4.1,
          assists: 7.2,
          games_played: 70,
          field_goal_percentage: 0.48,
          free_throw_percentage: 0.85,
        },
      },
    ],
    ...partial,
  } as PlayerWithStats;
}

describe('PlayerLabPage', () => {
  beforeEach(() => {
    favouriteIds = new Set();
    mockedPool.mockReturnValue({ data: [], isLoading: false } as never);
  });

  it('reads shapes from the shared stats-enriched pool and skips players without a stats row', () => {
    mockedPool.mockReturnValue({
      data: [player(), player({ id: 'pl2', name: 'No Stats', player_seasons: [] })],
      isLoading: false,
    } as never);

    render(<PlayerLabPage />);

    expect(screen.getByText('Player Shape')).toBeInTheDocument();
    expect(screen.getByText('Test Guard')).toBeInTheDocument();
    expect(screen.queryByText('No Stats')).not.toBeInTheDocument();
  });

  it('pins watchlist players under a ★ Watchlist group in the compare list', () => {
    favouriteIds = new Set(['pl2']);
    mockedPool.mockReturnValue({
      data: [
        player(),
        player({
          id: 'pl2',
          name: 'Watched Guy',
          // Clearly weaker shape so Test Guard stays the auto-selected player.
          player_seasons: [{
            season_id: 's1',
            stats: {
              points: 5,
              total_rebounds: 2,
              assists: 1,
              games_played: 10,
              field_goal_percentage: 0.4,
              free_throw_percentage: 0.6,
            },
          }],
        }),
      ],
      isLoading: false,
    } as never);

    render(<PlayerLabPage />);

    const group = screen.getByRole('group', { name: '★ Watchlist' });
    expect(within(group).getByText('Watched Guy')).toBeInTheDocument();
    // Pinned once — not duplicated as a second <option> in the flat list below.
    expect(screen.getAllByRole('option', { name: 'Watched Guy' })).toHaveLength(1);
  });

  it('shows a loading state while the pool loads', () => {
    mockedPool.mockReturnValue({ data: undefined, isLoading: true } as never);

    render(<PlayerLabPage />);

    expect(screen.getByText('Loading Player Lab…')).toBeInTheDocument();
  });

  it('explains category ranks as draft edges and build risks', () => {
    mockedPool.mockReturnValue({
      data: [
        player({ id: 'leader', name: 'Category Leader' }),
        player({
          id: 'middle',
          name: 'Middle Player',
          player_seasons: [{
            season_id: 's1',
            stats: {
              points: 18,
              total_rebounds: 3,
              assists: 4,
              games_played: 70,
              field_goal_percentage: 0.44,
              free_throw_percentage: 0.78,
            },
          }],
        }),
        player({
          id: 'trailer',
          name: 'Pool Trailer',
          player_seasons: [{
            season_id: 's1',
            stats: {
              points: 8,
              total_rebounds: 2,
              assists: 2,
              games_played: 70,
              field_goal_percentage: 0.4,
              free_throw_percentage: 0.7,
            },
          }],
        }),
      ],
      isLoading: false,
    } as never);

    render(<PlayerLabPage />);

    expect(screen.getByText('Draft edges')).toBeInTheDocument();
    expect(screen.getByText('Build risks')).toBeInTheDocument();
    expect(screen.getAllByText('#1 of 3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Elite source').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ranks use projected season totals/)).toBeInTheDocument();
  });

  it('focuses the header search on "/" while the switcher bar is hidden', () => {
    mockedPool.mockReturnValue({ data: [player()], isLoading: false } as never);

    render(<PlayerLabPage />);

    expect(screen.queryByLabelText('Previous player')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '/' });

    expect(screen.getByLabelText('Search players')).toHaveFocus();
  });

  it('promotes a similar-shape match to the main player via its view action', async () => {
    const user = userEvent.setup();
    mockedPool.mockReturnValue({
      data: [
        player(),
        player({
          id: 'pl3',
          name: 'Match Man',
          player_seasons: [{
            season_id: 's1',
            stats: {
              points: 16,
              total_rebounds: 3,
              assists: 4,
              games_played: 60,
              field_goal_percentage: 0.45,
              free_throw_percentage: 0.75,
            },
          }],
        }),
      ],
      isLoading: false,
    } as never);

    render(<PlayerLabPage />);

    const grid = screen.getByTestId('similar-matches');
    expect(within(grid).getByText('Match Man')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View Match Man' }));

    expect(screen.getByRole('heading', { name: 'Match Man' })).toBeInTheDocument();
    // The promoted player leaves the matches grid (it excludes the selection).
    expect(within(screen.getByTestId('similar-matches')).queryByText('Match Man')).not.toBeInTheDocument();
  });
});
