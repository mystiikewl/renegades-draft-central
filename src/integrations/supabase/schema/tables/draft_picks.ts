// Types for the draft_picks table
export type DraftPicksRow = {
  created_at: string
  current_team_id: string
  id: string
  is_used: boolean | null
  original_team_id: string
  overall_pick: number | null
  pick_number: number
  player_id: string | null
  round: number
}

export type DraftPicksInsert = {
  created_at?: string
  current_team_id: string
  id?: string
  is_used?: boolean | null
  original_team_id: string
  overall_pick?: number | null
  pick_number: number
  player_id?: string | null
  round: number
}

export type DraftPicksUpdate = {
  created_at?: string
  current_team_id?: string
  id?: string
  is_used?: boolean | null
  original_team_id?: string
  overall_pick?: number | null
  pick_number?: number
  player_id?: string | null
  round?: number
}

export const draftPicksRelationships = [
  {
    foreignKeyName: "draft_picks_current_team_id_fkey",
    columns: ["current_team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
  {
    foreignKeyName: "draft_picks_original_team_id_fkey",
    columns: ["original_team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
  {
    foreignKeyName: "draft_picks_player_id_fkey",
    columns: ["player_id"],
    isOneToOne: false,
    referencedRelation: "players",
    referencedColumns: ["id"],
  },
] as const;