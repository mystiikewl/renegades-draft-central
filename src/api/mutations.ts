import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

/**
 * All draft mutations go through SECURITY DEFINER RPCs — the client never
 * writes draft_picks or rosters directly. Errors from the RPCs (turn checks,
 * availability, admin gates) surface as user-facing toasts.
 */

function invalidateSeason(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
  qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
  qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
  qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
}

export function useMakePick(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string) => {
      const { data, error } = await supabase.rpc('make_pick', {
        p_season_id: seasonId,
        p_player_id: playerId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateSeason(qc, seasonId),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUndoLastPick(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('undo_last_pick', { p_season_id: seasonId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Pick undone');
      invalidateSeason(qc, seasonId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useClaimTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.rpc('claim_team', { p_team_id: teamId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teams });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleFavourite(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playerId, favourited }: { playerId: string; favourited: boolean }) => {
      if (favourited) {
        const { error } = await supabase
          .from('user_favourites')
          .delete()
          .eq('player_id', playerId)
          .eq('season_id', seasonId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('user_favourites')
          .insert({ player_id: playerId, season_id: seasonId });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favourites'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}
