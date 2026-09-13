import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useStatsEnrichedPlayers: vi.fn(() => ({ data: [], isLoading: false })),
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

  it('shows a loading state while the pool loads', () => {
    mockedPool.mockReturnValue({ data: undefined, isLoading: true } as never);

    render(<PlayerLabPage />);

    expect(screen.getByText('Loading Player Lab…')).toBeInTheDocument();
  });
});
