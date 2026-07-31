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
      appointment_notifications: {
        Row: {
          appointment_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          notification_type: string
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          template_id: string | null
          waitlist_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          notification_type: string
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          template_id?: string | null
          waitlist_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          template_id?: string | null
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "appointment_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_qc_progress: {
        Row: {
          appointment_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          elapsed_from_start_seconds: number | null
          id: string
          notes: string | null
          stage_id: string
          stage_name: string | null
          stage_position: number
          started_at: string | null
          task_results: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          elapsed_from_start_seconds?: number | null
          id?: string
          notes?: string | null
          stage_id: string
          stage_name?: string | null
          stage_position?: number
          started_at?: string | null
          task_results?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          elapsed_from_start_seconds?: number | null
          id?: string
          notes?: string | null
          stage_id?: string
          stage_name?: string | null
          stage_position?: number
          started_at?: string | null
          task_results?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_waitlist: {
        Row: {
          bike_id: string | null
          booked_appointment_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          notified_at: string | null
          preferred_date_from: string
          preferred_date_until: string | null
          preferred_days: number[] | null
          preferred_time_from: string | null
          preferred_time_until: string | null
          priority_score: number
          service_type_id: string
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          bike_id?: string | null
          booked_appointment_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          preferred_date_from: string
          preferred_date_until?: string | null
          preferred_days?: number[] | null
          preferred_time_from?: string | null
          preferred_time_until?: string | null
          priority_score?: number
          service_type_id: string
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          bike_id?: string | null
          booked_appointment_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          preferred_date_from?: string
          preferred_date_until?: string | null
          preferred_days?: number[] | null
          preferred_time_from?: string | null
          preferred_time_until?: string | null
          priority_score?: number
          service_type_id?: string
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_waitlist_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "customer_bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_booked_appointment_id_fkey"
            columns: ["booked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      appointments: {
        Row: {
          actual_duration_minutes: number | null
          assigned_mechanic_id: string | null
          bike_id: string | null
          booked_via: string
          completed_by: string | null
          confirmation_sent_at: string | null
          created_at: string
          duration_minutes: number | null
          extra_charge_eur: number | null
          id: string
          is_covered_by_plan: boolean
          notes: string | null
          priority: string
          priority_score: number
          reminder_24h_sent_at: string | null
          reschedule_count: number
          reschedule_of: string | null
          scheduled_date: string
          scheduled_end_time: string | null
          scheduled_start_time: string
          service_type_id: string | null
          status: Database["public"]["Enums"]["appointment_status_enum"]
          subscription_id: string | null
          subscription_plan_level: number | null
          updated_at: string
          user_id: string
          work_ended_at: string | null
          work_started_at: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          assigned_mechanic_id?: string | null
          bike_id?: string | null
          booked_via?: string
          completed_by?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          extra_charge_eur?: number | null
          id?: string
          is_covered_by_plan?: boolean
          notes?: string | null
          priority?: string
          priority_score?: number
          reminder_24h_sent_at?: string | null
          reschedule_count?: number
          reschedule_of?: string | null
          scheduled_date: string
          scheduled_end_time?: string | null
          scheduled_start_time: string
          service_type_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_enum"]
          subscription_id?: string | null
          subscription_plan_level?: number | null
          updated_at?: string
          user_id: string
          work_ended_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          assigned_mechanic_id?: string | null
          bike_id?: string | null
          booked_via?: string
          completed_by?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          extra_charge_eur?: number | null
          id?: string
          is_covered_by_plan?: boolean
          notes?: string | null
          priority?: string
          priority_score?: number
          reminder_24h_sent_at?: string | null
          reschedule_count?: number
          reschedule_of?: string | null
          scheduled_date?: string
          scheduled_end_time?: string | null
          scheduled_start_time?: string
          service_type_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_enum"]
          subscription_id?: string | null
          subscription_plan_level?: number | null
          updated_at?: string
          user_id?: string
          work_ended_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "customer_bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_reschedule_of_fkey"
            columns: ["reschedule_of"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      bike_archive_records: {
        Row: {
          archived_by: string | null
          bike_id: string
          bike_model: string | null
          bike_serial: string | null
          created_at: string
          customer_id: string
          id: string
          plan_name: string | null
          reason: string | null
          restored_at: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          archived_by?: string | null
          bike_id: string
          bike_model?: string | null
          bike_serial?: string | null
          created_at?: string
          customer_id: string
          id?: string
          plan_name?: string | null
          reason?: string | null
          restored_at?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          archived_by?: string | null
          bike_id?: string
          bike_model?: string | null
          bike_serial?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          plan_name?: string | null
          reason?: string | null
          restored_at?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_archive_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "customer_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_assessments: {
        Row: {
          answers: Json
          assessed_by: string | null
          bike_id: string
          condition_label: string
          created_at: string
          customer_id: string | null
          id: string
          is_second_hand: boolean
          notes: string | null
          origin: string
          overall_score: number
          scores: Json
          updated_at: string
        }
        Insert: {
          answers?: Json
          assessed_by?: string | null
          bike_id: string
          condition_label?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_second_hand?: boolean
          notes?: string | null
          origin?: string
          overall_score?: number
          scores?: Json
          updated_at?: string
        }
        Update: {
          answers?: Json
          assessed_by?: string | null
          bike_id?: string
          condition_label?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_second_hand?: boolean
          notes?: string | null
          origin?: string
          overall_score?: number
          scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_assessments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "customer_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hour_exceptions: {
        Row: {
          close_time: string | null
          created_at: string
          exception_date: string
          exception_type: string
          id: string
          is_open: boolean
          is_public_holiday: boolean
          max_parallel_services: number | null
          open_time: string | null
          reason: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          exception_date: string
          exception_type: string
          id?: string
          is_open?: boolean
          is_public_holiday?: boolean
          max_parallel_services?: number | null
          open_time?: string | null
          reason: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          exception_date?: string
          exception_type?: string
          id?: string
          is_open?: boolean
          is_public_holiday?: boolean
          max_parallel_services?: number | null
          open_time?: string | null
          reason?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          buffer_minutes: number
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          max_parallel_services: number
          notes: string | null
          open_time: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          buffer_minutes?: number
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          max_parallel_services?: number
          notes?: string | null
          open_time?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          buffer_minutes?: number
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          max_parallel_services?: number
          notes?: string | null
          open_time?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          name_nl: string | null
          name_pt: string | null
          parent_id: string | null
          slug: string
          type: Database["public"]["Enums"]["category_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          name_nl?: string | null
          name_pt?: string | null
          parent_id?: string | null
          slug: string
          type: Database["public"]["Enums"]["category_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          name_nl?: string | null
          name_pt?: string | null
          parent_id?: string | null
          slug?: string
          type?: Database["public"]["Enums"]["category_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_closure: {
        Row: {
          ancestor_id: string
          depth: number
          descendant_id: string
        }
        Insert: {
          ancestor_id: string
          depth: number
          descendant_id: string
        }
        Update: {
          ancestor_id?: string
          depth?: number
          descendant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_closure_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_closure_descendant_id_fkey"
            columns: ["descendant_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_bikes: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          archived_reason: string | null
          color: string | null
          created_at: string
          customer_id: string
          id: string
          image_url: string | null
          is_active: boolean
          km: number
          last_service_at: string | null
          model: string
          next_service_at: string | null
          purchased_at: string | null
          serial: string | null
          services_completed: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          color?: string | null
          created_at?: string
          customer_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          km?: number
          last_service_at?: string | null
          model: string
          next_service_at?: string | null
          purchased_at?: string | null
          serial?: string | null
          services_completed?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          km?: number
          last_service_at?: string | null
          model?: string
          next_service_at?: string | null
          purchased_at?: string | null
          serial?: string | null
          services_completed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_bikes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_health_snapshots: {
        Row: {
          created_at: string
          customer_id: string
          health_score: number
          id: string
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage_enum"]
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          health_score: number
          id?: string
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage_enum"]
          snapshot_date: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          health_score?: number
          id?: string
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage_enum"]
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_health_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          direction: Database["public"]["Enums"]["interaction_direction_enum"]
          duration_min: number | null
          id: string
          outcome: string | null
          subject: string | null
          summary: string | null
          type: Database["public"]["Enums"]["interaction_type_enum"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          direction?: Database["public"]["Enums"]["interaction_direction_enum"]
          duration_min?: number | null
          id?: string
          outcome?: string | null
          subject?: string | null
          summary?: string | null
          type: Database["public"]["Enums"]["interaction_type_enum"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          direction?: Database["public"]["Enums"]["interaction_direction_enum"]
          duration_min?: number | null
          id?: string
          outcome?: string | null
          subject?: string | null
          summary?: string | null
          type?: Database["public"]["Enums"]["interaction_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          customer_id: string
          followup_date: string | null
          followup_done: boolean
          id: string
          is_pinned: boolean
          linked_appointment_id: string | null
          linked_order_id: string | null
          note_type: Database["public"]["Enums"]["note_type_enum"]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          followup_date?: string | null
          followup_done?: boolean
          id?: string
          is_pinned?: boolean
          linked_appointment_id?: string | null
          linked_order_id?: string | null
          note_type?: Database["public"]["Enums"]["note_type_enum"]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          followup_date?: string | null
          followup_done?: boolean
          id?: string
          is_pinned?: boolean
          linked_appointment_id?: string | null
          linked_order_id?: string | null
          note_type?: Database["public"]["Enums"]["note_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          assigned_to: string | null
          churn_risk_score: number
          created_at: string
          health_score: number
          id: string
          last_contact_at: string | null
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage_enum"]
          ltv_estimated: number
          notes_count: number
          rfm_score: number
          tags: string[]
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          churn_risk_score?: number
          created_at?: string
          health_score?: number
          id?: string
          last_contact_at?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage_enum"]
          ltv_estimated?: number
          notes_count?: number
          rfm_score?: number
          tags?: string[]
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          churn_risk_score?: number
          created_at?: string
          health_score?: number
          id?: string
          last_contact_at?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage_enum"]
          ltv_estimated?: number
          notes_count?: number
          rfm_score?: number
          tags?: string[]
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_segment_members: {
        Row: {
          added_at: string
          customer_id: string
          segment_id: string
        }
        Insert: {
          added_at?: string
          customer_id: string
          segment_id: string
        }
        Update: {
          added_at?: string
          customer_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segment_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          color: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          segment_type: Database["public"]["Enums"]["segment_type_enum"]
          updated_at: string
        }
        Insert: {
          color?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          segment_type?: Database["public"]["Enums"]["segment_type_enum"]
          updated_at?: string
        }
        Update: {
          color?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          segment_type?: Database["public"]["Enums"]["segment_type_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      epass_card_requests: {
        Row: {
          bike_id: string | null
          bike_model: string | null
          bike_serial: string | null
          card_number: string
          created_at: string
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_id?: string | null
          bike_model?: string | null
          bike_serial?: string | null
          card_number: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_id?: string | null
          bike_model?: string | null
          bike_serial?: string | null
          card_number?: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epass_card_requests_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "customer_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          location_id: string
          low_stock_threshold: number
          qty_available: number
          qty_incoming: number
          qty_reserved: number
          reorder_point: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          id?: string
          location_id: string
          low_stock_threshold?: number
          qty_available?: number
          qty_incoming?: number
          qty_reserved?: number
          reorder_point?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          id?: string
          location_id?: string
          low_stock_threshold?: number
          qty_available?: number
          qty_incoming?: number
          qty_reserved?: number
          reorder_point?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type_enum"]
          notes: string | null
          qty_delta: number
          reference_id: string | null
          reference_type: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type_enum"]
          notes?: string | null
          qty_delta: number
          reference_id?: string | null
          reference_type?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type_enum"]
          notes?: string | null
          qty_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          location_type: Database["public"]["Enums"]["location_type_enum"]
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_type: Database["public"]["Enums"]["location_type_enum"]
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["location_type_enum"]
          name?: string
        }
        Relationships: []
      }
      member_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_payment_method_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_url: string | null
          method: Database["public"]["Enums"]["payment_method_enum"]
          notes: string | null
          paid_at: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_url?: string | null
          method: Database["public"]["Enums"]["payment_method_enum"]
          notes?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_url?: string | null
          method?: Database["public"]["Enums"]["payment_method_enum"]
          notes?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pickup_places: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          is_headquarters: boolean
          latitude: number
          longitude: number
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_headquarters?: boolean
          latitude: number
          longitude: number
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_headquarters?: boolean
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_versions: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          entitlements: Json
          features: Json
          id: string
          interval: Database["public"]["Enums"]["plan_interval_enum"]
          plan_id: string
          price: number
          status: Database["public"]["Enums"]["plan_version_status_enum"]
          stripe_price_id: string | null
          trial_days: number
          urgent_service_fee: number
          urgent_service_included: boolean
          version_number: number
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string
          entitlements?: Json
          features?: Json
          id?: string
          interval?: Database["public"]["Enums"]["plan_interval_enum"]
          plan_id: string
          price: number
          status?: Database["public"]["Enums"]["plan_version_status_enum"]
          stripe_price_id?: string | null
          trial_days?: number
          urgent_service_fee?: number
          urgent_service_included?: boolean
          version_number: number
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          entitlements?: Json
          features?: Json
          id?: string
          interval?: Database["public"]["Enums"]["plan_interval_enum"]
          plan_id?: string
          price?: number
          status?: Database["public"]["Enums"]["plan_version_status_enum"]
          stripe_price_id?: string | null
          trial_days?: number
          urgent_service_fee?: number
          urgent_service_included?: boolean
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_plan_kpis"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      plans: {
        Row: {
          color_hex: string | null
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          slug: string
          stripe_product_id: string | null
          tier_level: number
          updated_at: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          slug: string
          stripe_product_id?: string | null
          tier_level?: number
          updated_at?: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          slug?: string
          stripe_product_id?: string | null
          tier_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          product_id: string
          url: string
          variant_id: string | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id: string
          url: string
          variant_id?: string | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id?: string
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          display_order: number
          id: string
          product_id: string
          spec_group: string
          spec_key: string
          spec_value: string
        }
        Insert: {
          display_order?: number
          id?: string
          product_id: string
          spec_group: string
          spec_key: string
          spec_value: string
        }
        Update: {
          display_order?: number
          id?: string
          product_id?: string
          spec_group?: string
          spec_key?: string
          spec_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_tag_map: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          price_override: number | null
          product_id: string
          sku: string
          weight_grams: number | null
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          price_override?: number | null
          product_id: string
          sku: string
          weight_grams?: number | null
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          price_override?: number | null
          product_id?: string
          sku?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string
          color_hex: string | null
          created_at: string
          currency: string
          description: string | null
          description_en: string | null
          description_nl: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_subscription_exclusive: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          name_en: string | null
          name_nl: string | null
          name_pt: string | null
          product_type: Database["public"]["Enums"]["product_type_enum"]
          sale_price: number | null
          short_description: string | null
          sku_prefix: string | null
          slug: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          base_price: number
          category_id: string
          color_hex?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_en?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_subscription_exclusive?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          name_en?: string | null
          name_nl?: string | null
          name_pt?: string | null
          product_type: Database["public"]["Enums"]["product_type_enum"]
          sale_price?: number | null
          short_description?: string | null
          sku_prefix?: string | null
          slug: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          base_price?: number
          category_id?: string
          color_hex?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_en?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_subscription_exclusive?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          name_en?: string | null
          name_nl?: string | null
          name_pt?: string | null
          product_type?: Database["public"]["Enums"]["product_type_enum"]
          sale_price?: number | null
          short_description?: string | null
          sku_prefix?: string | null
          slug?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          must_complete_profile: boolean
          phone: string | null
          phone_verified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_complete_profile?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_complete_profile?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qc_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          photo_min_count: number
          position: number
          requires_photo: boolean
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo_min_count?: number
          position?: number
          requires_photo?: boolean
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo_min_count?: number
          position?: number
          requires_photo?: boolean
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qc_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_tasks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          label: string
          position: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label: string
          position?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label?: string
          position?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "qc_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          base_price: number | null
          buffer_minutes_override: number | null
          color: string | null
          covered_by_plan_levels: number[] | null
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number
          icon: string | null
          id: string
          is_active: boolean
          is_emergency: boolean
          name: string
          name_en: string | null
          name_nl: string | null
          priority_score: number
          required_specializations: string[] | null
          reward_points: number
          slug: string
        }
        Insert: {
          base_price?: number | null
          buffer_minutes_override?: number | null
          color?: string | null
          covered_by_plan_levels?: number[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_emergency?: boolean
          name: string
          name_en?: string | null
          name_nl?: string | null
          priority_score?: number
          required_specializations?: string[] | null
          reward_points?: number
          slug: string
        }
        Update: {
          base_price?: number | null
          buffer_minutes_override?: number | null
          color?: string | null
          covered_by_plan_levels?: number[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_emergency?: boolean
          name?: string
          name_en?: string | null
          name_nl?: string | null
          priority_score?: number
          required_specializations?: string[] | null
          reward_points?: number
          slug?: string
        }
        Relationships: []
      }
      staff_schedule_exceptions: {
        Row: {
          created_at: string
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          is_working: boolean
          reason: string | null
          staff_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          exception_date: string
          exception_type: string
          id?: string
          is_working?: boolean
          reason?: string | null
          staff_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          is_working?: boolean
          reason?: string | null
          staff_id?: string
          start_time?: string | null
        }
        Relationships: []
      }
      staff_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          is_working: boolean
          max_concurrent: number
          staff_id: string
          start_time: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          is_working?: boolean
          max_concurrent?: number
          staff_id: string
          start_time?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_working?: boolean
          max_concurrent?: number
          staff_id?: string
          start_time?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      staff_shift_breaks: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          reason: string | null
          shift_id: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          shift_id: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          shift_id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          break_minutes: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          scheduled_minutes: number
          shift_date: string
          status: string
          updated_at: string
          user_id: string
          worked_minutes: number
        }
        Insert: {
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_minutes?: number
          shift_date: string
          status?: string
          updated_at?: string
          user_id: string
          worked_minutes?: number
        }
        Update: {
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_minutes?: number
          shift_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          worked_minutes?: number
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["subscription_event_enum"]
          from_plan_version_id: string | null
          id: string
          metadata: Json
          subscription_id: string
          to_plan_version_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["subscription_event_enum"]
          from_plan_version_id?: string | null
          id?: string
          metadata?: Json
          subscription_id: string
          to_plan_version_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["subscription_event_enum"]
          from_plan_version_id?: string | null
          id?: string
          metadata?: Json
          subscription_id?: string
          to_plan_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_version_id_fkey"
            columns: ["from_plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_from_plan_version_id_fkey"
            columns: ["from_plan_version_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["plan_version_id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_version_id_fkey"
            columns: ["to_plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_version_id_fkey"
            columns: ["to_plan_version_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["plan_version_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_version_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_version_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_version_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "v_subscriber_summary"
            referencedColumns: ["plan_version_id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          tag_type: Database["public"]["Enums"]["tag_type_enum"]
        }
        Insert: {
          id?: string
          name: string
          tag_type: Database["public"]["Enums"]["tag_type_enum"]
        }
        Update: {
          id?: string
          name?: string
          tag_type?: Database["public"]["Enums"]["tag_type_enum"]
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
      vip_slot_rules: {
        Row: {
          created_at: string
          day_of_week: number | null
          id: string
          is_active: boolean
          plan_level: number
          release_hours_before: number
          reserved_slots: number
          time_from: string | null
          time_until: string | null
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          is_active?: boolean
          plan_level: number
          release_hours_before?: number
          reserved_slots?: number
          time_from?: string | null
          time_until?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          is_active?: boolean
          plan_level?: number
          release_hours_before?: number
          reserved_slots?: number
          time_from?: string | null
          time_until?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_mrr_timeseries: {
        Row: {
          month: string | null
          payments_count: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_plan_kpis: {
        Row: {
          active_subs: number | null
          churn_30d: number | null
          mrr: number | null
          name: string | null
          plan_id: string | null
          slug: string | null
        }
        Relationships: []
      }
      v_product_stock: {
        Row: {
          attributes: Json | null
          category_id: string | null
          is_low_stock: boolean | null
          product_id: string | null
          product_name: string | null
          product_type: Database["public"]["Enums"]["product_type_enum"] | null
          sku: string | null
          slug: string | null
          total_available: number | null
          total_incoming: number | null
          total_reserved: number | null
          variant_id: string | null
          variant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      v_subscriber_summary: {
        Row: {
          churn_risk_score: number | null
          current_period_end: string | null
          interval: Database["public"]["Enums"]["plan_interval_enum"] | null
          last_payment_at: string | null
          lifetime_value: number | null
          payments_count: number | null
          plan_id: string | null
          plan_version_id: string | null
          price: number | null
          status: Database["public"]["Enums"]["subscription_status_enum"] | null
          subscription_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_plan_kpis"
            referencedColumns: ["plan_id"]
          },
        ]
      }
    }
    Functions: {
      book_available_slot: {
        Args: {
          p_bike_id: string
          p_date: string
          p_end_time: string
          p_mechanic_id: string
          p_notes?: string
          p_service_type_id: string
          p_start_time: string
          p_subscription_id: string
          p_urgent?: boolean
          p_user_id: string
        }
        Returns: {
          actual_duration_minutes: number | null
          assigned_mechanic_id: string | null
          bike_id: string | null
          booked_via: string
          completed_by: string | null
          confirmation_sent_at: string | null
          created_at: string
          duration_minutes: number | null
          extra_charge_eur: number | null
          id: string
          is_covered_by_plan: boolean
          notes: string | null
          priority: string
          priority_score: number
          reminder_24h_sent_at: string | null
          reschedule_count: number
          reschedule_of: string | null
          scheduled_date: string
          scheduled_end_time: string | null
          scheduled_start_time: string
          service_type_id: string | null
          status: Database["public"]["Enums"]["appointment_status_enum"]
          subscription_id: string | null
          subscription_plan_level: number | null
          updated_at: string
          user_id: string
          work_ended_at: string | null
          work_started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_adjust_stock: {
        Args: {
          p_delta: number
          p_location_id: string
          p_movement_type: Database["public"]["Enums"]["movement_type_enum"]
          p_notes?: string
          p_reference_id?: string
          p_reference_type?: string
          p_variant_id: string
        }
        Returns: {
          id: string
          location_id: string
          low_stock_threshold: number
          qty_available: number
          qty_incoming: number
          qty_reserved: number
          reorder_point: number
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_cancel_bike_subscription: {
        Args: { p_bike_id: string; p_reason?: string }
        Returns: {
          archived_by: string | null
          bike_id: string
          bike_model: string | null
          bike_serial: string | null
          created_at: string
          customer_id: string
          id: string
          plan_name: string | null
          reason: string | null
          restored_at: string | null
          subscription_id: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bike_archive_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_cancel_subscription: {
        Args: { p_at_period_end?: boolean; p_subscription_id: string }
        Returns: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_version_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_change_subscription_plan: {
        Args: { p_new_plan_version_id: string; p_subscription_id: string }
        Returns: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_version_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_create_plan_version:
        | {
            Args: {
              p_activate?: boolean
              p_currency?: string
              p_features?: Json
              p_interval?: Database["public"]["Enums"]["plan_interval_enum"]
              p_plan_id: string
              p_price: number
              p_trial_days?: number
            }
            Returns: {
              created_at: string
              currency: string
              effective_from: string
              entitlements: Json
              features: Json
              id: string
              interval: Database["public"]["Enums"]["plan_interval_enum"]
              plan_id: string
              price: number
              status: Database["public"]["Enums"]["plan_version_status_enum"]
              stripe_price_id: string | null
              trial_days: number
              urgent_service_fee: number
              urgent_service_included: boolean
              version_number: number
            }
            SetofOptions: {
              from: "*"
              to: "plan_versions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_activate?: boolean
              p_currency?: string
              p_features?: Json
              p_interval?: Database["public"]["Enums"]["plan_interval_enum"]
              p_plan_id: string
              p_price: number
              p_trial_days?: number
              p_urgent_service_fee?: number
              p_urgent_service_included?: boolean
            }
            Returns: {
              created_at: string
              currency: string
              effective_from: string
              entitlements: Json
              features: Json
              id: string
              interval: Database["public"]["Enums"]["plan_interval_enum"]
              plan_id: string
              price: number
              status: Database["public"]["Enums"]["plan_version_status_enum"]
              stripe_price_id: string | null
              trial_days: number
              urgent_service_fee: number
              urgent_service_included: boolean
              version_number: number
            }
            SetofOptions: {
              from: "*"
              to: "plan_versions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      fn_log_customer_note: {
        Args: {
          p_content: string
          p_customer_id: string
          p_followup_date?: string
          p_is_pinned?: boolean
          p_linked_appointment_id?: string
          p_linked_order_id?: string
          p_note_type?: Database["public"]["Enums"]["note_type_enum"]
        }
        Returns: {
          content: string
          created_at: string
          created_by: string | null
          customer_id: string
          followup_date: string | null
          followup_done: boolean
          id: string
          is_pinned: boolean
          linked_appointment_id: string | null
          linked_order_id: string | null
          note_type: Database["public"]["Enums"]["note_type_enum"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_register_contact: {
        Args: {
          p_customer_id: string
          p_direction: Database["public"]["Enums"]["interaction_direction_enum"]
          p_duration_min?: number
          p_outcome?: string
          p_subject?: string
          p_summary?: string
          p_type: Database["public"]["Enums"]["interaction_type_enum"]
        }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string
          direction: Database["public"]["Enums"]["interaction_direction_enum"]
          duration_min: number | null
          id: string
          outcome: string | null
          subject: string | null
          summary: string | null
          type: Database["public"]["Enums"]["interaction_type_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "customer_interactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_register_manual_payment: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method_enum"]
          p_notes?: string
          p_period_end?: string
          p_period_start?: string
          p_subscription_id: string
        }
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_url: string | null
          method: Database["public"]["Enums"]["payment_method_enum"]
          notes: string | null
          paid_at: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_appointment_staff: {
        Args: { _appointment_ids: string[] }
        Returns: {
          appointment_id: string
          completed_by: string
          completed_by_name: string
          mechanic_id: string
          mechanic_name: string
        }[]
      }
      get_available_slots: {
        Args: { _date: string; _mechanic_id?: string; _service_type_id: string }
        Returns: {
          end_time: string
          mechanic_id: string
          mechanic_name: string
          start_time: string
        }[]
      }
      get_epass_bike: {
        Args: { _identifier: string }
        Returns: {
          color: string
          customer_id: string
          id: string
          image_url: string
          km: number
          last_service_at: string
          model: string
          next_service_at: string
          owner_customer_id: string
          owner_email: string
          owner_name: string
          owner_phone: string
          owner_user_id: string
          purchased_at: string
          serial: string
          services_completed: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bike_serial_available: { Args: { _serial: string }; Returns: boolean }
      set_staff_day_availability: {
        Args: {
          _date: string
          _end?: string
          _is_working?: boolean
          _reason?: string
          _staff_id: string
          _start?: string
        }
        Returns: {
          created_at: string
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          is_working: boolean
          reason: string | null
          staff_id: string
          start_time: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_schedule_exceptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_day_availability: {
        Args: { _date: string; _staff_id: string }
        Returns: {
          end_time: string
          is_working: boolean
          max_concurrent: number
          source: string
          start_time: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer" | "guest"
      appointment_status_enum:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "canceled"
        | "no_show"
        | "rescheduled"
      category_type_enum:
        | "bike"
        | "accessory"
        | "service"
        | "insurance"
        | "part"
      interaction_direction_enum: "inbound" | "outbound"
      interaction_type_enum:
        | "call"
        | "whatsapp"
        | "email"
        | "in_person"
        | "other"
      lifecycle_stage_enum:
        | "lead"
        | "new"
        | "active_subscriber"
        | "loyal"
        | "at_risk"
        | "churned"
      location_type_enum: "warehouse" | "store_floor" | "virtual"
      movement_type_enum:
        | "sale"
        | "return"
        | "adjustment"
        | "transfer"
        | "incoming"
        | "reservation"
        | "reservation_release"
      note_type_enum:
        | "general"
        | "complaint"
        | "compliment"
        | "followup"
        | "opportunity"
      payment_method_enum:
        | "stripe_card"
        | "stripe_sepa"
        | "cash"
        | "bank_transfer"
        | "pos_card"
        | "other"
      payment_status_enum: "pending" | "succeeded" | "failed" | "refunded"
      plan_interval_enum: "monthly" | "quarterly" | "yearly" | "lifetime"
      plan_version_status_enum: "draft" | "active" | "archived"
      product_type_enum:
        | "bike"
        | "accessory"
        | "service"
        | "bundle"
        | "subscription_addon"
        | "insurance"
      segment_type_enum: "dynamic" | "static"
      subscription_event_enum:
        | "created"
        | "upgraded"
        | "downgraded"
        | "paused"
        | "resumed"
        | "canceled"
        | "reactivated"
        | "payment_failed"
        | "payment_succeeded"
        | "manual_payment"
      subscription_status_enum:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
      tag_type_enum:
        | "use_case"
        | "terrain"
        | "rider_level"
        | "feature"
        | "style"
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
      app_role: ["admin", "staff", "customer", "guest"],
      appointment_status_enum: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "canceled",
        "no_show",
        "rescheduled",
      ],
      category_type_enum: ["bike", "accessory", "service", "insurance", "part"],
      interaction_direction_enum: ["inbound", "outbound"],
      interaction_type_enum: [
        "call",
        "whatsapp",
        "email",
        "in_person",
        "other",
      ],
      lifecycle_stage_enum: [
        "lead",
        "new",
        "active_subscriber",
        "loyal",
        "at_risk",
        "churned",
      ],
      location_type_enum: ["warehouse", "store_floor", "virtual"],
      movement_type_enum: [
        "sale",
        "return",
        "adjustment",
        "transfer",
        "incoming",
        "reservation",
        "reservation_release",
      ],
      note_type_enum: [
        "general",
        "complaint",
        "compliment",
        "followup",
        "opportunity",
      ],
      payment_method_enum: [
        "stripe_card",
        "stripe_sepa",
        "cash",
        "bank_transfer",
        "pos_card",
        "other",
      ],
      payment_status_enum: ["pending", "succeeded", "failed", "refunded"],
      plan_interval_enum: ["monthly", "quarterly", "yearly", "lifetime"],
      plan_version_status_enum: ["draft", "active", "archived"],
      product_type_enum: [
        "bike",
        "accessory",
        "service",
        "bundle",
        "subscription_addon",
        "insurance",
      ],
      segment_type_enum: ["dynamic", "static"],
      subscription_event_enum: [
        "created",
        "upgraded",
        "downgraded",
        "paused",
        "resumed",
        "canceled",
        "reactivated",
        "payment_failed",
        "payment_succeeded",
        "manual_payment",
      ],
      subscription_status_enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
      tag_type_enum: ["use_case", "terrain", "rider_level", "feature", "style"],
    },
  },
} as const
