// Types for the keepers table
export type KeepersRow = {
  created_at: string
  id: number
  player_id: string
  season: string
  team_id: string
}

export type KeepersInsert = {
  created_at?: string
  id?: number
  player_id: string
  season: string
  team_id: string
}

export type KeepersUpdate = {
  created_at?: string
  id?: number
  player_id?: string
  season?: string
  team_id?: string
}

export const keepersRelationships = [
  {
    foreignKeyName: "keepers_player_id_fkey",
    columns: ["player_id"],
    isOneToOne: false,
    referencedRelation: "players",
    referencedColumns: ["id"],
  },
  {
    foreignKeyName: "keepers_team_id_fkey",
    columns: ["team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
] as const;