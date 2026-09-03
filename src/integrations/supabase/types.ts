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
      bot_admins: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          role: string
          telegram_chat_id: number
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          role?: string
          telegram_chat_id: number
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          role?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_user_prefs: {
        Row: {
          created_at: string
          lang: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          lang?: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          lang?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          active: boolean
          created_at: string
          error_am: string
          error_en: string
          field_key: string
          field_type: string
          form_id: string
          help_am: string
          help_en: string
          id: string
          label_am: string
          label_en: string
          options: Json
          placeholder: string
          position: number
          required: boolean
          updated_at: string
          validation: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          error_am?: string
          error_en?: string
          field_key: string
          field_type?: string
          form_id: string
          help_am?: string
          help_en?: string
          id?: string
          label_am?: string
          label_en?: string
          options?: Json
          placeholder?: string
          position?: number
          required?: boolean
          updated_at?: string
          validation?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          error_am?: string
          error_en?: string
          field_key?: string
          field_type?: string
          form_id?: string
          help_am?: string
          help_en?: string
          id?: string
          label_am?: string
          label_en?: string
          options?: Json
          placeholder?: string
          position?: number
          required?: boolean
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "module_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers: Json
          assigned_label: string
          assigned_to: string | null
          created_at: string
          files: Json
          form_id: string
          id: string
          module_id: string
          registration_id: string | null
          review_note: string
          status: string
          student_name: string
          submission_code: string
          submitted_by: string | null
          telegram_user_id: number | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          assigned_label?: string
          assigned_to?: string | null
          created_at?: string
          files?: Json
          form_id: string
          id?: string
          module_id: string
          registration_id?: string | null
          review_note?: string
          status?: string
          student_name?: string
          submission_code?: string
          submitted_by?: string | null
          telegram_user_id?: number | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          assigned_label?: string
          assigned_to?: string | null
          created_at?: string
          files?: Json
          form_id?: string
          id?: string
          module_id?: string
          registration_id?: string | null
          review_note?: string
          status?: string
          student_name?: string
          submission_code?: string
          submitted_by?: string | null
          telegram_user_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "module_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      help_content: {
        Row: {
          announcements: string
          body: string
          buttons: Json
          contacts: string
          instructions: string
          lang: string
          title: string
          updated_at: string
        }
        Insert: {
          announcements?: string
          body?: string
          buttons?: Json
          contacts?: string
          instructions?: string
          lang: string
          title?: string
          updated_at?: string
        }
        Update: {
          announcements?: string
          body?: string
          buttons?: Json
          contacts?: string
          instructions?: string
          lang?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_forms: {
        Row: {
          active: boolean
          created_at: string
          description_am: string
          description_en: string
          display_order: number
          id: string
          module_id: string
          published: boolean
          requires_student_id: boolean
          slug: string
          title_am: string
          title_en: string
          updated_at: string
          workflow_enabled: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          description_am?: string
          description_en?: string
          display_order?: number
          id?: string
          module_id: string
          published?: boolean
          requires_student_id?: boolean
          slug: string
          title_am?: string
          title_en?: string
          updated_at?: string
          workflow_enabled?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          description_am?: string
          description_en?: string
          display_order?: number
          id?: string
          module_id?: string
          published?: boolean
          requires_student_id?: boolean
          slug?: string
          title_am?: string
          title_en?: string
          updated_at?: string
          workflow_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "module_forms_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_manage: boolean
          can_submit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_manage?: boolean
          can_submit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_manage?: boolean
          can_submit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_modules: {
        Row: {
          active: boolean
          admin_visible: boolean
          category: string
          created_at: string
          description_am: string
          description_en: string
          display_order: number
          icon: string
          id: string
          is_system: boolean
          name_am: string
          name_en: string
          slug: string
          student_visible: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          admin_visible?: boolean
          category?: string
          created_at?: string
          description_am?: string
          description_en?: string
          display_order?: number
          icon?: string
          id?: string
          is_system?: boolean
          name_am?: string
          name_en?: string
          slug: string
          student_visible?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          admin_visible?: boolean
          category?: string
          created_at?: string
          description_am?: string
          description_en?: string
          display_order?: number
          icon?: string
          id?: string
          is_system?: boolean
          name_am?: string
          name_en?: string
          slug?: string
          student_visible?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      registration_question_versions: {
        Row: {
          created_at: string
          id: string
          published_by: string | null
          questions: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          published_by?: string | null
          questions?: Json
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          published_by?: string | null
          questions?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      registration_questions: {
        Row: {
          active: boolean
          amharic_only: boolean
          created_at: string
          error_am: string
          error_en: string
          exact_words: number | null
          field_key: string
          id: string
          input_type: string
          is_core: boolean
          label_am: string
          label_en: string
          max_words: number | null
          min_words: number | null
          options: Json
          position: number
          required: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          amharic_only?: boolean
          created_at?: string
          error_am?: string
          error_en?: string
          exact_words?: number | null
          field_key: string
          id?: string
          input_type?: string
          is_core?: boolean
          label_am?: string
          label_en?: string
          max_words?: number | null
          min_words?: number | null
          options?: Json
          position?: number
          required?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          amharic_only?: boolean
          created_at?: string
          error_am?: string
          error_en?: string
          exact_words?: number | null
          field_key?: string
          id?: string
          input_type?: string
          is_core?: boolean
          label_am?: string
          label_en?: string
          max_words?: number | null
          min_words?: number | null
          options?: Json
          position?: number
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      registration_sessions: {
        Row: {
          answers: Json
          created_at: string
          step: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          step?: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          step?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          birth_date_ec: string | null
          birth_day_ec: number | null
          birth_month_ec: number | null
          birth_year_ec: number
          christian_name: string
          created_at: string
          extra_answers: Json
          father_name: string
          father_phone: string
          full_name: string
          gender: string
          id: string
          mother_name: string
          mother_phone: string
          registration_id: string
          status: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          birth_date_ec?: string | null
          birth_day_ec?: number | null
          birth_month_ec?: number | null
          birth_year_ec: number
          christian_name: string
          created_at?: string
          extra_answers?: Json
          father_name: string
          father_phone: string
          full_name: string
          gender: string
          id?: string
          mother_name: string
          mother_phone: string
          registration_id?: string
          status?: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          birth_date_ec?: string | null
          birth_day_ec?: number | null
          birth_month_ec?: number | null
          birth_year_ec?: number
          christian_name?: string
          created_at?: string
          extra_answers?: Json
          father_name?: string
          father_phone?: string
          full_name?: string
          gender?: string
          id?: string
          mother_name?: string
          mother_phone?: string
          registration_id?: string
          status?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      submission_events: {
        Row: {
          actor_id: string | null
          actor_label: string
          created_at: string
          from_status: string
          id: string
          note: string
          submission_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          from_status?: string
          id?: string
          note?: string
          submission_id: string
          to_status?: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          from_status?: string
          id?: string
          note?: string
          submission_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          created_at: string
          update_id: number
        }
        Insert: {
          created_at?: string
          update_id: number
        }
        Update: {
          created_at?: string
          update_id?: number
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reserve_registration_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
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
      app_role: ["admin", "moderator", "user", "owner"],
    },
  },
} as const
