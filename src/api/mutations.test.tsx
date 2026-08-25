import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { queuePick, isNetworkError } from './offlineQueue';
import {
  useMakePick,
  useUndoLastPick,
  useSetDraftOrder,
  useSetDraftStatus,
  useResetDraft,
  useAssignKeeper,
  useRemoveKeeper,
} from './mutations';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('./offlineQueue', async (importOriginal) => {
  // Keep the real module for type fidelity; only intercept the two entry points
  // the mutations rely on, so queue side effects stay out of these tests
  // (covered directly in offlineQueue.test.ts).
  const actual = await importOriginal<typeof import('./offlineQueue')>();
  return { ...actual, queuePick: vi.fn(), isNetworkError: vi.fn(actual.isNetworkError) };
});

const rpc = vi.mocked(supabase.rpc);
const mockedQueuePick = vi.mocked(queuePick);
const mockedIsNetworkError = vi.mocked(isNetworkError);

const SEASON = 'season-1';

function makeClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, invalidate, wrapper };
}

beforeEach(() => {
  rpc.mockReset();
  mockedQueuePick.mockReset();
  mockedIsNetworkError.mockReset().mockImplementation(() => false);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.info).mockReset();
});

afterEach(() => {
  vi.mocked(toast.success).mockClear();
});

describe('useMakePick', () => {
  it('happy path: calls make_pick with p_ params and invalidates season queries', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useMakePick(SEASON), { wrapper });

    await result.current.mutateAsync({ playerId: 'player-9', playerName: 'Test Player' });

    expect(rpc).toHaveBeenCalledWith('make_pick', {
      p_season_id: SEASON,
      p_player_id: 'player-9',
    });
    expect(toast.error).not.toHaveBeenCalled();
    const invalidated = invalidate.mock.calls.map((c) => c[0].queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining([
        ['draft-picks', SEASON],
        ['player-pool', SEASON],
        ['rosters', SEASON],
        ['draft-settings', SEASON],
      ]),
    );
  });

  it('RPC rejection → error toast, never queued', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Not your turn' } } as never);
    const { wrapper } = makeClient();
    const { result } = renderHook(() => useMakePick(SEASON), { wrapper });

    await expect(
      result.current.mutateAsync({ playerId: 'p1', playerName: 'X' }),
    ).rejects.toThrow('Not your turn');

    expect(toast.error).toHaveBeenCalledWith('Not your turn');
    expect(mockedQueuePick).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('network failure → queued + info toast, no error toast', async () => {
    mockedIsNetworkError.mockImplementation(() => true);
    rpc.mockRejectedValue(new TypeError('fetch failed') as never);
    const { wrapper } = makeClient();
    const { result } = renderHook(() => useMakePick(SEASON), { wrapper });

    await expect(
      result.current.mutateAsync({ playerId: 'p2', playerName: 'Queued Guy' }),
    ).rejects.toThrow();

    expect(mockedQueuePick).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: SEASON, playerId: 'p2', playerName: 'Queued Guy' }),
    );
    expect(toast.info).toHaveBeenCalledWith(
      'Offline — pick of Queued Guy queued and will submit when you reconnect',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('useUndoLastPick', () => {
  it('success → toast + invalidation', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useUndoLastPick(SEASON), { wrapper });

    await result.current.mutateAsync();

    expect(rpc).toHaveBeenCalledWith('undo_last_pick', { p_season_id: SEASON });
    expect(toast.success).toHaveBeenCalledWith('Pick undone');
    expect(invalidate).toHaveBeenCalled();
  });

  it('RPC rejection → error toast', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'No picks to undo' } } as never);
    const { wrapper } = makeClient();
    const { result } = renderHook(() => useUndoLastPick(SEASON), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow('No picks to undo');
    expect(toast.error).toHaveBeenCalledWith('No picks to undo');
  });
});

