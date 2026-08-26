import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isNetworkError, queuePick, useOfflineQueue } from './offlineQueue';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const rpc = vi.mocked(supabase.rpc);

function queuedPick(playerId = 'p1') {
  return { seasonId: 's1', playerId, playerName: `Player ${playerId}`, queuedAt: 1 };
}

describe('isNetworkError', () => {
  it('returns true for TypeError', () => {
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(true);
  });

  it('returns true for messages containing fetch/network', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('something FETCH related'))).toBe(true);
  });

  it('returns true when navigator is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isNetworkError(new Error('any'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false for RPC-shaped errors', () => {
    expect(isNetworkError(new Error('Not your turn'))).toBe(false);
    expect(isNetworkError(new Error('Player already drafted'))).toBe(false);
    expect(isNetworkError('Not an error object')).toBe(false);
  });
});

describe('offline queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useOfflineQueue.setState({ queue: [] });
    rpc.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.info).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enqueue dedupes by playerId', () => {
    queuePick(queuedPick('p1'));
    queuePick({ ...queuedPick('p1'), queuedAt: 2 });
    expect(useOfflineQueue.getState().queue).toHaveLength(1);
  });

  it('flush succeeds → queue drained + success toast', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(rpc).toHaveBeenCalledWith('make_pick', { p_season_id: 's1', p_player_id: 'p1' });
    expect(toast.success).toHaveBeenCalledWith('Pick submitted: Player p1');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('replay RPC rejection → pick dropped + error toast, not retried', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Player already drafted' } } as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(
      'Queued pick for Player p1 was rejected: Player already drafted',
    );
    // Drop is definitive — no further replay attempts.
    const calls = rpc.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rpc.mock.calls.length).toBe(calls);
  });

  it('still offline (rpc throws) → queue retained and retried', async () => {
    rpc.mockRejectedValue(new TypeError('fetch failed') as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    // Interval retry kicks in and stays queued while the network is down.
    rpc.mockRejectedValue(new TypeError('fetch failed') as never);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(useOfflineQueue.getState().queue).toHaveLength(1);
  });

  it('navigator offline → flush skipped, queue retained', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    rpc.mockResolvedValue({ data: null, error: null } as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(rpc).not.toHaveBeenCalled();
    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
