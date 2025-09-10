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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          config_version: number | null
          created_at: string | null
          description: string | null
          embed_model: string | null
          fail_safe_threshold: number | null
          gen_model: string | null
          id: string
          k: number | null
          name: string
          query_template: string | null
          sim_threshold: number | null
          system_prompt: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config_version?: number | null
          created_at?: string | null
          description?: string | null
          embed_model?: string | null
          fail_safe_threshold?: number | null
          gen_model?: string | null
          id?: string
          k?: number | null
          name: string
          query_template?: string | null
          sim_threshold?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config_version?: number | null
          created_at?: string | null
          description?: string | null
          embed_model?: string | null
          fail_safe_threshold?: number | null
          gen_model?: string | null
          id?: string
          k?: number | null
          name?: string
          query_template?: string | null
          sim_threshold?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_citations: {
        Row: {
          answer_id: string
          chunk_index: number
          created_at: string | null
          document_id: string
          id: string
          page_end: number
          page_start: number
          sim_score: number
          version_id: string
        }
        Insert: {
          answer_id: string
          chunk_index: number
          created_at?: string | null
          document_id: string
          id?: string
          page_end: number
          page_start: number
          sim_score: number
          version_id: string
        }
        Update: {
          answer_id?: string
          chunk_index?: number
          created_at?: string | null
          document_id?: string
          id?: string
          page_end?: number
          page_start?: number
          sim_score?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_citations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_citations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_citations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          confidence: number | null
          created_at: string | null
          fail_safe_triggered: boolean | null
          id: string
          query_id: string
          session_id: string | null
          showed_confidence: boolean | null
          text: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          fail_safe_triggered?: boolean | null
          id?: string
          query_id: string
          session_id?: string | null
          showed_confidence?: boolean | null
          text: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          fail_safe_triggered?: boolean | null
          id?: string
          query_id?: string
          session_id?: string | null
          showed_confidence?: boolean | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          chunk_index: number
          created_at: string | null
          document_id: string
          id: string
          page_end: number
          page_start: number
          token_count: number
          version_id: string
        }
        Insert: {
          chunk_index: number
          created_at?: string | null
          document_id: string
          id?: string
          page_end: number
          page_start: number
          token_count: number
          version_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string | null
          document_id?: string
          id?: string
          page_end?: number
          page_start?: number
          token_count?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          checksum: string
          created_at: string | null
          document_id: string
          id: string
          version_no: number
        }
        Insert: {
          checksum: string
          created_at?: string | null
          document_id: string
          id?: string
          version_no: number
        }
        Update: {
          checksum?: string
          created_at?: string | null
          document_id?: string
          id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          latest_version: number | null
          mime: string | null
          storage_path: string
          title: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          latest_version?: number | null
          mime?: string | null
          storage_path: string
          title: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          latest_version?: number | null
          mime?: string | null
          storage_path?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evals: {
        Row: {
          aggregate_confidence: number | null
          created_at: string | null
          heuristic_max_sim: number | null
          heuristic_mean_sim: number | null
          id: string
          llm_faithfulness: number | null
          pct_above_thresh: number | null
          query_id: string
          session_id: string | null
        }
        Insert: {
          aggregate_confidence?: number | null
          created_at?: string | null
          heuristic_max_sim?: number | null
          heuristic_mean_sim?: number | null
          id?: string
          llm_faithfulness?: number | null
          pct_above_thresh?: number | null
          query_id: string
          session_id?: string | null
        }
        Update: {
          aggregate_confidence?: number | null
          created_at?: string | null
          heuristic_max_sim?: number | null
          heuristic_mean_sim?: number | null
          id?: string
          llm_faithfulness?: number | null
          pct_above_thresh?: number | null
          query_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evals_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_issues: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          epic_id: string | null
          estimate: number | null
          id: string
          labels: string[] | null
          last_synced_at: string | null
          linear_issue_id: string
          priority: number | null
          project_id: string
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          epic_id?: string | null
          estimate?: number | null
          id?: string
          labels?: string[] | null
          last_synced_at?: string | null
          linear_issue_id: string
          priority?: number | null
          project_id: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          epic_id?: string | null
          estimate?: number | null
          id?: string
          labels?: string[] | null
          last_synced_at?: string | null
          linear_issue_id?: string
          priority?: number | null
          project_id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linear_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linear_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string | null
          last_synced_at: string | null
          linear_project_id: string
          name: string | null
          progress: number | null
          start_date: string | null
          status: string | null
          target_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string | null
          last_synced_at?: string | null
          linear_project_id: string
          name?: string | null
          progress?: number | null
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string | null
          last_synced_at?: string | null
          linear_project_id?: string
          name?: string | null
          progress?: number | null
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linear_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_sprints: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          goal: string | null
          id: string
          last_synced_at: string | null
          linear_sprint_id: string
          name: string | null
          project_id: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          last_synced_at?: string | null
          linear_sprint_id: string
          name?: string | null
          project_id: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          last_synced_at?: string | null
          linear_sprint_id?: string
          name?: string | null
          project_id?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linear_sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linear_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_webhooks: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
          token_in: number | null
          token_out: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
          token_in?: number | null
          token_out?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
          token_in?: number | null
          token_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      queries: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          latency_ms: number | null
          session_id: string | null
          token_in: number | null
          token_out: number | null
          user_id: string
          user_query: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          session_id?: string | null
          token_in?: number | null
          token_out?: number | null
          user_id: string
          user_query: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          session_id?: string | null
          token_in?: number | null
          token_out?: number | null
          user_id?: string
          user_query?: string
        }
        Relationships: [
          {
            foreignKeyName: "queries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          id: string
          is_termination_summary: boolean | null
          session_id: string
          summary_text: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_termination_summary?: boolean | null
          session_id: string
          summary_text?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_termination_summary?: boolean | null
          session_id?: string
          summary_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          linear_api_token: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          linear_api_token?: string | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          linear_api_token?: string | null
          name?: string | null
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
