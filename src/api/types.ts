// Domain types for the 2026 schema. Kept hand-written and minimal;
// mirrors supabase/migrations/20260825000001_init_schema.sql.

export type SeasonStatus = 'archived' | 'pre_draft' | 'live' | 'complete';
export type DraftStatus = 'pre_draft' | 'paused' | 'running' | 'complete';
export type DraftType = 'snake' | 'linear';
export type Acquisition = 'draft' | 'keeper' | 'trade';

export interface Season {
  id: string;
  label: string;
  status: SeasonStatus;
  is_active: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_profile_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  team_id: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Player {
  id: string;
  espn_id: string | null;
  name: string;
  position: string | null;
  nba_team: string | null;
  image_url: string | null;
  created_at: string;
}

export interface PlayerSeason {
  player_id: string;
  season_id: string;
  stats: Record<string, number | string | null>;
  updated_at: string;
}

export type PlayerWithStats = Player & {
  player_seasons: Pick<PlayerSeason, 'stats'>[];
};

export interface DraftSettings {
  id: string;
  season_id: string;
  league_size: number;
  roster_size: number;
  keeper_limit: number;
  draft_type: DraftType;
  pick_time_limit_seconds: number;
  status: DraftStatus;
  draft_order: string[];
  updated_at: string;
}

export interface DraftPick {
  id: string;
  season_id: string;
  round: number;
  pick_number: number;
  team_id: string;
  original_team_id: string;
  player_id: string | null;
  is_used: boolean;
  picked_at: string | null;
  players?: Pick<Player, 'name' | 'position' | 'nba_team'> | null;
  teams?: Pick<Team, 'name'> | null;
}

export interface RosterEntry {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  acquisition: Acquisition;
  draft_pick_id: string | null;
  acquired_at: string;
  players?: Pick<Player, 'name' | 'position' | 'nba_team'> | null;
}

export interface Favourite {
  id: string;
  profile_id: string;
  player_id: string;
  season_id: string;
}
