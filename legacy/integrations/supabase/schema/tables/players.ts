// Types for the players table
export type PlayersRow = {
  age: number | null
  assists: number | null
  blocks: number | null
  conference_rank: number | null
  created_at: string
  double_doubles: number | null
  drafted_by_team_id: string | null
  field_goal_percentage: number | null
  field_goals_made: number | null
  free_throw_percentage: number | null
  games_played: number | null
  id: string
  is_drafted: boolean | null
  is_keeper: boolean | null
  keeper_team_id: string | null
  minutes_per_game: number | null
  name: string
  nba_team: string
  overall_rank: number | null
  points: number | null
  position: string
  rank: number | null
  regional_rank: number | null
  steals: number | null
  three_point_percentage: number | null
  three_pointers_made: number | null
  total_rebounds: number | null
  total_score: number | null
  turnovers: number | null
}

export type PlayersInsert = {
  age?: number | null
  assists?: number | null
  blocks?: number | null
  conference_rank?: number | null
  created_at?: string
  double_doubles?: number | null
  drafted_by_team_id?: string | null
  field_goal_percentage?: number | null
  field_goals_made?: number | null
  free_throw_percentage?: number | null
  games_played?: number | null
  id?: string
  is_drafted?: boolean | null
  is_keeper?: boolean | null
  keeper_team_id?: string | null
  minutes_per_game?: number | null
  name: string
  nba_team: string
  overall_rank?: number | null
  points?: number | null
  position: string
  rank?: number | null
  regional_rank?: number | null
  steals?: number | null
  three_point_percentage?: number | null
  three_pointers_made?: number | null
  total_rebounds?: number | null
  total_score?: number | null
  turnovers?: number | null
}

export type PlayersUpdate = {
  age?: number | null
  assists?: number | null
  blocks?: number | null
  conference_rank?: number | null
  created_at?: string
  double_doubles?: number | null
  drafted_by_team_id?: string | null
  field_goal_percentage?: number | null
  field_goals_made?: number | null
  free_throw_percentage?: number | null
  games_played?: number | null
  id?: string
  is_drafted?: boolean | null
  is_keeper?: boolean | null
  keeper_team_id?: string | null
  minutes_per_game?: number | null
  name?: string
  nba_team?: string
  overall_rank?: number | null
  points?: number | null
  position?: string
  rank?: number | null
  regional_rank?: number | null
  steals?: number | null
  three_point_percentage?: number | null
  three_pointers_made?: number | null
  total_rebounds?: number | null
  total_score?: number | null
  turnovers?: number | null
}

export const playersRelationships = [
  {
    foreignKeyName: "players_drafted_by_team_id_fkey",
    columns: ["drafted_by_team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
  {
    foreignKeyName: "players_keeper_team_id_fkey",
    columns: ["keeper_team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
] as const;