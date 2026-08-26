import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ profile: { team_id: 't1', is_admin: false } }),
}));

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useTeams: vi.fn(() => ({ data: [{ id: 't1', name: 'Alpha Team' }, { id: 't2', name: 'Beta Team' }] })),
  useRosters: vi.fn(),
  useDraftPicks: vi.fn(),
  useTrades: vi.fn(),
}));

import { useDraftPicks, useRosters, useTrades } from '@/api/queries';
import { MyTeamPage } from './MyTeamPage';

const mockedRosters = vi.mocked(useRosters);
const mockedPicks = vi.mocked(useDraftPicks);
const mockedTrades = vi.mocked(useTrades);

describe('MyTeamPage', () => {
  beforeEach(() => {
    mockedRosters.mockReturnValue({
      data: [
        {
          id: 'r1', season_id: 's1', team_id: 't1', player_id: 'pl1', acquisition: 'keeper',
          draft_pick_id: null, acquired_at: '2026-08-01',
          players: { name: 'My Star', position: 'PG', nba_team: 'BOS', espn_id: '1' },
        },
        {
          id: 'r2', season_id: 's1', team_id: 't2', player_id: 'pl2', acquisition: 'draft',
          draft_pick_id: null, acquired_at: '2026-08-01',
          players: { name: 'Other Star', position: 'C', nba_team: 'DEN', espn_id: '2' },
        },
      ],
      isLoading: false,
    } as never);
    mockedPicks.mockReturnValue({
      data: [
        { id: 'p1', season_id: 's1', round: 2, pick_number: 15, team_id: 't1', original_team_id: 't1', player_id: null, is_used: false, picked_at: null },
        { id: 'p2', season_id: 's1', round: 3, pick_number: 26, team_id: 't2', original_team_id: 't2', player_id: null, is_used: false, picked_at: null },
      ],
      isLoading: false,
    } as never);
    mockedTrades.mockReturnValue({
      data: [
        {
          id: 'tr1', season_id: 's1', from_team_id: 't1', to_team_id: 't2', proposed_by: 'u1', resolved_by: null,
          status: 'proposed', note: null, created_at: '2026-08-25T00:00:00Z', resolved_at: null,
          from_team: { id: 't1', name: 'Alpha Team' }, to_team: { id: 't2', name: 'Beta Team' }, assets: [],
        },
      ],
      isLoading: false,
    } as never);
  });

  it('shows only the signed-in team roster with owned picks and team trade activity', () => {
    render(<MyTeamPage />);

    expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
    expect(screen.getByText('My Star')).toBeInTheDocument();
    expect(screen.queryByText('Other Star')).not.toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.queryByText('Round 3')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Team')).toBeInTheDocument();
  });

  it('links personal actions back into league workflows', () => {
    render(<MyTeamPage />);

    expect(screen.getByRole('link', { name: /Find players/i })).toHaveAttribute('href', '/pool');
    expect(screen.getByRole('link', { name: /Open trades/i })).toHaveAttribute('href', '/trades');
    expect(screen.getByRole('link', { name: /Team builder/i })).toHaveAttribute('href', '/team-builder');
  });
});
