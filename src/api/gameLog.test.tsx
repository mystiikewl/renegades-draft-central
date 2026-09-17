import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGameLog } from './gameLog';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

const espnResponse = {
  names: [
    'minutes',
    'points',
    'totalRebounds',
    'assists',
    'steals',
    'blocks',
    'turnovers',
    'fieldGoalsMade-fieldGoalsAttempted',
    'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
    'freeThrowsMade-freeThrowsAttempted',
  ],
  seasonTypes: [
    {
      displayName: '2025-26 Season',
      categories: [{
        displayName: 'Regular Season Stats',
        events: [{ eventId: 'college-game-1', stats: ['34', '25', '8', '4', '2', '1', '3', '9-18', '2-6', '5-7'] }],
      }],
    },
  ],
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

describe('useGameLog', () => {
  it('loads a rookie college season from the configured ESPN competition', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => espnResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(
      () => useGameLog('5142718', true, { competition: 'mens-college-basketball', season: 2026 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/5142718/gamelog?season=2026',
    );
    expect(result.current.data).toEqual([
      expect.objectContaining({
        gameId: 'college-game-1',
        opponent: 'DUKE',
        location: '@',
        result: 'W',
        pts: '25',
        reb: '8',
        ast: '4',
      }),
    ]);
  });
});
