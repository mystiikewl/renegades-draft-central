import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

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

    const channel = supabase
      .channel(`draft-${seasonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_picks', filter: `season_id=eq.${seasonId}` },
        () => qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rosters', filter: `season_id=eq.${seasonId}` },
        () => {
          qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
          qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_settings',
          filter: `season_id=eq.${seasonId}`,
        },
        () => qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `season_id=eq.${seasonId}` },
        () => qc.invalidateQueries({ queryKey: qk.trades(seasonId) })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trade_assets' },
        () => qc.invalidateQueries({ queryKey: qk.trades(seasonId) })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () =>
        qc.invalidateQueries({ queryKey: qk.teams })
      )
      .subscribe(setChannelStatus);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId, qc]);
}
