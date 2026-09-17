import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { PlayerStatsDialog } from './PlayerStatsDialog';

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

function player(partial: Partial<PlayerWithStats> = {}): PlayerWithStats {
  return {
    id: 'rookie-1',
    espn_id: '5142718',
    name: 'AJ Dybantsa',
    position: 'SF',
    nba_team: 'WSH',
    image_url: null,
    experience: 0,
    birth_date: '2007-01-29',
    height: "6' 9\"",
    weight: 217,
    draft_display: '2026: Rd 1, Pk 1 (WSH)',
    created_at: '2026-06-25T00:00:00Z',
    player_seasons: [{ season_id: 'season-1', stats: {} }],
    ...partial,
  };
}

const collegeLogResponse = {
  names: ['minutes', 'points', 'totalRebounds', 'assists', 'steals', 'blocks', 'turnovers'],
  seasonTypes: [{
    displayName: '2025-26 Regular Season',
    categories: [{ events: [{ eventId: 'college-game-1', stats: ['34', '25', '8', '4', '2', '1', '3'] }] }],
  }],
  events: {
    'college-game-1': {
      id: 'college-game-1',
      atVs: '@',
      gameDate: '2026-03-01T00:00:00Z',
      score: '81-77',
      gameResult: 'W',
      opponent: { abbreviation: 'DUKE' },
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlayerStatsDialog game log', () => {
  it('shows a labelled college game log for a rookie', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => collegeLogResponse });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlayerStatsDialog player={player()} open onOpenChange={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: 'College game log · 2025–26' }));

    await waitFor(() => expect(screen.getByRole('row', { name: /DUKE/ })).toBeInTheDocument());
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/5142718/gamelog?season=2026',
    );
  });

  it('shows a quiet unavailable state when ESPN has no college games', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: [], seasonTypes: [], events: {} }),
    }));

    render(
      <PlayerStatsDialog player={player()} open onOpenChange={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: 'College game log · 2025–26' }));

    expect(await screen.findByText('College game log unavailable.')).toBeInTheDocument();
  });

  it('keeps veteran game logs on the NBA competition', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: [], seasonTypes: [], events: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlayerStatsDialog
        player={player({ experience: 8, draft_display: '2018: Rd 1, Pk 1 (PHX)' })}
        open
        onOpenChange={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: 'Game log' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/5142718/gamelog?season=2026',
    ));
    expect(screen.queryByText(/College game log/i)).not.toBeInTheDocument();
  });
});
