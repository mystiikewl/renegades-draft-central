// Types for the profiles table
export type ProfilesRow = {
  created_at: string
  email: string
  id: string
  is_admin: boolean | null
  onboarding_complete: boolean | null
  team_id: string | null
  updated_at: string
  user_id: string
}

export type ProfilesInsert = {
  created_at?: string
  email: string
  id?: string
  is_admin?: boolean | null
  onboarding_complete?: boolean | null
  team_id?: string | null
  updated_at?: string
  user_id: string
}

export type ProfilesUpdate = {
  created_at?: string
  email?: string
  id?: string
  is_admin?: boolean | null
  onboarding_complete?: boolean | null
  team_id?: string | null
  updated_at?: string
  user_id?: string
}

export const profilesRelationships = [
  {
    foreignKeyName: "profiles_team_id_fkey",
    columns: ["team_id"],
    isOneToOne: false,
    referencedRelation: "teams",
    referencedColumns: ["id"],
  },
] as const;