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
      action_items: {
        Row: {
          coach_user_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          learner_user_id: string
          org_id: string
          recap_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          learner_user_id: string
          org_id: string
          recap_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          learner_user_id?: string
          org_id?: string
          recap_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_coach_user_id_profiles_fk"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "action_items_learner_user_id_profiles_fk"
            columns: ["learner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "action_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "session_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      action_logs: {
        Row: {
          created_at: string
          description: string
          goal_id: string | null
          id: string
          impact_area: string | null
          occurred_on: string
          org_id: string
          reflection: string | null
          sprint_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          goal_id?: string | null
          id?: string
          impact_area?: string | null
          occurred_on?: string
          org_id: string
          reflection?: string | null
          sprint_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          goal_id?: string | null
          id?: string
          impact_area?: string | null
          occurred_on?: string
          org_id?: string
          reflection?: string | null
          sprint_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_logs_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "goal_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          org_id: string | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          org_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          org_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          context_ref: Json
          created_at: string
          distilled_at: string | null
          id: string
          last_message_at: string | null
          mode: string
          org_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_ref?: Json
          created_at?: string
          distilled_at?: string | null
          id?: string
          last_message_at?: string | null
          mode: string
          org_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_ref?: Json
          created_at?: string
          distilled_at?: string | null
          id?: string
          last_message_at?: string | null
          mode?: string
          org_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_errors: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_details: Json | null
          error_message: string
          feature: string
          id: string
          model: string | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_details?: Json | null
          error_message: string
          feature: string
          id?: string
          model?: string | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string
          feature?: string
          id?: string
          model?: string | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_errors_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: Json
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          role: string
          tokens_in: number | null
          tokens_out: number | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: Json
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          role: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          role?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          day: string
          id: string
          model: string
          org_id: string
          request_count: number
          tokens_in: number
          tokens_out: number
          updated_at: string
          usd_cents: number
          user_id: string
        }
        Insert: {
          day?: string
          id?: string
          model: string
          org_id: string
          request_count?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usd_cents?: number
          user_id: string
        }
        Update: {
          day?: string
          id?: string
          model?: string
          org_id?: string
          request_count?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usd_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          cohort_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          org_id: string | null
          role: string | null
          scope: string
          starts_at: string
          title: string
          tone: string
          updated_at: string
        }
        Insert: {
          body: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          scope: string
          starts_at?: string
          title: string
          tone?: string
          updated_at?: string
        }
        Update: {
          body?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          scope?: string
          starts_at?: string
          title?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_documents: {
        Row: {
          ai_summary: Json
          assessment_id: string
          error_message: string | null
          extracted_text: string | null
          file_name: string
          id: string
          processed_at: string | null
          status: string
          storage_path: string
          type: string
          uploaded_at: string
        }
        Insert: {
          ai_summary?: Json
          assessment_id: string
          error_message?: string | null
          extracted_text?: string | null
          file_name: string
          id?: string
          processed_at?: string | null
          status?: string
          storage_path: string
          type: string
          uploaded_at?: string
        }
        Update: {
          ai_summary?: Json
          assessment_id?: string
          error_message?: string | null
          extracted_text?: string | null
          file_name?: string
          id?: string
          processed_at?: string | null
          status?: string
          storage_path?: string
          type?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_documents_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          ai_summary: Json
          created_at: string
          id: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: Json
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: Json
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capstone_outlines: {
        Row: {
          cohort_id: string | null
          conversation_id: string | null
          created_at: string
          finalized_at: string | null
          id: string
          org_id: string
          outline: Json
          shared_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          conversation_id?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          org_id: string
          outline?: Json
          shared_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          conversation_id?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          org_id?: string
          outline?: Json
          shared_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capstone_outlines_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capstone_outlines_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capstone_outlines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          cohort_id: string | null
          course_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          path_id: string | null
          pdf_url: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          course_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          path_id?: string | null
          pdf_url?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          course_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          path_id?: string | null
          pdf_url?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coach_assignments: {
        Row: {
          active_from: string
          active_to: string | null
          coach_user_id: string
          cohort_id: string | null
          created_at: string
          id: string
          learner_user_id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          coach_user_id: string
          cohort_id?: string | null
          created_at?: string
          id?: string
          learner_user_id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          coach_user_id?: string
          cohort_id?: string | null
          created_at?: string
          id?: string
          learner_user_id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_coach_user_id_profiles_fk"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_learner_user_id_profiles_fk"
            columns: ["learner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          coach_user_id: string
          content: string
          created_at: string
          id: string
          learner_user_id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          content: string
          created_at?: string
          id?: string
          learner_user_id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          content?: string
          created_at?: string
          id?: string
          learner_user_id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_nudges: {
        Row: {
          acted_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          notification_id: string | null
          org_id: string
          pattern: string
          pattern_data: Json
          target_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_id?: string | null
          org_id: string
          pattern: string
          pattern_data?: Json
          target_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_id?: string | null
          org_id?: string
          pattern?: string
          pattern_data?: Json
          target_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_nudges_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_nudges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_courses: {
        Row: {
          available_from: string | null
          available_until: string | null
          cohort_id: string
          course_id: string
          created_at: string
          due_at: string | null
          id: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          cohort_id: string
          course_id: string
          created_at?: string
          due_at?: string | null
          id?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          cohort_id?: string
          course_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_courses_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_learning_paths: {
        Row: {
          available_from: string | null
          cohort_id: string
          created_at: string
          due_at: string | null
          id: string
          path_id: string
        }
        Insert: {
          available_from?: string | null
          cohort_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          path_id: string
        }
        Update: {
          available_from?: string | null
          cohort_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_learning_paths_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_learning_paths_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          capstone_unlocks_at: string | null
          consultant_user_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          org_id: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          capstone_unlocks_at?: string | null
          consultant_user_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          org_id: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          capstone_unlocks_at?: string | null
          consultant_user_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          org_id?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_consultant_user_id_profiles_fk"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cohorts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          cohort_id: string | null
          content: string
          created_at: string
          id: string
          likes_count: number
          org_id: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          org_id: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_prerequisites: {
        Row: {
          course_id: string
          created_at: string
          id: string
          required_course_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          required_course_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          required_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_required_course_id_fkey"
            columns: ["required_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cert_validity_months: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cert_validity_months?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cert_validity_months?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          challenge: string
          completed: boolean
          completed_at: string | null
          created_at: string
          for_date: string
          id: string
          org_id: string
          reflection: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          for_date?: string
          id?: string
          org_id: string
          reflection?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          for_date?: string
          id?: string
          org_id?: string
          reflection?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_sprints: {
        Row: {
          action_count: number
          actual_end_date: string | null
          created_at: string
          goal_id: string
          id: string
          org_id: string
          planned_end_date: string
          practice: string
          sprint_number: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_count?: number
          actual_end_date?: string | null
          created_at?: string
          goal_id: string
          id?: string
          org_id: string
          planned_end_date: string
          practice: string
          sprint_number: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_count?: number
          actual_end_date?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          org_id?: string
          planned_end_date?: string
          practice?: string
          sprint_number?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_sprints_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_sprints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          active_focus_until: string | null
          created_at: string
          id: string
          impact_org: string
          impact_others: string
          impact_self: string
          org_id: string
          primary_lens: string | null
          smart_criteria: Json
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_focus_until?: string | null
          created_at?: string
          id?: string
          impact_org: string
          impact_others: string
          impact_self: string
          org_id: string
          primary_lens?: string | null
          smart_criteria?: Json
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_focus_until?: string | null
          created_at?: string
          id?: string
          impact_org?: string
          impact_others?: string
          impact_self?: string
          org_id?: string
          primary_lens?: string | null
          smart_criteria?: Json
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          cohort_id: string | null
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          token: string
        }
        Insert: {
          cohort_id?: string | null
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role: string
          token?: string
        }
        Update: {
          cohort_id?: string | null
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_memory: {
        Row: {
          confidence: string
          content: string
          created_at: string
          deleted_by_user: boolean
          edited_by_user: boolean
          expires_at: string | null
          first_seen: string
          id: string
          last_seen: string
          org_id: string
          source_conversation_id: string | null
          source_excerpt: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string
          content: string
          created_at?: string
          deleted_by_user?: boolean
          edited_by_user?: boolean
          expires_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          org_id: string
          source_conversation_id?: string | null
          source_excerpt?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string
          content?: string
          created_at?: string
          deleted_by_user?: boolean
          edited_by_user?: boolean
          expires_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          org_id?: string
          source_conversation_id?: string | null
          source_excerpt?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_memory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_memory_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order: number
          path_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order?: number
          path_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order?: number
          path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_courses_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          cert_validity_months: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          cert_validity_months?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          cert_validity_months?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_prerequisites: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          required_lesson_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          required_lesson_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          required_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_prerequisites_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_prerequisites_required_lesson_id_fkey"
            columns: ["required_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          score: number | null
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          score?: number | null
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          score?: number | null
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string
          lesson_id: string
          order: number
          resource_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          order?: number
          resource_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          order?: number
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          materials: Json
          module_id: string
          order: number
          quiz: Json
          title: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          materials?: Json
          module_id: string
          order?: number
          quiz?: Json
          title: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          materials?: Json
          module_id?: string
          order?: number
          quiz?: Json
          title?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          cohort_id: string | null
          consultant_user_id: string | null
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          consultant_user_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          consultant_user_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_cohort_fk"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_consultant_user_id_profiles_fk"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          learning_objectives: string[]
          order: number
          prerequisites: string[]
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          learning_objectives?: string[]
          order?: number
          prerequisites?: string[]
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          learning_objectives?: string[]
          order?: number
          prerequisites?: string[]
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pre_session_notes: {
        Row: {
          created_at: string
          id: string
          org_id: string
          session_date: string | null
          updated_at: string
          user_id: string
          want_to_discuss: string
          whats_been_hard: string | null
          whats_going_well: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          session_date?: string | null
          updated_at?: string
          user_id: string
          want_to_discuss: string
          whats_been_hard?: string | null
          whats_going_well?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          session_date?: string | null
          updated_at?: string
          user_id?: string
          want_to_discuss?: string
          whats_been_hard?: string | null
          whats_going_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_session_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_size: string | null
          context_notes: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          function_area: string | null
          industry: string | null
          intake_completed_at: string | null
          proactivity_enabled: boolean
          role_title: string | null
          super_admin: boolean
          team_size: number | null
          tenure_at_org: string | null
          tenure_in_leadership: string | null
          timezone: string
          total_org_influence: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_size?: string | null
          context_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          function_area?: string | null
          industry?: string | null
          intake_completed_at?: string | null
          proactivity_enabled?: boolean
          role_title?: string | null
          super_admin?: boolean
          team_size?: number | null
          tenure_at_org?: string | null
          tenure_in_leadership?: string | null
          timezone?: string
          total_org_influence?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_size?: string | null
          context_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          function_area?: string | null
          industry?: string | null
          intake_completed_at?: string | null
          proactivity_enabled?: boolean
          role_title?: string | null
          super_admin?: boolean
          team_size?: number | null
          tenure_at_org?: string | null
          tenure_in_leadership?: string | null
          timezone?: string
          total_org_influence?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          completed_at: string | null
          id: string
          lesson_id: string
          max_points: number | null
          org_id: string | null
          passed: boolean | null
          score_percent: number | null
          score_points: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          id?: string
          lesson_id: string
          max_points?: number | null
          org_id?: string | null
          passed?: boolean | null
          score_percent?: number | null
          score_points?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          id?: string
          lesson_id?: string
          max_points?: number | null
          org_id?: string | null
          passed?: boolean | null
          score_percent?: number | null
          score_points?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          config: Json
          created_at: string
          explanation: string | null
          id: string
          lesson_id: string
          order: number
          points: number
          prompt: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id: string
          order?: number
          points?: number
          prompt: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id?: string
          order?: number
          points?: number
          prompt?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_settings: {
        Row: {
          created_at: string
          instructions: string | null
          lesson_id: string
          max_attempts: number | null
          pass_percent: number
          show_correct_answers: boolean
          shuffle_questions: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          instructions?: string | null
          lesson_id: string
          max_attempts?: number | null
          pass_percent?: number
          show_correct_answers?: boolean
          shuffle_questions?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          instructions?: string | null
          lesson_id?: string
          max_attempts?: number | null
          pass_percent?: number
          show_correct_answers?: boolean
          shuffle_questions?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_settings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      reflections: {
        Row: {
          ai_insights: Json
          content: string
          created_at: string
          id: string
          org_id: string
          reflected_on: string
          themes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_insights?: Json
          content: string
          created_at?: string
          id?: string
          org_id: string
          reflected_on?: string
          themes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_insights?: Json
          content?: string
          created_at?: string
          id?: string
          org_id?: string
          reflected_on?: string
          themes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
          type: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          type: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          type?: string
          url?: string
        }
        Relationships: []
      }
      session_recaps: {
        Row: {
          ai_draft: Json
          coach_user_id: string
          content: string
          created_at: string
          id: string
          learner_user_id: string
          org_id: string
          session_date: string
          updated_at: string
        }
        Insert: {
          ai_draft?: Json
          coach_user_id: string
          content: string
          created_at?: string
          id?: string
          learner_user_id: string
          org_id: string
          session_date?: string
          updated_at?: string
        }
        Update: {
          ai_draft?: Json
          coach_user_id?: string
          content?: string
          created_at?: string
          id?: string
          learner_user_id?: string
          org_id?: string
          session_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_recaps_coach_user_id_profiles_fk"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_recaps_learner_user_id_profiles_fk"
            columns: ["learner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_recaps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          created_at: string
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          kind: string
          org_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          org_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_invitation: {
        Args: { p_token: string }
        Returns: {
          cohort_id: string | null
          consultant_user_id: string | null
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_coach_in_org: { Args: { p_org_id: string }; Returns: boolean }
      is_coach_of: { Args: { p_learner: string }; Returns: boolean }
      is_consultant_in_org: { Args: { p_org_id: string }; Returns: boolean }
      is_consultant_of_cohort: {
        Args: { p_cohort_id: string }
        Returns: boolean
      }
      is_consultant_of_learner: {
        Args: { p_learner: string }
        Returns: boolean
      }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      verify_invitation: {
        Args: { p_token: string }
        Returns: {
          cohort_id: string
          email: string
          expires_at: string
          id: string
          org_id: string
          role: string
        }[]
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
