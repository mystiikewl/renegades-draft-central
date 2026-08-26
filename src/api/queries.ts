import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { pickStatsSeason } from '@/lib/stats';
import type {
  DraftPick,
  DraftSettings,
  PlayerWithStats,
  Profile,
  RosterEntry,
  Season,
  Team,
  Trade,
} from './types';

/**
 * Query keys: one per table, scoped by season where relevant. The realtime
 * layer (./realtime.ts) invalidates these keys on Postgres changes.
 */
export const qk = {
  seasons: ['seasons'] as const,
  activeSeason: ['season', 'active'] as const,
  teams: ['teams'] as const,
  profile: (userId: string | undefined) => ['profile', userId] as const,
  draftSettings: (seasonId: string) => ['draft-settings', seasonId] as const,
  draftPicks: (seasonId: string) => ['draft-picks', seasonId] as const,
  playerPool: (seasonId: string) => ['player-pool', seasonId] as const,
  rosters: (seasonId: string) => ['rosters', seasonId] as const,
  trades: (seasonId: string) => ['trades', seasonId] as const,
};

export function useSeasons() {
  return useQuery({
    queryKey: qk.seasons,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Season[];
    },
  });
}

export function useActiveSeason() {
  return useQuery({
    queryKey: qk.activeSeason,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data as Season | null) ?? null;
    },
  });
}

export function useTeams() {
  return useQuery({
    queryKey: qk.teams,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('is_shadow', false).order('name');
      if (error) throw error;
      return data as Team[];
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.profile(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useDraftSettings(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.draftSettings(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_settings')
        .select('*')
        .eq('season_id', seasonId)
        .maybeSingle();
      if (error) throw error;
      return data as DraftSettings | null;
    },
  });
}

export function useDraftPicks(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.draftPicks(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_picks')
        .select('*, players(name, position, nba_team, espn_id), team:teams!draft_picks_team_id_fkey(name)')
        .eq('season_id', seasonId)
        .order('pick_number');
      if (error) throw error;
      return data as DraftPick[];
    },
  });
}

/** Full player pool with the given season's stats, minus already-rostered players. */
export function usePlayerPool(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.playerPool(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const [playersRes, rosteredRes] = await Promise.all([
        supabase
          .from('players')
          .select('*, player_seasons(season_id, stats, seasons(label))')
          .not('espn_id', 'is', null)
          .order('name'),
        supabase.from('rosters').select('player_id').eq('season_id', seasonId),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (rosteredRes.error) throw rosteredRes.error;
      const rostered = new Set(rosteredRes.data.map((r) => r.player_id));
      const withPreferredStats = (playersRes.data as PlayerWithStats[]).map((p) => {
        const best = pickStatsSeason(p.player_seasons ?? [], seasonId!);
        return { ...p, player_seasons: best ? [best as PlayerWithStats['player_seasons'][number]] : [] };
      });
      return withPreferredStats.filter((p) => !rostered.has(p.id));
    },
  });
}

export function useRosters(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.rosters(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rosters')
        .select('*, players(name, position, nba_team, espn_id)')
        .eq('season_id', seasonId);
      if (error) throw error;
      return data as RosterEntry[];
    },
  });
}

export function useTrades(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.trades(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          from_team:teams!trades_from_team_id_fkey(id, name),
          to_team:teams!trades_to_team_id_fkey(id, name),
          assets:trade_assets(*)
        `)
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
  });
}

/** Convenience: invalidate every query key touching a season's draft data. */
export function useInvalidateDraft() {
  const qc = useQueryClient();
  return (seasonId: string) => {
    qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
    qc.invalidateQueries({ queryKey: qk.playerPool(seasonId) });
    qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
    qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
    qc.invalidateQueries({ queryKey: qk.trades(seasonId) });
  };
}
