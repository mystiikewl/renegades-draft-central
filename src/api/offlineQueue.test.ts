import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  STALE_QUEUED_PICK_MS,
  isNetworkError,
  queuePick,
  useOfflineQueue,
} from './offlineQueue';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const rpc = vi.mocked(supabase.rpc);

function queuedPick(playerId = 'p1') {
  return { seasonId: 's1', pickId: 'pk1', pickNumber: 7, playerId, playerName: `Player ${playerId}`, queuedAt: Date.now() };
}

function readStoredQueue() {
  const raw = localStorage.getItem('renegades-offline-pick-queue');
  return raw ? (JSON.parse(raw).state.queue as unknown[]) : [];
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
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    localStorage.clear();
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
    expect(rpc).toHaveBeenCalledWith('make_pick_for_slot', {
      p_season_id: 's1',
      p_pick_id: 'pk1',
      p_player_id: 'p1',
    });
    expect(toast.success).toHaveBeenCalledWith('Pick #7 submitted: Player p1');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('replay RPC rejection → pick dropped + error toast, not retried', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Player already drafted' } } as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(
      'Queued pick #7 for Player p1 was rejected: Player already drafted',
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

  it('enqueue persists the queue to localStorage', () => {
    queuePick(queuedPick('p1'));
    const stored = readStoredQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ pickId: 'pk1', playerId: 'p1' });
  });

  it('rehydrate drops entries older than 10 minutes, keeps fresh ones', async () => {
    const now = Date.now();
    localStorage.setItem(
      'renegades-offline-pick-queue',
      JSON.stringify({
        state: {
          queue: [
            { ...queuedPick('stale'), pickId: 'pk-stale', queuedAt: now - STALE_QUEUED_PICK_MS - 1 },
            { ...queuedPick('fresh'), pickId: 'pk-fresh', queuedAt: now - 30_000 },
          ],
        },
        version: 0,
      }),
    );
    await useOfflineQueue.persist.rehydrate();
    const queue = useOfflineQueue.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0].pickId).toBe('pk-fresh');
  });

  it('flush drops a stale head with a notice instead of submitting it', async () => {
    // Offline while the pick ages past the window, then reconnect: the
    // first post-reconnect flush must drop the expired intent, not send it.
    vi.stubGlobal('navigator', { onLine: false });
    rpc.mockResolvedValue({ data: null, error: null } as never);
    queuePick(queuedPick('p1'));
    await vi.advanceTimersByTimeAsync(STALE_QUEUED_PICK_MS + 30_000);
    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    vi.stubGlobal('navigator', { onLine: true });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rpc).not.toHaveBeenCalled();
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(toast.info).toHaveBeenCalledWith(
      'Queued pick #7 for Player p1 expired after 10 minutes — not submitted.',
    );
    expect(toast.success).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
