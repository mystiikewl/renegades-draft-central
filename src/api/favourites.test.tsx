import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useFavourites, useFavouriteIds, useToggleFavourite } from './favourites';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile: { id: 'u1' } })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/** Chainable Postgrest-style builder: every method returns the thenable chain. */
function builder(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'delete']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (onFulfilled: (r: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return chain;
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

const from = vi.mocked(supabase.from);

beforeEach(() => {
  from.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe('useFavourites', () => {
  it('reads the caller’s rows for the season, newest first', async () => {
    const rows = [{ id: 'f1', profile_id: 'u1', player_id: 'pl2', season_id: 's1', created_at: 'x' }];
    const chain = builder({ data: rows, error: null });
    from.mockReturnValue(chain as never);

    const { result } = renderHook(() => useFavourites('s1'), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(from).toHaveBeenCalledWith('user_favourites');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('season_id', 's1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('stays idle without a season', () => {
    const { result } = renderHook(() => useFavourites(undefined), { wrapper: makeWrapper(makeClient()) });
    expect(result.current.isLoading).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('useFavouriteIds', () => {
  it('projects rows to a player-id set', async () => {
    const rows = [
      { id: 'f1', player_id: 'pl2' },
      { id: 'f2', player_id: 'pl7' },
    ];
    from.mockReturnValue(builder({ data: rows, error: null }) as never);

    const { result } = renderHook(() => useFavouriteIds('s1'), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.has('pl7')).toBe(true));
    expect(result.current).toEqual(new Set(['pl2', 'pl7']));
  });
});

describe('useToggleFavourite', () => {
  it('inserts a row scoped to the profile and season, then invalidates', async () => {
    const chain = builder({ data: null, error: null });
    from.mockReturnValue(chain as never);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useToggleFavourite('s1'), { wrapper: makeWrapper(qc) });
    await act(() => result.current.mutateAsync({ playerId: 'pl1', watch: true }));

    expect(chain.insert).toHaveBeenCalledWith({ profile_id: 'u1', player_id: 'pl1', season_id: 's1' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['favourites', 's1'] });
  });

  it('deletes by profile + player + season', async () => {
    const chain = builder({ data: null, error: null });
    from.mockReturnValue(chain as never);

    const { result } = renderHook(() => useToggleFavourite('s1'), { wrapper: makeWrapper(makeClient()) });
    await act(() => result.current.mutateAsync({ playerId: 'pl1', watch: false }));

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'profile_id', 'u1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'player_id', 'pl1');
    expect(chain.eq).toHaveBeenNthCalledWith(3, 'season_id', 's1');
  });

  it('toasts instead of crashing when the write fails', async () => {
    from.mockReturnValue(builder({ data: null, error: { message: 'nope' } }) as never);

    const { result } = renderHook(() => useToggleFavourite('s1'), { wrapper: makeWrapper(makeClient()) });
    await act(() => result.current.mutateAsync({ playerId: 'pl1', watch: true }).catch(() => undefined));

    expect(toast.error).toHaveBeenCalledWith('Could not update your watchlist.');
  });
});
