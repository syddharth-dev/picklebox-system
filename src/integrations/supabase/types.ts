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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_migration_conflicts: {
        Row: {
          booking_id: string
          conflicting_slot_date: string
          conflicting_slot_time: string
          id: string
          previous_status: Database["public"]["Enums"]["booking_status"]
          recorded_at: string
          reference_code: string | null
        }
        Insert: {
          booking_id: string
          conflicting_slot_date: string
          conflicting_slot_time: string
          id?: string
          previous_status: Database["public"]["Enums"]["booking_status"]
          recorded_at?: string
          reference_code?: string | null
        }
        Update: {
          booking_id?: string
          conflicting_slot_date?: string
          conflicting_slot_time?: string
          id?: string
          previous_status?: Database["public"]["Enums"]["booking_status"]
          recorded_at?: string
          reference_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_migration_conflicts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_slots: {
        Row: {
          booking_date: string
          booking_id: string
          court_id: string
          created_at: string
          id: string
          is_reserved: boolean
          start_time: string
        }
        Insert: {
          booking_date: string
          booking_id: string
          court_id: string
          created_at?: string
          id?: string
          is_reserved?: boolean
          start_time: string
        }
        Update: {
          booking_date?: string
          booking_id?: string
          court_id?: string
          created_at?: string
          id?: string
          is_reserved?: boolean
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_slots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_slots_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_note: string | null
          booking_date: string
          checked_in_at: string | null
          court_id: string
          created_at: string
          end_time: string
          expires_at: string | null
          id: string
          is_admin_block: boolean
          qr_token: string
          reference_code: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          booking_date: string
          checked_in_at?: string | null
          court_id: string
          created_at?: string
          end_time: string
          expires_at?: string | null
          id?: string
          is_admin_block?: boolean
          qr_token?: string
          reference_code?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          booking_date?: string
          checked_in_at?: string | null
          court_id?: string
          created_at?: string
          end_time?: string
          expires_at?: string | null
          id?: string
          is_admin_block?: boolean
          qr_token?: string
          reference_code?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_per_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_per_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      open_play_registrations: {
        Row: {
          checked_in_at: string | null
          id: string
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          qr_token: string
          registered_at: string
          session_id: string
          status: Database["public"]["Enums"]["open_play_registration_status"]
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          checked_in_at?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          qr_token?: string
          registered_at?: string
          session_id: string
          status?: Database["public"]["Enums"]["open_play_registration_status"]
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          checked_in_at?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          qr_token?: string
          registered_at?: string
          session_id?: string
          status?: Database["public"]["Enums"]["open_play_registration_status"]
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "open_play_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "open_play_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      open_play_sessions: {
        Row: {
          cancel_cutoff_hours: number
          court_ids: string[]
          created_at: string
          created_by: string
          end_time: string
          id: string
          max_players: number
          notes: string | null
          price_php: number
          session_date: string
          skill: Database["public"]["Enums"]["open_play_skill"]
          start_time: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          cancel_cutoff_hours?: number
          court_ids: string[]
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          max_players: number
          notes?: string | null
          price_php?: number
          session_date: string
          skill?: Database["public"]["Enums"]["open_play_skill"]
          start_time: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          cancel_cutoff_hours?: number
          court_ids?: string[]
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          max_players?: number
          notes?: string | null
          price_php?: number
          session_date?: string
          skill?: Database["public"]["Enums"]["open_play_skill"]
          start_time?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_court_block: {
        Args: {
          p_booking_date: string
          p_court_id: string
          p_note: string
          p_slot_start_times: string[]
        }
        Returns: Json
      }
      admin_release_court_block: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      admin_update_open_play_registration: {
        Args: {
          p_payment_status?: Database["public"]["Enums"]["payment_status"]
          p_registration_id: string
          p_status?: Database["public"]["Enums"]["open_play_registration_status"]
        }
        Returns: undefined
      }
      cancel_booking_reservation: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      cancel_open_play_registration: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      create_booking_reservation: {
        Args: {
          p_booking_date: string
          p_court_id: string
          p_slot_start_times: string[]
          p_transaction_reference: string
        }
        Returns: Json
      }
      create_bookings_atomic: {
        Args: { p_date: string; p_items: Json; p_reference: string }
        Returns: string[]
      }
      get_my_qr_token: {
        Args: { p_id: string; p_kind: string }
        Returns: string
      }
      get_open_play_roster: {
        Args: { p_session_id: string }
        Returns: {
          full_name: string
          payment_reference: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          registered_at: string
          registration_id: string
          status: Database["public"]["Enums"]["open_play_registration_status"]
          user_id: string
          waitlist_position: number
        }[]
      }
      get_reserved_slots: {
        Args: { p_date: string }
        Returns: {
          admin_note: string
          court_id: string
          is_admin_block: boolean
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_open_play_sessions: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          cancel_cutoff_hours: number
          court_ids: string[]
          end_time: string
          id: string
          max_players: number
          my_status: Database["public"]["Enums"]["open_play_registration_status"]
          my_waitlist_position: number
          notes: string
          price_php: number
          registered_count: number
          session_date: string
          skill: Database["public"]["Enums"]["open_play_skill"]
          start_time: string
          status: string
          title: string
          waitlist_count: number
        }[]
      }
      lookup_checkin: { Args: { p_token: string }; Returns: Json }
      perform_checkin: { Args: { p_token: string }; Returns: Json }
      register_for_open_play: {
        Args: { p_payment_reference?: string; p_session_id: string }
        Returns: Json
      }
      resolve_booking_reservation: {
        Args: {
          p_booking_id: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status: "pending" | "paid" | "cancelled" | "completed"
      open_play_registration_status:
        | "registered"
        | "waitlisted"
        | "cancelled"
        | "checked_in"
        | "no_show"
      open_play_skill: "all" | "2.5-3.0" | "3.5" | "4.0+"
      payment_status: "pending" | "completed" | "failed" | "refunded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      booking_status: ["pending", "paid", "cancelled", "completed"],
      open_play_registration_status: [
        "registered",
        "waitlisted",
        "cancelled",
        "checked_in",
        "no_show",
      ],
      open_play_skill: ["all", "2.5-3.0", "3.5", "4.0+"],
      payment_status: ["pending", "completed", "failed", "refunded"],
    },
  },
} as const
