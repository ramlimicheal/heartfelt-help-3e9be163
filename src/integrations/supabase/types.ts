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
      admin_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          memory_directive: Database["public"]["Enums"]["memory_directive"]
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          memory_directive?: Database["public"]["Enums"]["memory_directive"]
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memory_directive?: Database["public"]["Enums"]["memory_directive"]
          role?: string
          session_id?: string
          user_id?: string
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
      persona_fact_confirmations: {
        Row: {
          confirmed_at: string
          confirmed_by: string
          id: string
          method: string
          notes: string | null
          persona_fact_id: string
        }
        Insert: {
          confirmed_at?: string
          confirmed_by: string
          id?: string
          method?: string
          notes?: string | null
          persona_fact_id: string
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string
          id?: string
          method?: string
          notes?: string | null
          persona_fact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_fact_confirmations_persona_fact_id_fkey"
            columns: ["persona_fact_id"]
            isOneToOne: false
            referencedRelation: "persona_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_facts: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          key: string
          memory_directive: Database["public"]["Enums"]["memory_directive"]
          origin: Database["public"]["Enums"]["signal_origin"]
          persona_id: string
          sensitivity: Database["public"]["Enums"]["sensitivity"]
          source_message_id: string | null
          source_signal_id: string | null
          status: Database["public"]["Enums"]["persona_fact_status"]
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          memory_directive?: Database["public"]["Enums"]["memory_directive"]
          origin?: Database["public"]["Enums"]["signal_origin"]
          persona_id: string
          sensitivity?: Database["public"]["Enums"]["sensitivity"]
          source_message_id?: string | null
          source_signal_id?: string | null
          status?: Database["public"]["Enums"]["persona_fact_status"]
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          memory_directive?: Database["public"]["Enums"]["memory_directive"]
          origin?: Database["public"]["Enums"]["signal_origin"]
          persona_id?: string
          sensitivity?: Database["public"]["Enums"]["sensitivity"]
          source_message_id?: string | null
          source_signal_id?: string | null
          status?: Database["public"]["Enums"]["persona_fact_status"]
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "persona_facts_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_facts_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_facts_source_signal_id_fkey"
            columns: ["source_signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          canon_profile: Database["public"]["Enums"]["canon_profile"]
          created_at: string
          display_name: string | null
          id: string
          source_profile: Database["public"]["Enums"]["source_profile"]
          updated_at: string
        }
        Insert: {
          canon_profile?: Database["public"]["Enums"]["canon_profile"]
          created_at?: string
          display_name?: string | null
          id: string
          source_profile?: Database["public"]["Enums"]["source_profile"]
          updated_at?: string
        }
        Update: {
          canon_profile?: Database["public"]["Enums"]["canon_profile"]
          created_at?: string
          display_name?: string | null
          id?: string
          source_profile?: Database["public"]["Enums"]["source_profile"]
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["session_mode"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: Database["public"]["Enums"]["session_mode"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["session_mode"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          confidence: number
          created_at: string
          id: string
          kind: string
          origin: Database["public"]["Enums"]["signal_origin"]
          payload: Json
          session_id: string
          source_message_id: string
          source_span_end: number | null
          source_span_start: number | null
          span_text: string | null
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          id?: string
          kind: string
          origin: Database["public"]["Enums"]["signal_origin"]
          payload?: Json
          session_id: string
          source_message_id: string
          source_span_end?: number | null
          source_span_start?: number | null
          span_text?: string | null
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          kind?: string
          origin?: Database["public"]["Enums"]["signal_origin"]
          payload?: Json
          session_id?: string
          source_message_id?: string
          source_span_end?: number | null
          source_span_start?: number | null
          span_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
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
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "curator" | "user"
      canon_profile:
        | "protestant_66"
        | "ethiopian_orthodox_tewahedo_research"
        | "comparative_early_christian_literature"
      check_in_result: "kept" | "partial" | "missed" | "deferred"
      derivation_type: "direct" | "inferred" | "pattern_matched"
      eval_dimension:
        | "persona_fidelity"
        | "event_chain_fidelity"
        | "hypothesis_quality"
        | "counter_evidence"
        | "biblical_grounding"
        | "context_integrity"
        | "source_tier_accuracy"
        | "prayer_pattern_fit"
        | "prayer_lineage"
        | "action_fit"
        | "non_shaming_tone"
        | "unsupported_certainty"
        | "user_correction_behavior"
        | "citation_validity"
        | "category_coverage"
        | "refusal_correctness"
        | "latency"
        | "cost"
        | "safety"
      formation_event_type:
        | "signal"
        | "pattern_update"
        | "interpretation"
        | "prayer"
        | "practice_assigned"
        | "check_in"
        | "memory_change"
      hypothesis_status: "proposed" | "supported" | "weakened" | "rejected"
      interpretation_category:
        | "biblical_curse"
        | "stronghold"
        | "chosen_behavior"
        | "trauma_wound"
        | "systemic_injustice"
        | "physiological"
        | "spiritual_attack"
        | "generational_sin"
        | "identity_lie"
        | "vow_or_agreement"
        | "unforgiveness"
        | "idolatry"
        | "fear_bondage"
        | "ignorance"
      memory_directive: "normal" | "session_only" | "do_not_remember"
      pattern_relation:
        | "causes"
        | "reinforces"
        | "masks"
        | "contradicts"
        | "precedes"
      pattern_status: "active" | "archived" | "rejected"
      persona_fact_status:
        | "session_only"
        | "proposed"
        | "accepted"
        | "rejected"
        | "deleted"
      prayer_movement:
        | "adoration"
        | "confession"
        | "renunciation"
        | "forgiveness"
        | "deliverance"
        | "healing"
        | "blessing"
        | "commissioning"
        | "thanksgiving"
      run_status: "started" | "succeeded" | "failed" | "skipped"
      sensitivity: "normal" | "sensitive" | "hidden"
      session_mode: "companion" | "pattern" | "deep_wisdom" | "curse_breaker"
      signal_origin: "explicit" | "inferred"
      source_profile: "founder_default"
      source_status:
        | "draft"
        | "in_review"
        | "approved"
        | "superseded"
        | "retired"
      source_tier: "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8"
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
      app_role: ["admin", "curator", "user"],
      canon_profile: [
        "protestant_66",
        "ethiopian_orthodox_tewahedo_research",
        "comparative_early_christian_literature",
      ],
      check_in_result: ["kept", "partial", "missed", "deferred"],
      derivation_type: ["direct", "inferred", "pattern_matched"],
      eval_dimension: [
        "persona_fidelity",
        "event_chain_fidelity",
        "hypothesis_quality",
        "counter_evidence",
        "biblical_grounding",
        "context_integrity",
        "source_tier_accuracy",
        "prayer_pattern_fit",
        "prayer_lineage",
        "action_fit",
        "non_shaming_tone",
        "unsupported_certainty",
        "user_correction_behavior",
        "citation_validity",
        "category_coverage",
        "refusal_correctness",
        "latency",
        "cost",
        "safety",
      ],
      formation_event_type: [
        "signal",
        "pattern_update",
        "interpretation",
        "prayer",
        "practice_assigned",
        "check_in",
        "memory_change",
      ],
      hypothesis_status: ["proposed", "supported", "weakened", "rejected"],
      interpretation_category: [
        "biblical_curse",
        "stronghold",
        "chosen_behavior",
        "trauma_wound",
        "systemic_injustice",
        "physiological",
        "spiritual_attack",
        "generational_sin",
        "identity_lie",
        "vow_or_agreement",
        "unforgiveness",
        "idolatry",
        "fear_bondage",
        "ignorance",
      ],
      memory_directive: ["normal", "session_only", "do_not_remember"],
      pattern_relation: [
        "causes",
        "reinforces",
        "masks",
        "contradicts",
        "precedes",
      ],
      pattern_status: ["active", "archived", "rejected"],
      persona_fact_status: [
        "session_only",
        "proposed",
        "accepted",
        "rejected",
        "deleted",
      ],
      prayer_movement: [
        "adoration",
        "confession",
        "renunciation",
        "forgiveness",
        "deliverance",
        "healing",
        "blessing",
        "commissioning",
        "thanksgiving",
      ],
      run_status: ["started", "succeeded", "failed", "skipped"],
      sensitivity: ["normal", "sensitive", "hidden"],
      session_mode: ["companion", "pattern", "deep_wisdom", "curse_breaker"],
      signal_origin: ["explicit", "inferred"],
      source_profile: ["founder_default"],
      source_status: [
        "draft",
        "in_review",
        "approved",
        "superseded",
        "retired",
      ],
      source_tier: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
    },
  },
} as const
