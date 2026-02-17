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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cvs: {
        Row: {
          certifications: Json | null
          created_at: string
          cv_language: string
          education: Json | null
          email: string | null
          experiences: Json | null
          facebook_url: string | null
          full_name: string
          generated_content: string | null
          github_url: string | null
          id: string
          languages: Json | null
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          soft_skills: string[] | null
          status: string
          summary: string | null
          technical_skills: string[] | null
          twitter_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certifications?: Json | null
          created_at?: string
          cv_language?: string
          education?: Json | null
          email?: string | null
          experiences?: Json | null
          facebook_url?: string | null
          full_name?: string
          generated_content?: string | null
          github_url?: string | null
          id?: string
          languages?: Json | null
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          soft_skills?: string[] | null
          status?: string
          summary?: string | null
          technical_skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certifications?: Json | null
          created_at?: string
          cv_language?: string
          education?: Json | null
          email?: string | null
          experiences?: Json | null
          facebook_url?: string | null
          full_name?: string
          generated_content?: string | null
          github_url?: string | null
          id?: string
          languages?: Json | null
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          soft_skills?: string[] | null
          status?: string
          summary?: string | null
          technical_skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          phone: string | null
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          abstract: string | null
          content: Json | null
          created_at: string
          custom_references: string | null
          id: string
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          page_count: number
          reference_count: number
          report_type: string
          research_language: string
          status: string
          text_direction: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abstract?: string | null
          content?: Json | null
          created_at?: string
          custom_references?: string | null
          id?: string
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          page_count?: number
          reference_count?: number
          report_type?: string
          research_language?: string
          status?: string
          text_direction?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abstract?: string | null
          content?: Json | null
          created_at?: string
          custom_references?: string | null
          id?: string
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          page_count?: number
          reference_count?: number
          report_type?: string
          research_language?: string
          status?: string
          text_direction?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_projects: {
        Row: {
          abstract: string | null
          chapter_count: number
          chapter_pages: Json | null
          chapters: Json
          content: Json | null
          created_at: string
          custom_references: string | null
          id: string
          include_list_of_figures: boolean
          include_list_of_tables: boolean
          include_toc: boolean
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          reference_count: number
          research_language: string
          source_files: Json | null
          status: string
          text_direction: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abstract?: string | null
          chapter_count?: number
          chapter_pages?: Json | null
          chapters?: Json
          content?: Json | null
          created_at?: string
          custom_references?: string | null
          id?: string
          include_list_of_figures?: boolean
          include_list_of_tables?: boolean
          include_toc?: boolean
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          reference_count?: number
          research_language?: string
          source_files?: Json | null
          status?: string
          text_direction?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abstract?: string | null
          chapter_count?: number
          chapter_pages?: Json | null
          chapters?: Json
          content?: Json | null
          created_at?: string
          custom_references?: string | null
          id?: string
          include_list_of_figures?: boolean
          include_list_of_tables?: boolean
          include_toc?: boolean
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          reference_count?: number
          research_language?: string
          source_files?: Json | null
          status?: string
          text_direction?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
