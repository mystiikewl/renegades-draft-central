import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
}));

// Read at render time so tests can reassign per scenario.
let favouriteIds = new Set<string>();
vi.mock('@/api/favourites', () => ({
  useFavouriteIds: vi.fn(() => favouriteIds),
}));

import { PlayerSwitcherBar } from './PlayerSwitcherBar';

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

const alpha = player({ id: 'a', name: 'Aron' });
const bravo = player({ id: 'b', name: 'Brett' });
const charlie = player({ id: 'c', name: 'Chuck' });
const pool = [charlie, alpha, bravo];

describe('PlayerSwitcherBar', () => {
  beforeEach(() => {
    favouriteIds = new Set();
  });

  it('shows the current player identity', () => {
    render(<PlayerSwitcherBar player={alpha} pool={pool} onPick={vi.fn()} />);

    expect(screen.getByText('Aron')).toBeInTheDocument();
    expect(screen.getByLabelText('Search players')).toBeInTheDocument();
  });

  it('cycles the watchlist forward and wraps', async () => {
    favouriteIds = new Set(['b', 'c']);
    const user = userEvent.setup();

    const onPick = vi.fn();
    const { rerender } = render(<PlayerSwitcherBar player={bravo} pool={pool} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    expect(onPick).toHaveBeenCalledWith('c');

    onPick.mockClear();
    rerender(<PlayerSwitcherBar player={charlie} pool={pool} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('cycles backward from the watchlist head', async () => {
    favouriteIds = new Set(['b', 'c']);
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(<PlayerSwitcherBar player={bravo} pool={pool} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Previous player' }));
    expect(onPick).toHaveBeenCalledWith('c');
  });

  it('falls back to cycling the whole pool when nothing is watched', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(<PlayerSwitcherBar player={alpha} pool={pool} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    expect(onPick).toHaveBeenCalledWith('b');

    onPick.mockClear();
    await user.click(screen.getByRole('button', { name: 'Previous player' }));
    expect(onPick).toHaveBeenCalledWith('c');
  });
});
