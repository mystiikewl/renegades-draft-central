import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  DraftPick,
  DraftSettings,
  PlayerWithStats,
  Profile,
  RosterEntry,
  Season,
  Team,
} from './types';

/**
 * Query keys: one per table, scoped by season where relevant. The realtime
 * layer (./realtime.ts) invalidates these keys on Postgres changes — the
 * single cache-invalidation pattern replacing the old 5 overlapping hooks.
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
      const { data, error } = await supabase.from('teams').select('*').order('name');
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
        .select('*, players(name, position, nba_team), teams(name)')
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
      const { data, error } = await supabase
        .from('players')
        .select('*, player_seasons(stats)')
        .eq('player_seasons.season_id', seasonId)
        .order('name');
      if (error) throw error;
      return data as PlayerWithStats[];
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
        .select('*, players(name, position, nba_team)')
        .eq('season_id', seasonId);
      if (error) throw error;
      return data as RosterEntry[];
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
  };
}
