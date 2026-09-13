import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateTables, REALTIME_TABLES } from './invalidation';

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

let realtimeStatus: RealtimeStatus = 'connecting';
const listeners = new Set<() => void>();

function setRealtimeStatus(s: RealtimeStatus) {
  if (s === realtimeStatus) return;
  realtimeStatus = s;
  listeners.forEach((l) => l());
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => realtimeStatus
  );
}

function setChannelStatus(status: string) {
  if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
  else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
    setRealtimeStatus('disconnected');
}

export const _setChannelStatusForTest = setChannelStatus;

/** One Postgres channel invalidating all active-season league state. */
export function useDraftRealtime(seasonId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!seasonId) return;

    const channel = REALTIME_TABLES.reduce(
      (ch, { table, seasonScoped }) =>
        ch.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: seasonScoped ? `season_id=eq.${seasonId}` : undefined,
          },
          () => invalidateTables(qc, seasonId, table),
        ),
      supabase.channel(`draft-${seasonId}`),
    ).subscribe(setChannelStatus);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId, qc]);
}