describe('keepers', () => {
  it('useAssignKeeper passes p_ params and invalidates rosters + pool', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useAssignKeeper(SEASON), { wrapper });

    await result.current.mutateAsync({ teamId: 'team-1', playerId: 'player-1' });

    expect(rpc).toHaveBeenCalledWith('assign_keeper', {
      p_season_id: SEASON,
      p_team_id: 'team-1',
      p_player_id: 'player-1',
    });
    expect(toast.error).not.toHaveBeenCalled();
    const invalidated = invalidate.mock.calls.map((c) => c[0].queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining([['rosters', SEASON], ['player-pool', SEASON]]),
    );
  });

  it('useAssignKeeper RPC rejection → error toast, no invalidation', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Keeper limit (9) reached' },
    } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useAssignKeeper(SEASON), { wrapper });

    await expect(
      result.current.mutateAsync({ teamId: 'team-1', playerId: 'player-1' }),
    ).rejects.toThrow('Keeper limit (9) reached');
    expect(toast.error).toHaveBeenCalledWith('Keeper limit (9) reached');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('useRemoveKeeper passes p_ params and invalidates rosters + pool', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useRemoveKeeper(SEASON), { wrapper });

    await result.current.mutateAsync({ teamId: 'team-1', playerId: 'player-1' });

    expect(rpc).toHaveBeenCalledWith('remove_keeper', {
      p_season_id: SEASON,
      p_team_id: 'team-1',
      p_player_id: 'player-1',
    });
    expect(toast.error).not.toHaveBeenCalled();
    const invalidated = invalidate.mock.calls.map((c) => c[0].queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining([['rosters', SEASON], ['player-pool', SEASON]]),
    );
  });

  it('useRemoveKeeper RPC rejection → error toast', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'You can only manage keepers for your own team' },
    } as never);
    const { wrapper } = makeClient();
    const { result } = renderHook(() => useRemoveKeeper(SEASON), { wrapper });

    await expect(
      result.current.mutateAsync({ teamId: 'other-team', playerId: 'player-1' }),
    ).rejects.toThrow('You can only manage keepers for your own team');
    expect(toast.error).toHaveBeenCalledWith('You can only manage keepers for your own team');
  });
});

describe('admin ops', () => {
  it('useSetDraftOrder passes p_ order and invalidates + toasts', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useSetDraftOrder(SEASON), { wrapper });

    await result.current.mutateAsync(['t1', 't2', 't3']);

    expect(rpc).toHaveBeenCalledWith('set_draft_order', {
      p_season_id: SEASON,
      p_order: ['t1', 't2', 't3'],
    });
    expect(toast.success).toHaveBeenCalledWith('Draft order saved — board regenerated');
    expect(invalidate).toHaveBeenCalled();
  });

  it('useSetDraftOrder error → toast, no invalidation', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Admin only' } } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useSetDraftOrder(SEASON), { wrapper });

    await expect(result.current.mutateAsync(['t1'])).rejects.toThrow('Admin only');
    expect(toast.error).toHaveBeenCalledWith('Admin only');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('useSetDraftStatus passes p_status', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useSetDraftStatus(SEASON), { wrapper });

    await result.current.mutateAsync('paused');

    expect(rpc).toHaveBeenCalledWith('set_draft_status', {
      p_season_id: SEASON,
      p_status: 'paused',
    });
    expect(invalidate).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('useSetDraftStatus error → toast', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'bad status' } } as never);
    const { wrapper } = makeClient();
    const { result } = renderHook(() => useSetDraftStatus(SEASON), { wrapper });

    await expect(result.current.mutateAsync('running')).rejects.toThrow('bad status');
    expect(toast.error).toHaveBeenCalledWith('bad status');
  });

  it('useResetDraft success → toast + invalidation; error → toast', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { invalidate, wrapper } = makeClient();
    const { result } = renderHook(() => useResetDraft(SEASON), { wrapper });

    await result.current.mutateAsync();
    expect(rpc).toHaveBeenCalledWith('reset_draft', { p_season_id: SEASON });
    expect(toast.success).toHaveBeenCalledWith(
      'Draft reset — all picks and drafted roster spots cleared',
    );
    expect(invalidate).toHaveBeenCalled();

    rpc.mockResolvedValue({ data: null, error: { message: 'Admin only' } } as never);
    await expect(result.current.mutateAsync()).rejects.toThrow('Admin only');
    expect(toast.error).toHaveBeenCalledWith('Admin only');
  });
});
