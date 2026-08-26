import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';
import { isNetworkError, queuePick } from './offlineQueue';

function invalidateDraft(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
  qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
  qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
  qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
}

export function useMakePickForSlot(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pickId,
      pickNumber,
      playerId,
      playerName,
    }: {
      pickId: string;
      pickNumber: number;
      playerId: string;
      playerName: string;
    }) => {
      const { data, error } = await supabase.rpc('make_pick_for_slot', {
        p_season_id: seasonId,
        p_pick_id: pickId,
        p_player_id: playerId,
      });
      if (error) throw new Error(error.message);
      return { data, playerName, pickNumber };
    },
    onSuccess: ({ playerName, pickNumber }) => {
      invalidateDraft(qc, seasonId);
      toast.success(`${playerName} drafted at #${pickNumber}`);
    },
    onError: (err: Error, input) => {
      if (isNetworkError(err)) {
        queuePick({
          seasonId,
          pickId: input.pickId,
          pickNumber: input.pickNumber,
          playerId: input.playerId,
          playerName: input.playerName,
          queuedAt: Date.now(),
        });
        toast.info(`Offline — ${input.playerName} is queued only for pick #${input.pickNumber}`);
        return;
      }
      toast.error(err.message);
    },
  });
}

export function useSkipPickForSlot(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pickId, pickNumber }: { pickId: string; pickNumber: number }) => {
      const { data, error } = await supabase.rpc('skip_pick_for_slot', {
        p_season_id: seasonId,
        p_pick_id: pickId,
      });
      if (error) throw new Error(error.message);
      return { data, pickNumber };
    },
    onSuccess: ({ pickNumber }) => {
      invalidateDraft(qc, seasonId);
      toast.success(`Pick #${pickNumber} skipped`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUndoDraftActionForSlot(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pickId }: { pickId: string }) => {
      const { error } = await supabase.rpc('undo_draft_action_for_slot', {
        p_season_id: seasonId,
        p_pick_id: pickId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateDraft(qc, seasonId);
      toast.success('Last draft action undone');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
