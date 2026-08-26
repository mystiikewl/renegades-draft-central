import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

export interface ProposeTradeInput {
  toTeamId: string;
  offeredRosterIds: string[];
  offeredPickIds: string[];
  requestedRosterIds: string[];
  requestedPickIds: string[];
  note?: string;
}

function invalidateTradeState(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  qc.invalidateQueries({ queryKey: qk.trades(seasonId) });
  qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
  qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
  qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
}

export function useProposeTrade(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposeTradeInput) => {
      const { data, error } = await supabase.rpc('propose_trade', {
        p_season_id: seasonId,
        p_to_team_id: input.toTeamId,
        p_offered_roster_ids: input.offeredRosterIds,
        p_offered_pick_ids: input.offeredPickIds,
        p_requested_roster_ids: input.requestedRosterIds,
        p_requested_pick_ids: input.requestedPickIds,
        p_note: input.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      invalidateTradeState(qc, seasonId);
      toast.success('Trade proposed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

function useResolveTrade(
  seasonId: string,
  rpc: 'accept_trade' | 'reject_trade' | 'cancel_trade',
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tradeId: string) => {
      const { error } = await supabase.rpc(rpc, { p_trade_id: tradeId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateTradeState(qc, seasonId);
      toast.success(successMessage);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAcceptTrade(seasonId: string) {
  return useResolveTrade(seasonId, 'accept_trade', 'Trade accepted');
}

export function useRejectTrade(seasonId: string) {
  return useResolveTrade(seasonId, 'reject_trade', 'Trade rejected');
}

export function useCancelTrade(seasonId: string) {
  return useResolveTrade(seasonId, 'cancel_trade', 'Trade cancelled');
}
