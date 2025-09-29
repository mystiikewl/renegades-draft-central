// Types for the draft_settings table
import type { Json } from '../enums';

export type DraftSettingsRow = {
  created_at: string | null
  draft_order: Json | null
  draft_type: string | null
  id: string
  league_size: number
  pick_time_limit_seconds: number | null
  roster_size: number
  season: string | null
}

export type DraftSettingsInsert = {
  created_at?: string | null
  draft_order?: Json | null
  draft_type?: string | null
  id?: string
  league_size?: number
  pick_time_limit_seconds?: number | null
  roster_size?: number
  season?: string | null
}

export type DraftSettingsUpdate = {
  created_at?: string | null
  draft_order?: Json | null
  draft_type?: string | null
  id?: string
  league_size?: number
  pick_time_limit_seconds?: number | null
  roster_size?: number
  season?: string | null
}

export const draftSettingsRelationships = [] as const;