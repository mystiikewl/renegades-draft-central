import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateTables, REALTIME_TABLES } from './invalidation';

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

let realtimeStatus: RealtimeStatus = 'connecting';
const listeners = new Set<() => void>();
type DraftChannel = {
  channel: ReturnType<typeof supabase.channel>;
  consumers: Map<QueryClient, number>;
};
const draftChannels = new Map<string, DraftChannel>();

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

    let draftChannel = draftChannels.get(seasonId);
    if (!draftChannel) {
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
            () => {
              const shared = draftChannels.get(seasonId);
              shared?.consumers.forEach((_count, queryClient) =>
                invalidateTables(queryClient, seasonId, table),
              );
            },
          ),
        supabase.channel(`draft-${seasonId}`),
      ).subscribe(setChannelStatus);
      draftChannel = { channel, consumers: new Map() };
      draftChannels.set(seasonId, draftChannel);
    }

    draftChannel.consumers.set(qc, (draftChannel.consumers.get(qc) ?? 0) + 1);

    return () => {
      const remaining = (draftChannel.consumers.get(qc) ?? 1) - 1;
      if (remaining === 0) draftChannel.consumers.delete(qc);
      else draftChannel.consumers.set(qc, remaining);

      if (draftChannel.consumers.size === 0) {
        supabase.removeChannel(draftChannel.channel);
        draftChannels.delete(seasonId);
      }
    };
  }, [seasonId, qc]);
}
