import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Offline pick queue. If make_pick fails due to a NETWORK error (fetch
 * failure / offline — not an RPC rejection like wrong-turn or player-taken),
 * the intent is queued here and replayed when connectivity returns.
 * RPC rejections are never queued; they are toasted by the mutation.
 *
 * Successful replays rely on the realtime channel (./realtime.ts) to
 * invalidate the draft caches — same as any other client's pick.
 */

export interface QueuedPick {
  seasonId: string;
  playerId: string;
  playerName: string;
  queuedAt: number;
}

interface OfflineQueueState {
  queue: QueuedPick[];
  enqueue: (pick: QueuedPick) => void;
  drop: (playerId: string) => void;
}

export const useOfflineQueue = create<OfflineQueueState>((set) => ({
  queue: [],
  enqueue: (pick) =>
    set((s) =>
      s.queue.some((q) => q.playerId === pick.playerId)
        ? s
        : { queue: [...s.queue, pick] }
    ),
  drop: (playerId) =>
    set((s) => ({ queue: s.queue.filter((q) => q.playerId !== playerId) })),
}));

/** Distinguish transport failures (queue + retry) from RPC rejections (toast, drop). */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network/i.test(msg);
}

let retryTimer: ReturnType<typeof setInterval> | null = null;

function stopTimer() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

async function flushQueue() {
  const state = useOfflineQueue.getState();
  if (!state.queue.length) {
    stopTimer();
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return; // wait for 'online'

  const head = state.queue[0];
  try {
    const { error } = await supabase.rpc('make_pick', {
      p_season_id: head.seasonId,
      p_player_id: head.playerId,
    });
    if (error) {
      // Definitive rejection (wrong turn, player taken, …) — drop, don't retry.
      useOfflineQueue.getState().drop(head.playerId);
      toast.error(`Queued pick for ${head.playerName} was rejected: ${error.message}`);
    } else {
      useOfflineQueue.getState().drop(head.playerId);
      toast.success(`Pick submitted: ${head.playerName}`);
    }
    // Continue draining (next tick) whether this one landed or was dropped.
    if (useOfflineQueue.getState().queue.length) scheduleFlush(3000);
    else stopTimer();
  } catch {
    // Still offline — keep the queue; timer/online-event will retry.
  }
}

function scheduleFlush(delayMs: number) {
  stopTimer();
  retryTimer = setInterval(flushQueue, Math.max(delayMs, 15_000));
  setTimeout(flushQueue, delayMs);
}

let listenersBound = false;

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('online', () => scheduleFlush(1000));
}

export function queuePick(pick: QueuedPick) {
  bindListeners();
  useOfflineQueue.getState().enqueue(pick);
  scheduleFlush(3000);
}
