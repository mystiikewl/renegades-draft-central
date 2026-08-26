import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';
import { isNetworkError, queuePick } from './offlineQueue';

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
    mutationFn: async ({
      playerId,
      playerName,
    }: {
      playerId: string;
      playerName: string;
    }) => {
      const { data, error } = await supabase.rpc('make_pick', {
        p_season_id: seasonId,
        p_player_id: playerId,
      });
      if (error) throw new Error(error.message);
      return { data, playerName };
    },
    onSuccess: (_res) => invalidateSeason(qc, seasonId),
    onError: (err: Error, { playerId, playerName }) => {
      if (isNetworkError(err)) {
        queuePick({ seasonId, playerId, playerName, queuedAt: Date.now() });
        toast.info(`Offline — pick of ${playerName} queued and will submit when you reconnect`);
        return;
      }
      toast.error(err.message);
    },
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

export function useSetTeamColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, teamColor }: { teamId: string; teamColor: string }) => {
      const { error } = await supabase.rpc('set_team_color', {
        p_team_id: teamId,
        p_team_color: teamColor,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teams });
      toast.success('Team colour saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase.rpc('create_season', { p_label: label });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.seasons });
      qc.invalidateQueries({ queryKey: qk.activeSeason });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetDraftOrder(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: string[]) => {
      const { error } = await supabase.rpc('set_draft_order', {
        p_season_id: seasonId,
        p_order: order,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Draft order saved — board regenerated');
      invalidateSeason(qc, seasonId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetDraftStatus(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: 'pre_draft' | 'paused' | 'running' | 'complete') => {
      const { error } = await supabase.rpc('set_draft_status', {
        p_season_id: seasonId,
        p_status: status,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateSeason(qc, seasonId),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResetDraft(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_draft', { p_season_id: seasonId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Draft reset — all picks and drafted roster spots cleared');
      invalidateSeason(qc, seasonId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Keepers are roster rows with acquisition='keeper'. Assigning/removing only
 * changes rosters — the pool query derives from rosters, so those two keys are
 * what needs invalidating (picks/settings are untouched).
 */
function invalidateKeepers(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
  qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
}

export function useAssignKeeper(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, playerId }: { teamId: string; playerId: string }) => {
      const { error } = await supabase.rpc('assign_keeper', {
        p_season_id: seasonId,
        p_team_id: teamId,
        p_player_id: playerId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateKeepers(qc, seasonId),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveKeeper(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, playerId }: { teamId: string; playerId: string }) => {
      const { error } = await supabase.rpc('remove_keeper', {
        p_season_id: seasonId,
        p_team_id: teamId,
        p_player_id: playerId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateKeepers(qc, seasonId),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFinalizeKeepers(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('finalize_keepers', {
        p_season_id: seasonId,
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (dropped) => {
      qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
      qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
      qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
      qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
      toast.success(`Keepers locked — ${dropped} non-keepers dropped, draft picks generated.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface UpdateDraftSettingsInput {
  league_size: number;
  roster_size: number;
  keeper_limit: number;
  draft_type: 'snake' | 'linear';
  pick_time_limit_seconds: number;
}

/** Upserts the editable draft config. Locked server-side once status != pre_draft. */
export function useUpdateDraftSettings(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDraftSettingsInput) => {
      const { error } = await supabase.rpc('update_draft_settings', {
        p_season_id: seasonId,
        p_league_size: input.league_size,
        p_roster_size: input.roster_size,
        p_keeper_limit: input.keeper_limit,
        p_draft_type: input.draft_type,
        p_pick_time_limit_seconds: input.pick_time_limit_seconds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Draft settings saved');
      qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTradePick(seasonId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
  return useMutation({
    mutationFn: async ({ pickId, toTeamId }: { pickId: string; toTeamId: string }) => {
      const { error } = await supabase.rpc('trade_pick', {
        p_pick_id: pickId,
        p_to_team_id: toTeamId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Pick traded.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSwapPicks(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mine, theirs }: { mine: string; theirs: string }) => {
      const { error } = await supabase.rpc('swap_picks', {
        p_mine: mine,
        p_theirs: theirs,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
      toast.success('Picks swapped.');
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
