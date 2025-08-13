export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          started_at: string
          station_tfl_ids: string[]
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
          started_at?: string
          station_tfl_ids: string[]
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
          started_at?: string
          station_tfl_ids?: string[]
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
          name?: string
          start_station_tfl_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          ai_verification_result: Json | null
          checkin_type: string | null
          created_at: string
          id: string
          is_bypassed: boolean | null
          is_end_station: boolean | null
          is_start_station: boolean | null
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          sequence_number: number | null
          station_id: string | null
          station_tfl_id: string | null
          status: string
          user_id: string
          verification_image_url: string | null
          verification_method: string | null
          verified_at: string | null
          visited_at: string
        }
        Insert: {
          activity_id?: string | null
          ai_verification_result?: Json | null
          checkin_type?: string | null
          created_at?: string
          id?: string
          is_bypassed?: boolean | null
          is_end_station?: boolean | null
          is_start_station?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          sequence_number?: number | null
          station_id?: string | null
          station_tfl_id?: string | null
          status?: string
          user_id: string
          verification_image_url?: string | null
          verification_method?: string | null
          verified_at?: string | null
          visited_at?: string
        }
        Update: {
          activity_id?: string | null
          ai_verification_result?: Json | null
          checkin_type?: string | null
          created_at?: string
          id?: string
          is_bypassed?: boolean | null
          is_end_station?: boolean | null
          is_start_station?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          sequence_number?: number | null
          station_id?: string | null
          station_tfl_id?: string | null
          status?: string
          user_id?: string
          verification_image_url?: string | null
          verification_method?: string | null
          verified_at?: string | null
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
          name?: string
          tfl_id?: string
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
