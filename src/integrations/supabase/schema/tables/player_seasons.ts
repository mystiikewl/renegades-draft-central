// Types for the player_seasons table
export type PlayerSeasonsRow = {
  created_at: string
  id: number
  player_id: string
  season: string
  team_id: string
}

export type PlayerSeasonsInsert = {
  created_at?: string
  id?: never
  player_id: string
  season: string
  team_id: string
}

export type PlayerSeasonsUpdate = {
  created_at?: string
  id?: never
  player_id?: string
  season?: string
  team_id?: string
}

export const playerSeasonsRelationships = [
  {
    foreignKeyName: "player_seasons_team_id_fkey",
    columns: ["team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
] as const;