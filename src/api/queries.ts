import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { selectPreferredStats, type ProjectionStatsRow } from '@/lib/projectionData';
import { pickStatsSeason, type StatsSeasonRow } from '@/lib/stats';
import type {
  AdminLogEntry,
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
 * layer (./realtime.ts) invalidates these keys on Postgres changes. Derived
 * pools (usePlayerPool, usePracticeDraftPool) compose these queries and carry
 * no keys of their own.
 */
export const qk = {
  seasons: ['seasons'] as const,
  activeSeason: ['season', 'active'] as const,
  teams: ['teams'] as const,
  profile: (userId: string | undefined) => ['profile', userId] as const,
  draftSettings: (seasonId: string) => ['draft-settings', seasonId] as const,
  draftPicks: (seasonId: string) => ['draft-picks', seasonId] as const,
  players: (seasonId: string) => ['players', seasonId] as const,
  rosters: (seasonId: string) => ['rosters', seasonId] as const,
  trades: (seasonId: string) => ['trades', seasonId] as const,
  teamTrades: (seasonId: string, teamId: string) => [...qk.trades(seasonId), 'team', teamId] as const,
  favourites: (seasonId: string) => ['favourites', seasonId] as const,
  notifications: ['notifications'] as const,
  gameLog: (espnId: string | null | undefined, competition: string, season: number) =>
    ['game-log', competition, season, espnId] as const,
  adminLog: ['admin-log'] as const,
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

type RawPlayerRow = PlayerWithStats & { projections?: ProjectionStatsRow[] };

/** Resolve one player's effective stats row: ESPN projection first, historical fallback. */
function toStatsEnrichedPlayer(row: RawPlayerRow, seasonId: string): PlayerWithStats {
  const selected = selectPreferredStats(row.player_seasons ?? [], row.projections ?? [], seasonId);
  const { projections: _projections, ...player } = row;
  return {
    ...player,
    player_seasons: selected.row
      ? [{ season_id: selected.row.season_id, stats: selected.row.stats ?? {} }]
      : [],
    stats_source: selected.source,
    stats_updated_at: selected.updatedAt,
    stats_uses_historical_fallback: selected.usesHistoricalFallback,
  } as PlayerWithStats;
}

/**
 * Every player with their preferred-stats row resolved — the one read behind
 * the Player Pool, Practice Draft and Player Lab. Cached under a single key so
 * realtime changes to players/projections/rosters refresh every consumer.
 */
export function useStatsEnrichedPlayers(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.players(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*, player_seasons(season_id, stats, seasons(label)), projections(season_id, stats, source, updated_at)')
        .not('espn_id', 'is', null)
        .order('name');
      if (error) throw error;
      return (data as RawPlayerRow[]).map((row) => toStatsEnrichedPlayer(row, seasonId!));
    },
  });
}

/** Full player pool with the given season's stats, minus already-rostered players. */
export function usePlayerPool(seasonId: string | undefined) {
  const players = useStatsEnrichedPlayers(seasonId);
  const rosters = useRosters(seasonId);
  const rosterRows = rosters.data;
  const data =
    players.data && rosterRows
      ? players.data.filter((p) => !rosterRows.some((r) => r.player_id === p.id))
      : undefined;
  return {
    ...players,
    data,
    isLoading: players.isLoading || rosters.isLoading,
    error: players.error ?? rosters.error,
  };
}

/**
 * Practice starts from a clean pre-draft universe. Keepers stay protected, but
 * live draft/trade roster changes do not remove players from a user's private
 * simulation. This hook is deliberately read-only.
 */
export function usePracticeDraftPool(seasonId: string | undefined) {
  const players = useStatsEnrichedPlayers(seasonId);
  const rosters = useRosters(seasonId);
  const rosterRows = rosters.data;
  const data =
    players.data && rosterRows
      ? players.data.filter(
          (p) => !rosterRows.some((r) => r.player_id === p.id && r.acquisition === 'keeper'),
        )
      : undefined;
  return {
    ...players,
    data,
    isLoading: players.isLoading || rosters.isLoading,
    error: players.error ?? rosters.error,
  };
}

export function useRosters(seasonId: string | undefined) {
  return useQuery({
    queryKey: qk.rosters(seasonId ?? 'none'),
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rosters')
        .select('*, players(name, position, nba_team, espn_id, player_seasons(season_id, stats))')
        .eq('season_id', seasonId);
      if (error) throw error;
      return data as RosterEntry[];
    },
  });
}

/**
 * Adapt a roster row to the stats-hungry PlayerWithStats shape the analytics
 * modules consume: best stats row for the season, null when there is nothing
 * to read. Previously faked independently by Analysis, Team Builder and
 * Power Rankings.
 */
export function rosteredPlayer(entry: RosterEntry, seasonId: string): PlayerWithStats | null {
  if (!entry.player_id || !entry.players) return null;
  const best = pickStatsSeason((entry.players.player_seasons ?? []) as StatsSeasonRow[], seasonId);
  if (!best) return null;
  return {
    id: entry.player_id,
    name: entry.players.name,
    position: entry.players.position,
    nba_team: entry.players.nba_team ?? null,
    espn_id: entry.players.espn_id ?? null,
    image_url: null,
    created_at: '',
    player_seasons: [{ season_id: best.season_id, stats: best.stats ?? {} }],
  };
}

/** Roster rows paired with their adapted PlayerWithStats — one adapter for every analytics page. */
export function useRosterWithStats(seasonId: string | undefined) {
  const rosters = useRosters(seasonId);
  const rows = rosters.data;
  const data = useMemo(
    () =>
      rows
        ? rows.map((entry) => ({ entry, player: rosteredPlayer(entry, seasonId ?? '') }))
        : undefined,
    [rows, seasonId],
  );
  return { ...rosters, data };
}

/** League-wide trade read — admin views only. RLS hides other teams' trades from everyone else. */
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

/** Trades involving one team — the read behind Trade Center and My Team. */
export function useTeamTrades(seasonId: string | undefined, teamId: string | undefined) {
  return useQuery({
    queryKey: qk.teamTrades(seasonId ?? 'none', teamId ?? 'none'),
    enabled: !!seasonId && !!teamId,
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
        .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
  });
}

/** Append-only record of destructive commissioner actions (admin-read-only via RLS). */
export function useAdminLog(limit = 30) {
  return useQuery({
    queryKey: [...qk.adminLog, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_log')
        .select('id, at, actor, action, payload, profiles(display_name)')
        .order('at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AdminLogEntry[];
    },
  });
}
