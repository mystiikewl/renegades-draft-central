import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

let settings: { league_size: number; roster_size: number } | null = { league_size: 2, roster_size: 2 };
let rosterRows: { entry: { team_id: string }; player: PlayerWithStats | null }[] = [];
let rostersLoading = false;

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
  useDraftSettings: vi.fn(() => ({ data: settings })),
  useRosterWithStats: vi.fn(() => ({ data: rosterRows, isLoading: rostersLoading })),
  useTeams: vi.fn(() => ({ data: [{ id: 't1', name: 'Mine' }, { id: 't2', name: 'Rival' }] })),
}));

// Read at render time so tests can reassign per scenario.
let profile: { team_id: string | null } = { team_id: 't1' };
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

import { CategoryMarketPanel } from './CategoryMarketPanel';

const GP = 10;

// Identical per-game stats for every "filler" — degenerate categories z-score
// to exactly 0, so only deliberately varied stats produce strong rows.
const BASE_STATS = {
  points: 1,
  total_rebounds: 1,
  assists: 1,
  steals: 1,
  blocks: 0,
  turnovers: 1,
  field_goals_made: 0.4,
  field_goals_attempted: 1,
  field_goal_percentage: 0.4,
  free_throws_made: 0.8,
  free_throws_attempted: 1,
  free_throw_percentage: 0.8,
  three_pointers_made: 0.1,
  three_pointers_attempted: 0.3,
  three_point_percentage: 0.33,
  double_doubles: 0,
  triple_doubles: 0,
};

function player(partial: Partial<PlayerWithStats> & { id: string; stats?: Record<string, number> }): PlayerWithStats {
  const { stats, ...rest } = partial;
  return {
    name: partial.id,
    position: 'PG',
    nba_team: 'BOS',
    espn_id: partial.id,
    player_seasons: [{ season_id: 's1', stats: { games_played: GP, ...BASE_STATS, ...stats } }],
    ...rest,
  } as PlayerWithStats;
}

const mine1 = player({ id: 'm1', name: 'Roster One' });
const mine2 = player({ id: 'm2', name: 'Roster Two' });
const rival = player({ id: 'r1', name: 'Rival Guy' });

function fillers(count: number, stats: Record<string, number> = {}, prefix = 'fx'): PlayerWithStats[] {
  return Array.from({ length: count }, (_, index) => player({ id: `${prefix}-${index}`, stats }));
}

beforeEach(() => {
  profile = { team_id: 't1' };
  settings = { league_size: 2, roster_size: 2 };
  rostersLoading = false;
  rosterRows = [
    { entry: { team_id: 't1' }, player: mine1 },
    { entry: { team_id: 't1' }, player: mine2 },
    { entry: { team_id: 't2' }, player: rival },
  ];
});

describe('CategoryMarketPanel', () => {
  it('calls a scarce, needed, elite-ranked category a premium', () => {
    // Lone blocker in a 25-player pool: scarce (4% providers) + top-heavy.
    // The roster has zero blocks vs an even-draft target of 50 → priority.
    const candidate = player({ id: 'cand', stats: { blocks: 10 } });
    const pool = [candidate, mine1, mine2, rival, ...fillers(21)];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText(/shallow market/)).toBeInTheDocument();
    expect(screen.getByText(/#1 of 25 pool/)).toBeInTheDocument();
    expect(screen.getByText(/priority need/)).toBeInTheDocument();
  });

  it('credits volume in a deep market the roster needs as a value fill', () => {
    // 6 of 25 players clear the pts provider bar (24%) → deep. Roster has
    // almost no points vs a 400-total target → priority.
    const candidate = player({ id: 'cand', stats: { points: 11 } });
    const pool = [
      candidate,
      ...fillers(5, { points: 10 }, 'pts'),
      ...fillers(19, { points: 1 }, 'ptsf'),
    ];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText('Value fill')).toBeInTheDocument();
    expect(screen.getByText(/deep market/)).toBeInTheDocument();
  });

  it('calls a deep covered market replaceable', () => {
    // Same deep pts pool, but the roster already meets the even-draft pace.
    const candidate = player({ id: 'cand', stats: { points: 11 } });
    const pool = [
      candidate,
      ...fillers(5, { points: 10 }, 'pts'),
      ...fillers(19, { points: 1 }, 'ptsf'),
    ];
    rosterRows = [
      { entry: { team_id: 't1' }, player: player({ id: 'big-1', stats: { points: 20 } }) },
      { entry: { team_id: 't1' }, player: player({ id: 'big-2', stats: { points: 20 } }) },
      { entry: { team_id: 't2' }, player: rival },
    ];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText('Replaceable')).toBeInTheDocument();
    expect(screen.getByText(/well covered/)).toBeInTheDocument();
  });

  it('flags relative-strength fallback when nothing clears the provider bar', () => {
    const candidate = player({ id: 'cand' });
    const pool = [candidate, mine1, mine2, rival, ...fillers(21)];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText(/relative strengths only/)).toBeInTheDocument();
  });

  it('prompts to claim a team when the profile has none', () => {
    profile = { team_id: null };
    const candidate = player({ id: 'cand', stats: { blocks: 10 } });
    const pool = [candidate, mine1, mine2, rival, ...fillers(21)];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText(/Claim your team/)).toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('points at the Team Builder before rosters exist', () => {
    rosterRows = [];
    const candidate = player({ id: 'cand', stats: { blocks: 10 } });
    const pool = [candidate, mine1, mine2, rival, ...fillers(21)];

    render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(screen.getByText(/No roster yet/)).toBeInTheDocument();
  });

  it('shows a skeleton while rosters load', () => {
    rostersLoading = true;
    const candidate = player({ id: 'cand', stats: { blocks: 10 } });
    const pool = [candidate, mine1, mine2, rival, ...fillers(21)];

    const { container } = render(<CategoryMarketPanel candidate={candidate} pool={pool} />);

    expect(container.querySelector('.animate-shimmer')).not.toBeNull();
    expect(screen.queryByText(/Claim your team/)).not.toBeInTheDocument();
  });

  it('renders nothing without a candidate', () => {
    const { container } = render(<CategoryMarketPanel candidate={null} pool={[mine1, mine2]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
