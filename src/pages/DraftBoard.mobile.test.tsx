import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DraftPick } from '@/api/types';
import { DraftBoard } from './DraftPage';

const teamName = (id: string) => (id === 't1' ? 'Alpha' : 'Beta');

const pick = (over: Partial<DraftPick>): DraftPick => ({
  id: over.id ?? `p${over.pick_number}`,
  season_id: 's1',
  round: 1,
  pick_number: 1,
  team_id: 't1',
  original_team_id: 't1',
  player_id: null,
  is_used: false,
  picked_at: null,
  ...over,
});

const picks = [
  pick({ pick_number: 1, is_used: true, players: { name: 'Jokic', position: 'C', nba_team: 'DEN', espn_id: null } }),
  pick({ id: 'on-clock', pick_number: 2 }),
  pick({ id: 'p3', pick_number: 3, team_id: 't2', original_team_id: 't1', is_used: true, players: null }),
  pick({ id: 'r2p4', round: 2, pick_number: 14, is_used: true, players: { name: 'Sga', position: 'G', nba_team: 'OKC', espn_id: null } }),
];

const renderBoard = () => render(<DraftBoard picks={picks} picksLoading={false} teamName={teamName} />);

afterEach(cleanup);

describe('DraftBoard mobile layout', () => {
  it('renders every pick with number, team context and player state, grouped by round', () => {
    renderBoard();
    expect(screen.getAllByText('Round')).toHaveLength(2);
    for (const n of [1, 2, 3, 14]) {
      expect(screen.getByText(`#${n}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Jokic')).toBeInTheDocument();
    expect(screen.getByText('Sga')).toBeInTheDocument();
    expect(screen.getByText('On the clock')).toBeInTheDocument();
  });

  it('marks exactly the current on-clock slot', () => {
    const { container } = renderBoard();
    const onClock = container.querySelectorAll('[data-on-clock]');
    expect(onClock).toHaveLength(1);
    expect(onClock[0].textContent).toContain('#2');
    expect(onClock[0].className).toContain('ring-primary');
    expect(onClock[0].textContent).toContain('Live');
  });

  it('renders a skipped slot as resolved without inventing a player', () => {
    const skipped = pick({ id: 'skip', pick_number: 7, is_used: true, is_skipped: true, team_id: 't2' });
    const { container } = render(<DraftBoard picks={[skipped]} picksLoading={false} teamName={teamName} />);
    expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(container.querySelector('[data-skipped="true"]')).toBeTruthy();
  });

  it('flags traded picks in amber', () => {
    const { container } = renderBoard();
    expect(container.querySelectorAll('.text-amber-600')).toHaveLength(1);
    expect(screen.getByText('TRADE')).toBeInTheDocument();
  });

  it('tints a completed traded pick with the current picking team colour', () => {
    render(
      <DraftBoard
        picks={picks}
        picksLoading={false}
        teamName={teamName}
        teamColor={(id) => (id === 't1' ? '#2563EB' : '#E11D48')}
      />,
    );

    expect(screen.getByText('Jokic').closest('[data-team-color]')).toHaveAttribute('data-team-color', '#2563EB');
    expect(screen.getByText('—').closest('[data-team-color]')).toHaveAttribute('data-team-color', '#E11D48');
  });

  it('keeps loading skeleton and empty state', () => {
    const { rerender } = render(<DraftBoard picks={[]} picksLoading teamName={teamName} />);
    expect(document.querySelector('.animate-shimmer')).toBeTruthy();
    rerender(<DraftBoard picks={[]} picksLoading={false} teamName={teamName} />);
    expect(screen.getByText(/not set yet/i)).toBeInTheDocument();
  });
});
