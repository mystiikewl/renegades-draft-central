export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      draft_picks: {
        Row: {
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
        Insert: {
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
        Update: {
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
        Relationships: [
          {
            foreignKeyName: "draft_picks_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_original_team_id_fkey"
            columns: ["original_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_settings: {
        Row: {
          created_at: string | null
          draft_order: Json | null
          draft_type: string | null
          id: string
          league_size: number
          pick_time_limit_seconds: number | null
          roster_size: number
          season: string | null
        }
        Insert: {
          created_at?: string | null
          draft_order?: Json | null
          draft_type?: string | null
          id?: string
          league_size?: number
          pick_time_limit_seconds?: number | null
          roster_size?: number
          season?: string | null
        }
        Update: {
          created_at?: string | null
          draft_order?: Json | null
          draft_type?: string | null
          id?: string
          league_size?: number
          pick_time_limit_seconds?: number | null
          roster_size?: number
          season?: string | null
        }
        Relationships: []
      }
      keepers: {
        Row: {
          created_at: string
          id: string
          player_id: string
          season: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          season: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          season?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keepers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keepers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_seasons: {
        Row: {
          created_at: string
          id: number
          player_id: string
          season: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          player_id: string
          season: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: never
          player_id?: string
          season?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: number | null
          assists: number | null
          blocks: number | null
          created_at: string
          drafted_by_team_id: string | null
          field_goal_percentage: number | null
          field_goals_made: number | null
          free_throw_percentage: number | null
          games_played: number | null
          id: string
          is_drafted: boolean | null
          is_keeper: boolean | null
          is_rookie: boolean | null
          keeper_team_id: string | null
          minutes_per_game: number | null
          name: string
          nba_team: string
          points: number | null
          position: string
          rank: number | null
          steals: number | null
          three_point_percentage: number | null
          three_pointers_made: number | null
          total_rebounds: number | null
          turnovers: number | null
        }
        Insert: {
          age?: number | null
          assists?: number | null
          blocks?: number | null
          created_at?: string
          drafted_by_team_id?: string | null
          field_goal_percentage?: number | null
          field_goals_made?: number | null
          free_throw_percentage?: number | null
          games_played?: number | null
          id?: string
          is_drafted?: boolean | null
          is_keeper?: boolean | null
          is_rookie?: boolean | null
          keeper_team_id?: string | null
          minutes_per_game?: number | null
          name: string
          nba_team: string
          points?: number | null
          position: string
          rank?: number | null
          steals?: number | null
          three_point_percentage?: number | null
          three_pointers_made?: number | null
          total_rebounds?: number | null
          turnovers?: number | null
        }
        Update: {
          age?: number | null
          assists?: number | null
          blocks?: number | null
          created_at?: string
          drafted_by_team_id?: string | null
          field_goal_percentage?: number | null
          field_goals_made?: number | null
          free_throw_percentage?: number | null
          games_played?: number | null
          id?: string
          is_drafted?: boolean | null
          is_keeper?: boolean | null
          is_rookie?: boolean | null
          keeper_team_id?: string | null
          minutes_per_game?: number | null
          name?: string
          nba_team?: string
          points?: number | null
          position?: string
          rank?: number | null
          steals?: number | null
          three_point_percentage?: number | null
          three_pointers_made?: number | null
          total_rebounds?: number | null
          turnovers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_drafted_by_team_id_fkey"
            columns: ["drafted_by_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_keeper_team_id_fkey"
            columns: ["keeper_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_admin: boolean | null
          onboarding_complete: boolean | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean | null
          onboarding_complete?: boolean | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean | null
          onboarding_complete?: boolean | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_favourites: {
        Row: {
          created_at: string
          id: string
          player_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_favourites_player"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_team: {
        Args: { target_team_id: string }
        Returns: Json
      }
      get_all_keepers: {
        Args: { p_season: string }
        Returns: {
          id: string
          is_drafted: boolean
          is_keeper: boolean
          name: string
          nba_team: string
          position: string
        }[]
      }
      insert_user_favourite: {
        Args: { target_player_id: string }
        Returns: Json
      }
      invite_and_assign_user_to_team: {
        Args:
          | { target_team_id: number; user_email: string }
          | { target_team_id: string; user_email: string }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      unassign_team_owner: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
