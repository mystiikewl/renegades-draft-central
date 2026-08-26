// Domain types for the 2026 schema. Kept hand-written and minimal;
// mirrors supabase/migrations/20260825000001_init_schema.sql.

export type SeasonStatus = 'archived' | 'pre_draft' | 'live' | 'complete';
export type DraftStatus = 'pre_draft' | 'paused' | 'running' | 'complete';
export type DraftType = 'snake' | 'linear';
export type Acquisition = 'draft' | 'keeper' | 'trade';
export type TradeStatus = 'proposed' | 'accepted' | 'rejected' | 'cancelled';
export type TradeAssetType = 'player' | 'pick';

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
  is_shadow?: boolean;
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
  experience?: number | null;
  birth_date?: string | null;
  height?: string | null;
  weight?: number | null;
  draft_display?: string | null;
  created_at: string;
}

export interface PlayerSeason {
  player_id: string;
  season_id: string;
  stats: Record<string, number | string | null>;
  updated_at: string;
}

export type PlayerWithStats = Player & {
  player_seasons: (Pick<PlayerSeason, 'season_id' | 'stats'> & {
    seasons?: { label: string } | null;
  })[];
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
  turn_deadline_at?: string | null;
  paused_remaining_seconds?: number | null;
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
  is_skipped?: boolean;
  skipped_at?: string | null;
  picked_at: string | null;
  players?: Pick<Player, 'name' | 'position' | 'nba_team' | 'espn_id'> | null;
  team?: Pick<Team, 'name'> | null;
}

export interface RosterEntry {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  acquisition: Acquisition;
  draft_pick_id: string | null;
  acquired_at: string;
  players?: Pick<Player, 'name' | 'position' | 'nba_team' | 'espn_id'> & {
    player_seasons?: Pick<PlayerSeason, 'season_id' | 'stats'>[];
  } | null;
}

export interface TradeAsset {
  id: string;
  trade_id: string;
  from_team_id: string;
  to_team_id: string;
  asset_type: TradeAssetType;
  roster_id: string | null;
  draft_pick_id: string | null;
  asset_label: string;
  created_at: string;
}

export interface Trade {
  id: string;
  season_id: string;
  from_team_id: string;
  to_team_id: string;
  proposed_by: string;
  resolved_by: string | null;
  status: TradeStatus;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  is_admin_override?: boolean;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  from_team?: Pick<Team, 'id' | 'name'> | null;
  to_team?: Pick<Team, 'id' | 'name'> | null;
  assets?: TradeAsset[];
}

export interface Favourite {
  id: string;
  profile_id: string;
  player_id: string;
  season_id: string;
}
