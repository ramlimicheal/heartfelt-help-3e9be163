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
      archetype_mirrors: {
        Row: {
          archetype_id: string
          created_at: string
          description: string
          id: string
          mirror_type: string
        }
        Insert: {
          archetype_id: string
          created_at?: string
          description: string
          id?: string
          mirror_type: string
        }
        Update: {
          archetype_id?: string
          created_at?: string
          description?: string
          id?: string
          mirror_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_mirrors_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "biblical_archetypes"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_passages: {
        Row: {
          archetype_id: string
          created_at: string
          id: string
          ordering: number
          passage_id: string
          role: string
        }
        Insert: {
          archetype_id: string
          created_at?: string
          id?: string
          ordering?: number
          passage_id: string
          role?: string
        }
        Update: {
          archetype_id?: string
          created_at?: string
          id?: string
          ordering?: number
          passage_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_passages_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "biblical_archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_passages_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "source_passages"
            referencedColumns: ["id"]
          },
        ]
      }
      biblical_archetypes: {
        Row: {
          created_at: string
          id: string
          last_edited_by: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["source_status"]
          summary: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_edited_by?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["source_status"]
          summary: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_edited_by?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["source_status"]
          summary?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          at: string
          id: string
          note: string | null
          observed: string | null
          practice_assignment_id: string | null
          session_id: string | null
          setback: string | null
          user_id: string
        }
        Insert: {
          at?: string
          id?: string
          note?: string | null
          observed?: string | null
          practice_assignment_id?: string | null
          session_id?: string | null
          setback?: string | null
          user_id: string
        }
        Update: {
          at?: string
          id?: string
          note?: string | null
          observed?: string | null
          practice_assignment_id?: string | null
          session_id?: string | null
          setback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_practice_assignment_id_fkey"
            columns: ["practice_assignment_id"]
            isOneToOne: false
            referencedRelation: "practice_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      discernments: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["discernment_kind"]
          pattern_id: string | null
          session_id: string
          text: string
          user_id: string
          wisdom_turn_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["discernment_kind"]
          pattern_id?: string | null
          session_id: string
          text: string
          user_id: string
          wisdom_turn_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["discernment_kind"]
          pattern_id?: string | null
          session_id?: string
          text?: string
          user_id?: string
          wisdom_turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discernments_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discernments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discernments_wisdom_turn_id_fkey"
            columns: ["wisdom_turn_id"]
            isOneToOne: false
            referencedRelation: "wisdom_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_events: {
        Row: {
          at: string
          event_type: Database["public"]["Enums"]["formation_event_type"]
          fruit: string[]
          id: string
          note: string | null
          pattern_id: string | null
          practice_id: string | null
          prayer_id: string | null
          user_id: string
        }
        Insert: {
          at?: string
          event_type: Database["public"]["Enums"]["formation_event_type"]
          fruit?: string[]
          id?: string
          note?: string | null
          pattern_id?: string | null
          practice_id?: string | null
          prayer_id?: string | null
          user_id: string
        }
        Update: {
          at?: string
          event_type?: Database["public"]["Enums"]["formation_event_type"]
          fruit?: string[]
          id?: string
          note?: string | null
          pattern_id?: string | null
          practice_id?: string | null
          prayer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_events_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_events_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      interpretations: {
        Row: {
          archetype_id: string | null
          body: string
          confidence: number
          created_at: string
          headline: string
          id: string
          min_source_tier: Database["public"]["Enums"]["source_tier"] | null
          pattern_id: string | null
          session_id: string
          user_id: string
          wisdom_turn_id: string | null
        }
        Insert: {
          archetype_id?: string | null
          body: string
          confidence: number
          created_at?: string
          headline: string
          id?: string
          min_source_tier?: Database["public"]["Enums"]["source_tier"] | null
          pattern_id?: string | null
          session_id: string
          user_id: string
          wisdom_turn_id?: string | null
        }
        Update: {
          archetype_id?: string | null
          body?: string
          confidence?: number
          created_at?: string
          headline?: string
          id?: string
          min_source_tier?: Database["public"]["Enums"]["source_tier"] | null
          pattern_id?: string | null
          session_id?: string
          user_id?: string
          wisdom_turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interpretations_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "biblical_archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_wisdom_turn_id_fkey"
            columns: ["wisdom_turn_id"]
            isOneToOne: false
            referencedRelation: "wisdom_turns"
            referencedColumns: ["id"]
          },
        ]
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
      model_configs: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          model: string
          params: Json
          provider: string
          stage: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          model: string
          params?: Json
          provider: string
          stage: string
          version: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string
          params?: Json
          provider?: string
          stage?: string
          version?: number
        }
        Relationships: []
      }
      pattern_events: {
        Row: {
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          pattern_id: string
          source_message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          pattern_id: string
          source_message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          pattern_id?: string
          source_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_events_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_evidence: {
        Row: {
          confidence: number | null
          created_at: string
          excerpt: string | null
          id: string
          kind: Database["public"]["Enums"]["pattern_evidence_kind"]
          pattern_id: string
          source_message_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          excerpt?: string | null
          id?: string
          kind: Database["public"]["Enums"]["pattern_evidence_kind"]
          pattern_id: string
          source_message_id: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          excerpt?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pattern_evidence_kind"]
          pattern_id?: string
          source_message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_evidence_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_evidence_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_feedback: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["pattern_feedback_kind"]
          note: string | null
          pattern_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["pattern_feedback_kind"]
          note?: string | null
          pattern_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["pattern_feedback_kind"]
          note?: string | null
          pattern_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_feedback_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_relationships: {
        Row: {
          created_at: string
          from_pattern_id: string
          id: string
          idempotency_key: string
          relation: Database["public"]["Enums"]["pattern_relation"]
          to_pattern_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_pattern_id: string
          id?: string
          idempotency_key: string
          relation: Database["public"]["Enums"]["pattern_relation"]
          to_pattern_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_pattern_id?: string
          id?: string
          idempotency_key?: string
          relation?: Database["public"]["Enums"]["pattern_relation"]
          to_pattern_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_relationships_from_pattern_id_fkey"
            columns: ["from_pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_relationships_to_pattern_id_fkey"
            columns: ["to_pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns: {
        Row: {
          acceptance_feedback: string | null
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          idempotency_key: string
          last_edited_by: string | null
          lifecycle: string
          reconsideration_evidence: string | null
          reconsidered_from: string | null
          rejected_at: string | null
          rejected_evidence_snapshot: Json | null
          rejected_reason: string | null
          rejected_scope: string | null
          status: Database["public"]["Enums"]["pattern_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptance_feedback?: string | null
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key: string
          last_edited_by?: string | null
          lifecycle?: string
          reconsideration_evidence?: string | null
          reconsidered_from?: string | null
          rejected_at?: string | null
          rejected_evidence_snapshot?: Json | null
          rejected_reason?: string | null
          rejected_scope?: string | null
          status?: Database["public"]["Enums"]["pattern_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptance_feedback?: string | null
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string
          last_edited_by?: string | null
          lifecycle?: string
          reconsideration_evidence?: string | null
          reconsidered_from?: string | null
          rejected_at?: string | null
          rejected_evidence_snapshot?: Json | null
          rejected_reason?: string | null
          rejected_scope?: string | null
          status?: Database["public"]["Enums"]["pattern_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patterns_reconsidered_from_fkey"
            columns: ["reconsidered_from"]
            isOneToOne: false
            referencedRelation: "patterns"
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
      pipeline_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          latency_ms: number | null
          mode: Database["public"]["Enums"]["pipeline_mode"]
          model: string | null
          payload_hash: string | null
          prompt_key: string | null
          prompt_version: number | null
          session_id: string
          stage: string
          status: Database["public"]["Enums"]["pipeline_run_status"]
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          mode: Database["public"]["Enums"]["pipeline_mode"]
          model?: string | null
          payload_hash?: string | null
          prompt_key?: string | null
          prompt_version?: number | null
          session_id: string
          stage: string
          status: Database["public"]["Enums"]["pipeline_run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          model?: string | null
          payload_hash?: string | null
          prompt_key?: string | null
          prompt_version?: number | null
          session_id?: string
          stage?: string
          status?: Database["public"]["Enums"]["pipeline_run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_assignments: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          practice_id: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["practice_assignment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          practice_id: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["practice_assignment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          practice_id?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["practice_assignment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["practice_kind"]
          pattern_id: string | null
          rationale: string
          session_id: string
          title: string
          user_id: string
          wisdom_turn_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          kind: Database["public"]["Enums"]["practice_kind"]
          pattern_id?: string | null
          rationale: string
          session_id: string
          title: string
          user_id: string
          wisdom_turn_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["practice_kind"]
          pattern_id?: string | null
          rationale?: string
          session_id?: string
          title?: string
          user_id?: string
          wisdom_turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_wisdom_turn_id_fkey"
            columns: ["wisdom_turn_id"]
            isOneToOne: false
            referencedRelation: "wisdom_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_line_sources: {
        Row: {
          created_at: string
          derivation: Database["public"]["Enums"]["derivation_type"]
          explanation: string
          id: string
          passage_id: string
          prayer_line_id: string
          tier: Database["public"]["Enums"]["source_tier"]
          user_id: string
        }
        Insert: {
          created_at?: string
          derivation: Database["public"]["Enums"]["derivation_type"]
          explanation: string
          id?: string
          passage_id: string
          prayer_line_id: string
          tier: Database["public"]["Enums"]["source_tier"]
          user_id: string
        }
        Update: {
          created_at?: string
          derivation?: Database["public"]["Enums"]["derivation_type"]
          explanation?: string
          id?: string
          passage_id?: string
          prayer_line_id?: string
          tier?: Database["public"]["Enums"]["source_tier"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_line_sources_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "source_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_line_sources_prayer_line_id_fkey"
            columns: ["prayer_line_id"]
            isOneToOne: false
            referencedRelation: "prayer_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_lines: {
        Row: {
          confidence: number
          created_at: string
          id: string
          movement: Database["public"]["Enums"]["prayer_movement"]
          ordering: number
          prayer_id: string
          text: string
          user_edited: boolean
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          movement: Database["public"]["Enums"]["prayer_movement"]
          ordering: number
          prayer_id: string
          text: string
          user_edited?: boolean
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          movement?: Database["public"]["Enums"]["prayer_movement"]
          ordering?: number
          prayer_id?: string
          text?: string
          user_edited?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_lines_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      prayers: {
        Row: {
          created_at: string
          finalized_at: string | null
          id: string
          mode: Database["public"]["Enums"]["prayer_mode"]
          pattern_id: string | null
          session_id: string
          title: string
          updated_at: string
          user_id: string
          wisdom_turn_id: string | null
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["prayer_mode"]
          pattern_id?: string | null
          session_id: string
          title: string
          updated_at?: string
          user_id: string
          wisdom_turn_id?: string | null
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["prayer_mode"]
          pattern_id?: string | null
          session_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          wisdom_turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayers_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayers_wisdom_turn_id_fkey"
            columns: ["wisdom_turn_id"]
            isOneToOne: false
            referencedRelation: "wisdom_turns"
            referencedColumns: ["id"]
          },
        ]
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
      prompt_versions: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          key: string
          model_hint: string | null
          notes: string | null
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          model_hint?: string | null
          notes?: string | null
          version: number
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          model_hint?: string | null
          notes?: string | null
          version?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          first_user_message_id: string | null
          id: string
          lock_reason: string | null
          mode: Database["public"]["Enums"]["session_mode"]
          mode_locked_at: string | null
          parent_session_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_user_message_id?: string | null
          id?: string
          lock_reason?: string | null
          mode: Database["public"]["Enums"]["session_mode"]
          mode_locked_at?: string | null
          parent_session_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_user_message_id?: string | null
          id?: string
          lock_reason?: string | null
          mode?: Database["public"]["Enums"]["session_mode"]
          mode_locked_at?: string | null
          parent_session_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_first_user_message_id_fkey"
            columns: ["first_user_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_corrections: {
        Row: {
          correction_kind: string
          created_at: string
          id: string
          note: string
          signal_id: string
          user_id: string
        }
        Insert: {
          correction_kind: string
          created_at?: string
          id?: string
          note: string
          signal_id: string
          user_id: string
        }
        Update: {
          correction_kind?: string
          created_at?: string
          id?: string
          note?: string
          signal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_corrections_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
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
      source_approvals: {
        Row: {
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          id: string
          note: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["governed_entity"]
          target_version: number
        }
        Insert: {
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          note?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["governed_entity"]
          target_version: number
        }
        Update: {
          approver_id?: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["governed_entity"]
          target_version?: number
        }
        Relationships: []
      }
      source_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string
          target_type: Database["public"]["Enums"]["governed_entity"]
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id: string
          target_type: Database["public"]["Enums"]["governed_entity"]
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string
          target_type?: Database["public"]["Enums"]["governed_entity"]
        }
        Relationships: []
      }
      source_documents: {
        Row: {
          author: string | null
          canon: Json
          created_at: string
          created_by: string | null
          id: string
          last_edited_by: string | null
          licence: string
          licence_notes: string | null
          notes: string | null
          period: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["source_status"]
          superseded_by_id: string | null
          supersedes_id: string | null
          tier: Database["public"]["Enums"]["source_tier"]
          title: string
          tradition: string | null
          translation: string | null
          updated_at: string
          url: string | null
          version: number
        }
        Insert: {
          author?: string | null
          canon?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_edited_by?: string | null
          licence: string
          licence_notes?: string | null
          notes?: string | null
          period?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["source_status"]
          superseded_by_id?: string | null
          supersedes_id?: string | null
          tier: Database["public"]["Enums"]["source_tier"]
          title: string
          tradition?: string | null
          translation?: string | null
          updated_at?: string
          url?: string | null
          version?: number
        }
        Update: {
          author?: string | null
          canon?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_edited_by?: string | null
          licence?: string
          licence_notes?: string | null
          notes?: string | null
          period?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["source_status"]
          superseded_by_id?: string | null
          supersedes_id?: string | null
          tier?: Database["public"]["Enums"]["source_tier"]
          title?: string
          tradition?: string | null
          translation?: string | null
          updated_at?: string
          url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      source_passages: {
        Row: {
          canonical_ref: string
          created_at: string
          id: string
          reference: string
          source_id: string
          text: string
        }
        Insert: {
          canonical_ref: string
          created_at?: string
          id?: string
          reference: string
          source_id: string
          text: string
        }
        Update: {
          canonical_ref?: string
          created_at?: string
          id?: string
          reference?: string
          source_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_passages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      stronghold_categories: {
        Row: {
          alternative_explanations: Json
          category: Database["public"]["Enums"]["interpretation_category"]
          cheap_score: number
          citations: Json
          confidence: number
          counter_evidence: Json
          created_at: string
          deep_analyzed: boolean
          id: string
          pastoral_note: string | null
          session_id: string
          supporting_evidence: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alternative_explanations?: Json
          category: Database["public"]["Enums"]["interpretation_category"]
          cheap_score?: number
          citations?: Json
          confidence?: number
          counter_evidence?: Json
          created_at?: string
          deep_analyzed?: boolean
          id?: string
          pastoral_note?: string | null
          session_id: string
          supporting_evidence?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alternative_explanations?: Json
          category?: Database["public"]["Enums"]["interpretation_category"]
          cheap_score?: number
          citations?: Json
          confidence?: number
          counter_evidence?: Json
          created_at?: string
          deep_analyzed?: boolean
          id?: string
          pastoral_note?: string | null
          session_id?: string
          supporting_evidence?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stronghold_categories_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stronghold_category_approvals: {
        Row: {
          category_id: string
          created_at: string
          id: string
          note: string | null
          user_id: string
          verdict: Database["public"]["Enums"]["category_verdict"]
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
          verdict: Database["public"]["Enums"]["category_verdict"]
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          verdict?: Database["public"]["Enums"]["category_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "stronghold_category_approvals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stronghold_categories"
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
      wisdom_turn_rate_limits: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      wisdom_turns: {
        Row: {
          artifact_ids: Json
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          input_payload: Json | null
          latency_ms: number | null
          memory_directive: Database["public"]["Enums"]["memory_directive"]
          mode: Database["public"]["Enums"]["session_mode"]
          model: string
          model_version: number
          payload_hash: string | null
          prompt_key: string
          prompt_version: number
          result: Json | null
          result_schema_version: number
          session_id: string
          status: Database["public"]["Enums"]["wisdom_turn_status"]
          tokens_in: number | null
          tokens_out: number | null
          triggering_user_message_id: string
          updated_at: string
          user_id: string
          user_text_hash: string | null
        }
        Insert: {
          artifact_ids?: Json
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          input_payload?: Json | null
          latency_ms?: number | null
          memory_directive: Database["public"]["Enums"]["memory_directive"]
          mode: Database["public"]["Enums"]["session_mode"]
          model: string
          model_version: number
          payload_hash?: string | null
          prompt_key: string
          prompt_version: number
          result?: Json | null
          result_schema_version?: number
          session_id: string
          status?: Database["public"]["Enums"]["wisdom_turn_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          triggering_user_message_id: string
          updated_at?: string
          user_id: string
          user_text_hash?: string | null
        }
        Update: {
          artifact_ids?: Json
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          input_payload?: Json | null
          latency_ms?: number | null
          memory_directive?: Database["public"]["Enums"]["memory_directive"]
          mode?: Database["public"]["Enums"]["session_mode"]
          model?: string
          model_version?: number
          payload_hash?: string | null
          prompt_key?: string
          prompt_version?: number
          result?: Json | null
          result_schema_version?: number
          session_id?: string
          status?: Database["public"]["Enums"]["wisdom_turn_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          triggering_user_message_id?: string
          updated_at?: string
          user_id?: string
          user_text_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wisdom_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wisdom_turns_triggering_user_message_id_fkey"
            columns: ["triggering_user_message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
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
      fail_unified_turn: {
        Args: { p_error: string; p_expected_user: string; p_turn_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      persist_unified_turn: {
        Args: {
          p_expected_user: string
          p_input_payload: Json
          p_latency_ms: number
          p_payload_hash: string
          p_result: Json
          p_result_schema_version: number
          p_tokens_in: number
          p_tokens_out: number
          p_turn_id: string
        }
        Returns: Json
      }
      wisdom_turn_rate_limit_check: {
        Args: { p_limit: number; p_user: string; p_window_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "curator" | "user"
      canon_profile:
        | "protestant_66"
        | "ethiopian_orthodox_tewahedo_research"
        | "comparative_early_christian_literature"
      category_verdict: "accepted" | "rejected" | "unsure" | "deferred"
      check_in_result: "kept" | "partial" | "missed" | "deferred"
      derivation_type: "direct" | "inferred" | "pattern_matched"
      discernment_kind:
        | "context_note"
        | "direct_vs_inferred"
        | "descriptive_vs_prescriptive"
        | "counter_evidence"
        | "distinguishing_question"
        | "tension"
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
      governed_entity: "source" | "archetype"
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
      pattern_evidence_kind:
        | "supporting"
        | "counter"
        | "missing"
        | "hidden_agreement"
      pattern_feedback_kind: "accept" | "refine" | "reject" | "reconsider"
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
        | "corrected"
      pipeline_mode: "companion" | "wisdom" | "curse_breaker"
      pipeline_run_status: "ok" | "error" | "skipped"
      practice_assignment_status:
        | "pending"
        | "committed"
        | "completed"
        | "skipped"
        | "abandoned"
        | "proposed"
      practice_kind:
        | "boundary"
        | "confession"
        | "forgiveness"
        | "restitution"
        | "reconciliation"
        | "silence"
        | "scripture_meditation"
        | "journaling"
        | "accountability"
        | "environmental_change"
        | "service"
        | "waiting"
        | "gratitude"
        | "fasting_reflection"
      prayer_mode: "concise" | "full" | "guided" | "journal"
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
      wisdom_turn_status:
        | "pending"
        | "ok"
        | "validation_error"
        | "model_error"
        | "processing"
        | "completed"
        | "failed"
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
      category_verdict: ["accepted", "rejected", "unsure", "deferred"],
      check_in_result: ["kept", "partial", "missed", "deferred"],
      derivation_type: ["direct", "inferred", "pattern_matched"],
      discernment_kind: [
        "context_note",
        "direct_vs_inferred",
        "descriptive_vs_prescriptive",
        "counter_evidence",
        "distinguishing_question",
        "tension",
      ],
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
      governed_entity: ["source", "archetype"],
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
      pattern_evidence_kind: [
        "supporting",
        "counter",
        "missing",
        "hidden_agreement",
      ],
      pattern_feedback_kind: ["accept", "refine", "reject", "reconsider"],
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
        "corrected",
      ],
      pipeline_mode: ["companion", "wisdom", "curse_breaker"],
      pipeline_run_status: ["ok", "error", "skipped"],
      practice_assignment_status: [
        "pending",
        "committed",
        "completed",
        "skipped",
        "abandoned",
        "proposed",
      ],
      practice_kind: [
        "boundary",
        "confession",
        "forgiveness",
        "restitution",
        "reconciliation",
        "silence",
        "scripture_meditation",
        "journaling",
        "accountability",
        "environmental_change",
        "service",
        "waiting",
        "gratitude",
        "fasting_reflection",
      ],
      prayer_mode: ["concise", "full", "guided", "journal"],
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
      wisdom_turn_status: [
        "pending",
        "ok",
        "validation_error",
        "model_error",
        "processing",
        "completed",
        "failed",
      ],
    },
  },
} as const
