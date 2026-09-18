import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerWithStats } from '@/api/types';

vi.mock('@/api/queries', () => ({
  useActiveSeason: vi.fn(() => ({ data: { id: 's1', label: '2026-27' } })),
}));

const toggleMutate = vi.fn();
// Read at render time inside the mock factory's closures (same pattern as
// PlayerPoolPage.test's `profile`), so tests can reassign per scenario.
let favourites = new Set<string>();
vi.mock('@/api/favourites', () => ({
  useFavouriteIds: vi.fn(() => favourites),
  useToggleFavourite: vi.fn(() => ({ mutate: toggleMutate, isPending: false })),
}));

import { PlayerSearch } from './PlayerSearch';

function player(partial: Partial<PlayerWithStats>): PlayerWithStats {
  return {
    id: 'pl1',
    name: 'Alpha Man',
    position: 'PG',
    nba_team: 'BOS',
    espn_id: '1',
    player_seasons: [{ season_id: 's1', stats: {} }],
    ...partial,
  } as PlayerWithStats;
}

const alpha = player({ id: 'pl1', name: 'Alpha Man' });
const beta = player({ id: 'pl2', name: 'Beta Watched' });
// Name deliberately contains no letter shared with the 'a' query below.
const gamma = player({ id: 'pl3', name: 'Boris No Hit' });

describe('PlayerSearch', () => {
  it('offers watchlist players as quick picks on focus', async () => {
    const user = userEvent.setup();
    favourites = new Set(['pl2']);
    render(<PlayerSearch players={[alpha, beta, gamma]} onPick={vi.fn()} />);

    await user.click(screen.getByLabelText('Search players'));

    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('Beta Watched')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Man')).not.toBeInTheDocument();
  });

  it('orders watchlist matches ahead of other hits while searching', async () => {
    const user = userEvent.setup();
    favourites = new Set(['pl2']);
    render(<PlayerSearch players={[alpha, beta, gamma]} onPick={vi.fn()} />);

    // 'a' hits both Alpha Man and Beta Watched (but not Boris No Hit).
    await user.type(screen.getByLabelText('Search players'), 'a');

    const hits = screen.getAllByText(/Alpha Man|Beta Watched/);
    expect(hits.map((el) => el.textContent)).toEqual(['Beta Watched', 'Alpha Man']);
    expect(screen.queryByText('Boris No Hit')).not.toBeInTheDocument();
  });

  it('picks a player and closes the dropdown', async () => {
    const user = userEvent.setup();
    favourites = new Set();
    const onPick = vi.fn();
    render(<PlayerSearch players={[alpha, beta]} onPick={onPick} />);

    await user.type(screen.getByLabelText('Search players'), 'alpha');
    await user.click(screen.getByText('Alpha Man'));

    expect(onPick).toHaveBeenCalledWith('pl1');
    expect(screen.getByLabelText('Search players')).toHaveValue('');
  });

  it('toggles the watchlist from a row without picking the player', async () => {
    const user = userEvent.setup();
    favourites = new Set(['pl2']);
    const onPick = vi.fn();
    render(<PlayerSearch players={[alpha, beta]} onPick={onPick} />);

    await user.type(screen.getByLabelText('Search players'), 'a');
    await user.click(screen.getByRole('button', { name: 'Add Alpha Man to watchlist' }));

    expect(onPick).not.toHaveBeenCalled();
    expect(toggleMutate).toHaveBeenCalledWith({ playerId: 'pl1', watch: true });
  });
});
