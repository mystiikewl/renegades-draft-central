import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

/**
 * THE realtime layer — one Postgres channel that invalidates the TanStack
 * Query cache on any draft-relevant change. Every client sees picks, rosters
 * and settings updates without bespoke subscription hooks.
 *
 * Mount once (in the app root) with the active season id.
 */
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () =>
        qc.invalidateQueries({ queryKey: qk.teams })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId, qc]);
}
