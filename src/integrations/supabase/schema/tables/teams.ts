// Types for the teams table
export type TeamsRow = {
  created_at: string
  id: string
  name: string
  owner_email: string | null
  updated_at: string
}

export type TeamsInsert = {
  created_at?: string
  id?: string
  name: string
  owner_email?: string | null
  updated_at?: string
}

export type TeamsUpdate = {
  created_at?: string
  id?: string
  name?: string
  owner_email?: string | null
  updated_at?: string
}

export const teamsRelationships = [] as const;