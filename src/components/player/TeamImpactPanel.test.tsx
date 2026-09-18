import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useDraftSettings: vi.fn(() => ({ data: { league_size: 2 } })),
  useRosterWithStats: vi.fn(() => ({ data: rosterRows, isLoading: false })),
  useTeams: vi.fn(() => ({ data: [{ id: 't1', name: 'Mine' }, { id: 't2', name: 'Rival' }] })),
}));

// Read at render time so tests can reassign per scenario.
let profile: { team_id: string | null } = { team_id: 't1' };
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

import { TeamImpactPanel } from './TeamImpactPanel';

function player(partial: Partial<PlayerWithStats>): PlayerWithStats {
  return {
    id: 'p1',
    name: 'Player One',
    position: 'PG',
    nba_team: 'BOS',
    espn_id: '1',
    player_seasons: [{ season_id: 's1', stats: { games_played: 2 } }],
    ...partial,
  } as PlayerWithStats;
}

// totals pts: mine1 40 + mine2 20 = 60 for t1; rival 70 for t2; candidate 60.
const candidate = player({ id: 'cand', name: 'Free Agent', player_seasons: [{ season_id: 's1', stats: { games_played: 2, points: 30 } }] });
const mine1 = player({ id: 'm1', name: 'Roster Star', player_seasons: [{ season_id: 's1', stats: { games_played: 2, points: 20 } }] });
const mine2 = player({ id: 'm2', name: 'Bench Guy', player_seasons: [{ season_id: 's1', stats: { games_played: 2, points: 10 } }] });
const rival = player({ id: 'r1', name: 'Rival Guy', player_seasons: [{ season_id: 's1', stats: { games_played: 2, points: 35 } }] });

let rosterRows: { entry: { team_id: string }; player: PlayerWithStats | null }[] = [
  { entry: { team_id: 't1' }, player: mine1 },
  { entry: { team_id: 't1' }, player: mine2 },
  { entry: { team_id: 't2' }, player: rival },
];

const pool = [candidate, mine1, mine2, rival];

describe('TeamImpactPanel', () => {
  beforeEach(() => {
    profile = { team_id: 't1' };
    rosterRows = [
      { entry: { team_id: 't1' }, player: mine1 },
      { entry: { team_id: 't1' }, player: mine2 },
      { entry: { team_id: 't2' }, player: rival },
    ];
  });

  it('projects the standings and category swing of adding the candidate', () => {
    render(<TeamImpactPanel candidate={candidate} pool={pool} />);

    // t1 trails PTS 60-70; adding the candidate flips the category (+1 pt).
    // The 11 tied categories fall back to team order, so t1 stays #1 — the
    // swing shows in standings points, not rank.
    expect(screen.getByText(/standings pts/).parentElement?.textContent).toContain('+1');
    expect(screen.getByText(/projected rank #1 → #1/)).toBeInTheDocument();
    expect(screen.getByText('+1 PTS')).toBeInTheDocument();

    // Per-category bars render, strongest impact first (PTS on top).
    const firstLabel = screen.getAllByText(/^(PTS|REB|AST|STL|BLK|TO|FGM|FG%|FT%|3PM|3P%|DD|TD)$/)[0];
    expect(firstLabel).toHaveTextContent('PTS');
  });

  it('suggests the weakest rostered player in swap mode', async () => {
    const user = userEvent.setup();
    render(<TeamImpactPanel candidate={candidate} pool={pool} />);

    await user.click(screen.getByRole('button', { name: 'Swap weakest' }));

    expect(screen.getByText(/swapping out Bench Guy for Free Agent/)).toBeInTheDocument();
  });

  it('prompts to claim a team when the profile has none', () => {
    profile = { team_id: null };
    render(<TeamImpactPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText(/Claim your team/)).toBeInTheDocument();
    expect(screen.queryByText('Swap weakest')).not.toBeInTheDocument();
  });

  it('points at the Team Builder before rosters exist', () => {
    rosterRows = [];
    render(<TeamImpactPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText(/No roster yet/)).toBeInTheDocument();
  });
});
