import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

export interface AdminTradeOverrideInput {
  fromTeamId: string;
  toTeamId: string;
  fromRosterIds: string[];
  fromPickIds: string[];
  toRosterIds: string[];
  toPickIds: string[];
  note?: string;
}

function invalidateTradeState(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  qc.invalidateQueries({ queryKey: qk.trades(seasonId) });
  qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
  qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
  qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
}

export function useAdminTradeOverride(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminTradeOverrideInput) => {
      const { data, error } = await supabase.rpc('admin_override_trade', {
        p_season_id: seasonId,
        p_from_team_id: input.fromTeamId,
        p_to_team_id: input.toTeamId,
        p_from_roster_ids: input.fromRosterIds,
        p_from_pick_ids: input.fromPickIds,
        p_to_roster_ids: input.toRosterIds,
        p_to_pick_ids: input.toPickIds,
        p_note: input.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      invalidateTradeState(qc, seasonId);
      toast.success('Commissioner trade applied and logged');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdminReverseTrade(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tradeId, reason }: { tradeId: string; reason?: string }) => {
      const { error } = await supabase.rpc('admin_reverse_trade', {
        p_trade_id: tradeId,
        p_reason: reason?.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateTradeState(qc, seasonId);
      toast.success('Trade reversed. Enter corrected terms as a new override if needed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
