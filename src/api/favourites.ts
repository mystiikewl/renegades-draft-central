import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { invalidateTables } from './invalidation';
import { qk } from './queries';
import type { UserFavourite } from './types';

/**
 * The watchlist. user_favourites is the one table the client writes directly
 * (every RLS policy is scoped to profile_id = auth.uid()), so no RPCs here.
 * Rows are per-user and invisible to other members, so mutations invalidate
 * directly instead of riding the shared realtime channel.
 */

export function useFavourites(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.favourites(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_favourites')
        .select('*')
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserFavourite[];
    },
  });
}

/** Player-id set for cheap "is this watched?" checks in long lists. */
export function useFavouriteIds(seasonId: string | undefined): Set<string> {
  const { data } = useFavourites(seasonId);
  return useMemo(() => new Set((data ?? []).map((row) => row.player_id)), [data]);
}

/** Add (watch: true) or remove (watch: false) one player for the active season. */
export function useToggleFavourite(seasonId: string | undefined) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ playerId, watch }: { playerId: string; watch: boolean }) => {
      if (!profile || !seasonId) throw new Error('Sign in to use the watchlist.');
      if (watch) {
        const { error } = await supabase
          .from('user_favourites')
          .insert({ profile_id: profile.id, player_id: playerId, season_id: seasonId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favourites')
          .delete()
          .eq('profile_id', profile.id)
          .eq('player_id', playerId)
          .eq('season_id', seasonId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateTables(qc, seasonId, 'user_favourites'),
    onError: () => toast.error('Could not update your watchlist.'),
  });
}
