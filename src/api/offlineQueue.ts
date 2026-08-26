import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Offline pick queue. Every intent is bound to the exact pick slot the user
 * was viewing. A reconnect can never apply an old player choice to a later
 * round or snake-turnaround pick.
 */
export interface QueuedPick {
  seasonId: string;
  pickId: string;
  pickNumber: number;
  playerId: string;
  playerName: string;
  queuedAt: number;
}

interface OfflineQueueState {
  queue: QueuedPick[];
  enqueue: (pick: QueuedPick) => void;
  drop: (pickId: string) => void;
}

export const useOfflineQueue = create<OfflineQueueState>((set) => ({
  queue: [],
  enqueue: (pick) =>
    set((s) =>
      s.queue.some((q) => q.pickId === pick.pickId)
        ? s
        : { queue: [...s.queue, pick] }
    ),
  drop: (pickId) =>
    set((s) => ({ queue: s.queue.filter((q) => q.pickId !== pickId) })),
}));

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const head = state.queue[0];
  try {
    const { error } = await supabase.rpc('make_pick_for_slot', {
      p_season_id: head.seasonId,
      p_pick_id: head.pickId,
      p_player_id: head.playerId,
    });
    if (error) {
      useOfflineQueue.getState().drop(head.pickId);
      toast.error(`Queued pick #${head.pickNumber} for ${head.playerName} was rejected: ${error.message}`);
    } else {
      useOfflineQueue.getState().drop(head.pickId);
      toast.success(`Pick #${head.pickNumber} submitted: ${head.playerName}`);
    }
    if (useOfflineQueue.getState().queue.length) scheduleFlush(3000);
    else stopTimer();
  } catch {
    // Still offline; retain the exact-slot intent and retry later.
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
