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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          earned_at: string
          id: string
          key: string
          meta: Json | null
          name: string
          progress: number | null
          type: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          key: string
          meta?: Json | null
          name: string
          progress?: number | null
          type: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          key?: string
          meta?: Json | null
          name?: string
          progress?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string | null
          actual_duration_minutes: number | null
          created_at: string
          distance_km: number | null
          end_latitude: number | null
          end_longitude: number | null
          end_station_tfl_id: string | null
          ended_at: string | null
          estimated_duration_minutes: number | null
          gate_end_at: string | null
          gate_start_at: string | null
          id: string
          line_ids: string[] | null
          notes: string | null
          platform_end_at: string | null
          platform_start_at: string | null
          route_id: string | null
          start_latitude: number | null
          start_longitude: number | null
          start_station_tfl_id: string | null
          started_at: string
          station_tfl_ids: string[]
          status: string | null
          timing_mode: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          actual_duration_minutes?: number | null
          created_at?: string
          distance_km?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          end_station_tfl_id?: string | null
          ended_at?: string | null
          estimated_duration_minutes?: number | null
          gate_end_at?: string | null
          gate_start_at?: string | null
          id?: string
          line_ids?: string[] | null
          notes?: string | null
          platform_end_at?: string | null
          platform_start_at?: string | null
          route_id?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          start_station_tfl_id?: string | null
          started_at?: string
          station_tfl_ids: string[]
          status?: string | null
          timing_mode?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string | null
          actual_duration_minutes?: number | null
          created_at?: string
          distance_km?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          end_station_tfl_id?: string | null
          ended_at?: string | null
          estimated_duration_minutes?: number | null
          gate_end_at?: string | null
          gate_start_at?: string | null
          id?: string
          line_ids?: string[] | null
          notes?: string | null
          platform_end_at?: string | null
          platform_start_at?: string | null
          route_id?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          start_station_tfl_id?: string | null
          started_at?: string
          station_tfl_ids?: string[]
          status?: string | null
          timing_mode?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_likes: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_likes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_plan_item: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          line_hint: string | null
          seq_planned: number
          station_tfl_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          line_hint?: string | null
          seq_planned: number
          station_tfl_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          line_hint?: string | null
          seq_planned?: number
          station_tfl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_activity_plan_item_activity"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_type: string
          challenge_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string
          metro_system_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          badge_type?: string
          challenge_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          metro_system_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          badge_type?: string
          challenge_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          metro_system_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_metro_system_id_fkey"
            columns: ["metro_system_id"]
            isOneToOne: false
            referencedRelation: "metro_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_attempts: {
        Row: {
          activity_id: string
          challenge_id: string
          completed_at: string
          created_at: string
          duration_minutes: number
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          challenge_id: string
          completed_at: string
          created_at?: string
          duration_minutes: number
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          challenge_id?: string
          completed_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string
          created_at: string
          created_by_user_id: string | null
          created_from_route_id: string | null
          description: string | null
          difficulty: string | null
          estimated_duration_minutes: number | null
          id: string
          is_official: boolean
          metro_system_id: string
          name: string
          station_tfl_ids: string[]
          updated_at: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          created_by_user_id?: string | null
          created_from_route_id?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_official?: boolean
          metro_system_id: string
          name: string
          station_tfl_ids: string[]
          updated_at?: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          created_by_user_id?: string | null
          created_from_route_id?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_official?: boolean
          metro_system_id?: string
          name?: string
          station_tfl_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_from_route_id_fkey"
            columns: ["created_from_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_metro_system_id_fkey"
            columns: ["metro_system_id"]
            isOneToOne: false
            referencedRelation: "metro_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: []
      }
      metro_systems: {
        Row: {
          city: string
          code: string
          country: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          line_count: number | null
          name: string
          station_count: number | null
          updated_at: string
        }
        Insert: {
          city: string
          code: string
          country: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          line_count?: number | null
          name: string
          station_count?: number | null
          updated_at?: string
        }
        Update: {
          city?: string
          code?: string
          country?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          line_count?: number | null
          name?: string
          station_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          activity_id: string | null
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          home_station: string | null
          id: string
          last_active: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_station?: string | null
          id?: string
          last_active?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_station?: string | null
          id?: string
          last_active?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      route_stations: {
        Row: {
          created_at: string
          estimated_arrival_offset_minutes: number | null
          id: string
          is_bypass_allowed: boolean
          route_id: string
          sequence_number: number
          station_tfl_id: string
        }
        Insert: {
          created_at?: string
          estimated_arrival_offset_minutes?: number | null
          id?: string
          is_bypass_allowed?: boolean
          route_id: string
          sequence_number: number
          station_tfl_id: string
        }
        Update: {
          created_at?: string
          estimated_arrival_offset_minutes?: number | null
          id?: string
          is_bypass_allowed?: boolean
          route_id?: string
          sequence_number?: number
          station_tfl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          description: string | null
          end_station_tfl_id: string
          estimated_duration_minutes: number | null
          id: string
          is_public: boolean
          metro_system_id: string | null
          name: string
          start_station_tfl_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_station_tfl_id: string
          estimated_duration_minutes?: number | null
          id?: string
          is_public?: boolean
          metro_system_id?: string | null
          name: string
          start_station_tfl_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_station_tfl_id?: string
          estimated_duration_minutes?: number | null
          id?: string
          is_public?: boolean
          metro_system_id?: string | null
          name?: string
          start_station_tfl_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_metro_system_id_fkey"
            columns: ["metro_system_id"]
            isOneToOne: false
            referencedRelation: "metro_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      station_id_mapping: {
        Row: {
          created_at: string
          id: string
          tfl_id: string
          uuid_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tfl_id: string
          uuid_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tfl_id?: string
          uuid_id?: string
        }
        Relationships: []
      }
      station_special_interests: {
        Row: {
          created_at: string
          id: string
          interest_description: string | null
          interest_name: string
          station_tfl_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_description?: string | null
          interest_name: string
          station_tfl_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_description?: string | null
          interest_name?: string
          station_tfl_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      station_visits: {
        Row: {
          activity_id: string | null
          ai_confidence: number | null
          ai_station_text: string | null
          ai_verification_result: Json | null
          captured_at: string | null
          checkin_type: string | null
          created_at: string
          exif_gps_present: boolean | null
          exif_time_present: boolean | null
          geofence_distance_m: number | null
          gps_source: string | null
          id: string
          is_bypassed: boolean | null
          is_end_station: boolean | null
          is_simulation: boolean | null
          is_start_station: boolean | null
          latitude: number | null
          longitude: number | null
          pending_reason: string | null
          photo_url: string | null
          seq_actual: number | null
          sequence_number: number | null
          station_id: string | null
          station_tfl_id: string | null
          status: string
          thumb_url: string | null
          user_id: string
          verification_image_url: string | null
          verification_method: string | null
          verified_at: string | null
          verifier_version: string | null
          visit_lat: number | null
          visit_lon: number | null
          visited_at: string
        }
        Insert: {
          activity_id?: string | null
          ai_confidence?: number | null
          ai_station_text?: string | null
          ai_verification_result?: Json | null
          captured_at?: string | null
          checkin_type?: string | null
          created_at?: string
          exif_gps_present?: boolean | null
          exif_time_present?: boolean | null
          geofence_distance_m?: number | null
          gps_source?: string | null
          id?: string
          is_bypassed?: boolean | null
          is_end_station?: boolean | null
          is_simulation?: boolean | null
          is_start_station?: boolean | null
          latitude?: number | null
          longitude?: number | null
          pending_reason?: string | null
          photo_url?: string | null
          seq_actual?: number | null
          sequence_number?: number | null
          station_id?: string | null
          station_tfl_id?: string | null
          status?: string
          thumb_url?: string | null
          user_id: string
          verification_image_url?: string | null
          verification_method?: string | null
          verified_at?: string | null
          verifier_version?: string | null
          visit_lat?: number | null
          visit_lon?: number | null
          visited_at?: string
        }
        Update: {
          activity_id?: string | null
          ai_confidence?: number | null
          ai_station_text?: string | null
          ai_verification_result?: Json | null
          captured_at?: string | null
          checkin_type?: string | null
          created_at?: string
          exif_gps_present?: boolean | null
          exif_time_present?: boolean | null
          geofence_distance_m?: number | null
          gps_source?: string | null
          id?: string
          is_bypassed?: boolean | null
          is_end_station?: boolean | null
          is_simulation?: boolean | null
          is_start_station?: boolean | null
          latitude?: number | null
          longitude?: number | null
          pending_reason?: string | null
          photo_url?: string | null
          seq_actual?: number | null
          sequence_number?: number | null
          station_id?: string | null
          station_tfl_id?: string | null
          status?: string
          thumb_url?: string | null
          user_id?: string
          verification_image_url?: string | null
          verification_method?: string | null
          verified_at?: string | null
          verifier_version?: string | null
          visit_lat?: number | null
          visit_lon?: number | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_visits_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_visits_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          id: string
          latitude: number
          lines: string[]
          longitude: number
          metro_system_id: string | null
          name: string
          tfl_id: string
          updated_at: string
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          lines: string[]
          longitude: number
          metro_system_id?: string | null
          name: string
          tfl_id: string
          updated_at?: string
          zone: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          lines?: string[]
          longitude?: number
          metro_system_id?: string | null
          name?: string
          tfl_id?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_metro_system_id_fkey"
            columns: ["metro_system_id"]
            isOneToOne: false
            referencedRelation: "metro_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          completion_time_minutes: number | null
          created_at: string
          earned_at: string
          id: string
          meta: Json | null
          rank: number | null
          user_id: string
        }
        Insert: {
          badge_id: string
          completion_time_minutes?: number | null
          created_at?: string
          earned_at?: string
          id?: string
          meta?: Json | null
          rank?: number | null
          user_id: string
        }
        Update: {
          badge_id?: string
          completion_time_minutes?: number | null
          created_at?: string
          earned_at?: string
          id?: string
          meta?: Json | null
          rank?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      derive_activity_state: {
        Args: { activity_id_param: string }
        Returns: Json
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
