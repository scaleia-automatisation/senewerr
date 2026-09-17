export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          role: Database['public']['Enums']['user_role']
          full_name: string
          phone: string | null
          avatar_url: string | null
          preferred_language: string | null
          notification_preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database['public']['Enums']['user_role']
          full_name: string
          phone?: string | null
          avatar_url?: string | null
          preferred_language?: string | null
          notification_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database['public']['Enums']['user_role']
          full_name?: string
          phone?: string | null
          avatar_url?: string | null
          preferred_language?: string | null
          notification_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      patients: {
        Row: {
          id: string
          profile_id: string
          date_of_birth: string | null
          gender: Database['public']['Enums']['gender'] | null
          blood_type: string | null
          allergies: string[] | null
          chronic_conditions: string[] | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          address: string | null
          city: string | null
          region: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          date_of_birth?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          blood_type?: string | null
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          date_of_birth?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          blood_type?: string | null
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'patients_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      beneficiaries: {
        Row: {
          id: string
          patient_id: string
          full_name: string
          date_of_birth: string | null
          gender: Database['public']['Enums']['gender'] | null
          relationship: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          full_name: string
          date_of_birth?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          relationship?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          full_name?: string
          date_of_birth?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          relationship?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'beneficiaries_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          }
        ]
      }
      organizations: {
        Row: {
          id: string
          type: Database['public']['Enums']['organization_type']
          name: string
          slug: string
          description: string | null
          phone: string | null
          email: string | null
          website: string | null
          address: string | null
          city: string | null
          region: string | null
          latitude: number | null
          longitude: number | null
          logo_url: string | null
          cover_url: string | null
          license_number: string | null
          verification_status: Database['public']['Enums']['verification_status']
          verified_at: string | null
          plan_code: Database['public']['Enums']['plan_code']
          is_active: boolean
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: Database['public']['Enums']['organization_type']
          name: string
          slug: string
          description?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
          latitude?: number | null
          longitude?: number | null
          logo_url?: string | null
          cover_url?: string | null
          license_number?: string | null
          verification_status?: Database['public']['Enums']['verification_status']
          verified_at?: string | null
          plan_code?: Database['public']['Enums']['plan_code']
          is_active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: Database['public']['Enums']['organization_type']
          name?: string
          slug?: string
          description?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
          latitude?: number | null
          longitude?: number | null
          logo_url?: string | null
          cover_url?: string | null
          license_number?: string | null
          verification_status?: Database['public']['Enums']['verification_status']
          verified_at?: string | null
          plan_code?: Database['public']['Enums']['plan_code']
          is_active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          profile_id: string
          role: string
          status: Database['public']['Enums']['member_status']
          invited_by: string | null
          joined_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          profile_id: string
          role: string
          status?: Database['public']['Enums']['member_status']
          invited_by?: string | null
          joined_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          profile_id?: string
          role?: string
          status?: Database['public']['Enums']['member_status']
          invited_by?: string | null
          joined_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'organization_members_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      professionals: {
        Row: {
          id: string
          profile_id: string
          organization_id: string | null
          specialty: Database['public']['Enums']['medical_specialty']
          license_number: string | null
          experience_years: number | null
          consultation_fee: number | null
          teleconsultation_fee: number | null
          bio: string | null
          languages: string[] | null
          available_for_teleconsultation: boolean
          verification_status: Database['public']['Enums']['verification_status']
          verified_at: string | null
          search_vector: unknown | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          organization_id?: string | null
          specialty: Database['public']['Enums']['medical_specialty']
          license_number?: string | null
          experience_years?: number | null
          consultation_fee?: number | null
          teleconsultation_fee?: number | null
          bio?: string | null
          languages?: string[] | null
          available_for_teleconsultation?: boolean
          verification_status?: Database['public']['Enums']['verification_status']
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          organization_id?: string | null
          specialty?: Database['public']['Enums']['medical_specialty']
          license_number?: string | null
          experience_years?: number | null
          consultation_fee?: number | null
          teleconsultation_fee?: number | null
          bio?: string | null
          languages?: string[] | null
          available_for_teleconsultation?: boolean
          verification_status?: Database['public']['Enums']['verification_status']
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'professionals_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      professional_qualifications: {
        Row: {
          id: string
          professional_id: string
          title: string
          institution: string | null
          year: number | null
          document_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          title: string
          institution?: string | null
          year?: number | null
          document_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          title?: string
          institution?: string | null
          year?: number | null
          document_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'professional_qualifications_professional_id_fkey'
            columns: ['professional_id']
            isOneToOne: false
            referencedRelation: 'professionals'
            referencedColumns: ['id']
          }
        ]
      }
      professional_schedules: {
        Row: {
          id: string
          professional_id: string
          day_of_week: number
          start_time: string
          end_time: string
          slot_duration_minutes: number
          is_teleconsultation: boolean
          is_active: boolean
          valid_from: string | null
          valid_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          day_of_week: number
          start_time: string
          end_time: string
          slot_duration_minutes?: number
          is_teleconsultation?: boolean
          is_active?: boolean
          valid_from?: string | null
          valid_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          slot_duration_minutes?: number
          is_teleconsultation?: boolean
          is_active?: boolean
          valid_from?: string | null
          valid_until?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'professional_schedules_professional_id_fkey'
            columns: ['professional_id']
            isOneToOne: false
            referencedRelation: 'professionals'
            referencedColumns: ['id']
          }
        ]
      }
      schedule_exceptions: {
        Row: {
          id: string
          professional_id: string
          exception_date: string
          reason: string | null
          slots: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          exception_date: string
          reason?: string | null
          slots?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          exception_date?: string
          reason?: string | null
          slots?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      patient_professional_access: {
        Row: {
          id: string
          patient_id: string
          professional_id: string
          granted_at: string
          revoked_at: string | null
          valid_until: string | null
          granted_by: string | null
        }
        Insert: {
          id?: string
          patient_id: string
          professional_id: string
          granted_at?: string
          revoked_at?: string | null
          valid_until?: string | null
          granted_by?: string | null
        }
        Update: {
          id?: string
          patient_id?: string
          professional_id?: string
          granted_at?: string
          revoked_at?: string | null
          valid_until?: string | null
          granted_by?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          appointment_number: string | null
          patient_id: string
          professional_id: string
          organization_id: string | null
          appointment_type: Database['public']['Enums']['appointment_type']
          status: Database['public']['Enums']['appointment_status']
          scheduled_at: string
          duration_minutes: number
          chief_complaint: string | null
          notes: string | null
          teleconsultation_url: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          payment_id: string | null
          amount: number | null
          reminder_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_number?: string | null
          patient_id: string
          professional_id: string
          organization_id?: string | null
          appointment_type?: Database['public']['Enums']['appointment_type']
          status?: Database['public']['Enums']['appointment_status']
          scheduled_at: string
          duration_minutes?: number
          chief_complaint?: string | null
          notes?: string | null
          teleconsultation_url?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          payment_id?: string | null
          amount?: number | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          appointment_number?: string | null
          patient_id?: string
          professional_id?: string
          organization_id?: string | null
          appointment_type?: Database['public']['Enums']['appointment_type']
          status?: Database['public']['Enums']['appointment_status']
          scheduled_at?: string
          duration_minutes?: number
          chief_complaint?: string | null
          notes?: string | null
          teleconsultation_url?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          payment_id?: string | null
          amount?: number | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          id: string
          appointment_id: string
          professional_id: string
          patient_id: string
          subjective: string | null
          objective: string | null
          assessment: string | null
          plan: string | null
          diagnoses: Json | null
          vital_signs: Json | null
          follow_up_date: string | null
          follow_up_notes: string | null
          is_teleconsultation: boolean
          duration_minutes: number | null
          transcript_document_id: string | null
          ai_summary: string | null
          ai_tokens_used: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          professional_id: string
          patient_id: string
          subjective?: string | null
          objective?: string | null
          assessment?: string | null
          plan?: string | null
          diagnoses?: Json | null
          vital_signs?: Json | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          is_teleconsultation?: boolean
          duration_minutes?: number | null
          transcript_document_id?: string | null
          ai_summary?: string | null
          ai_tokens_used?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          professional_id?: string
          patient_id?: string
          subjective?: string | null
          objective?: string | null
          assessment?: string | null
          plan?: string | null
          diagnoses?: Json | null
          vital_signs?: Json | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          is_teleconsultation?: boolean
          duration_minutes?: number | null
          transcript_document_id?: string | null
          ai_summary?: string | null
          ai_tokens_used?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          id: string
          prescription_number: string | null
          consultation_id: string | null
          professional_id: string
          patient_id: string
          diagnosis: string | null
          notes: string | null
          valid_until: string | null
          status: Database['public']['Enums']['prescription_status']
          pdf_document_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prescription_number?: string | null
          consultation_id?: string | null
          professional_id: string
          patient_id: string
          diagnosis?: string | null
          notes?: string | null
          valid_until?: string | null
          status?: Database['public']['Enums']['prescription_status']
          pdf_document_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prescription_number?: string | null
          consultation_id?: string | null
          professional_id?: string
          patient_id?: string
          diagnosis?: string | null
          notes?: string | null
          valid_until?: string | null
          status?: Database['public']['Enums']['prescription_status']
          pdf_document_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          id: string
          prescription_id: string
          medicine_id: string | null
          medicine_name: string
          dosage: string | null
          frequency: string | null
          duration: string | null
          quantity: number | null
          unit: string | null
          instructions: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          prescription_id: string
          medicine_id?: string | null
          medicine_name: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          quantity?: number | null
          unit?: string | null
          instructions?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          prescription_id?: string
          medicine_id?: string | null
          medicine_name?: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          quantity?: number | null
          unit?: string | null
          instructions?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      medicines: {
        Row: {
          id: string
          name: string
          generic_name: string | null
          brand_names: string[] | null
          category: string | null
          form: string | null
          strength: string | null
          unit: string | null
          requires_prescription: boolean
          is_controlled: boolean
          description: string | null
          contraindications: string | null
          search_vector: unknown | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          generic_name?: string | null
          brand_names?: string[] | null
          category?: string | null
          form?: string | null
          strength?: string | null
          unit?: string | null
          requires_prescription?: boolean
          is_controlled?: boolean
          description?: string | null
          contraindications?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          generic_name?: string | null
          brand_names?: string[] | null
          category?: string | null
          form?: string | null
          strength?: string | null
          unit?: string | null
          requires_prescription?: boolean
          is_controlled?: boolean
          description?: string | null
          contraindications?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          id: string
          organization_id: string
          is_duty: boolean
          duty_start_at: string | null
          duty_end_at: string | null
          opening_hours: Json | null
          delivery_available: boolean
          delivery_radius_km: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          is_duty?: boolean
          duty_start_at?: string | null
          duty_end_at?: string | null
          opening_hours?: Json | null
          delivery_available?: boolean
          delivery_radius_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          is_duty?: boolean
          duty_start_at?: string | null
          duty_end_at?: string | null
          opening_hours?: Json | null
          delivery_available?: boolean
          delivery_radius_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pharmacies_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      pharmacy_inventory: {
        Row: {
          id: string
          pharmacy_id: string
          medicine_id: string
          quantity: number
          unit_price: number | null
          expiry_date: string | null
          batch_number: string | null
          reorder_level: number
          is_available: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          pharmacy_id: string
          medicine_id: string
          quantity?: number
          unit_price?: number | null
          expiry_date?: string | null
          batch_number?: string | null
          reorder_level?: number
          is_available?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          pharmacy_id?: string
          medicine_id?: string
          quantity?: number
          unit_price?: number | null
          expiry_date?: string | null
          batch_number?: string | null
          reorder_level?: number
          is_available?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prescription_shares: {
        Row: {
          id: string
          prescription_id: string
          pharmacy_id: string
          share_code: string
          status: string
          shared_by: string
          shared_at: string
          valid_until: string | null
          accessed_at: string | null
          dispensed_at: string | null
          dispensed_by: string | null
        }
        Insert: {
          id?: string
          prescription_id: string
          pharmacy_id: string
          share_code: string
          status?: string
          shared_by: string
          shared_at?: string
          valid_until?: string | null
          accessed_at?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
        }
        Update: {
          id?: string
          prescription_id?: string
          pharmacy_id?: string
          share_code?: string
          status?: string
          shared_by?: string
          shared_at?: string
          valid_until?: string | null
          accessed_at?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
        }
        Relationships: []
      }
      pharmacy_reservations: {
        Row: {
          id: string
          reservation_code: string | null
          prescription_share_id: string | null
          pharmacy_id: string
          patient_id: string
          status: Database['public']['Enums']['reservation_status']
          pickup_type: string
          delivery_address: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          notes: string | null
          insurance_member_id: string | null
          coverage_request_id: string | null
          total_amount: number | null
          patient_amount: number | null
          insurance_amount: number | null
          payment_id: string | null
          withdrawal_code: string | null
          withdrawal_code_attempts: number
          withdrawal_code_locked_until: string | null
          dispensed_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_code?: string | null
          prescription_share_id?: string | null
          pharmacy_id: string
          patient_id: string
          status?: Database['public']['Enums']['reservation_status']
          pickup_type?: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          notes?: string | null
          insurance_member_id?: string | null
          coverage_request_id?: string | null
          total_amount?: number | null
          patient_amount?: number | null
          insurance_amount?: number | null
          payment_id?: string | null
          withdrawal_code?: string | null
          withdrawal_code_attempts?: number
          withdrawal_code_locked_until?: string | null
          dispensed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reservation_code?: string | null
          prescription_share_id?: string | null
          pharmacy_id?: string
          patient_id?: string
          status?: Database['public']['Enums']['reservation_status']
          pickup_type?: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          notes?: string | null
          insurance_member_id?: string | null
          coverage_request_id?: string | null
          total_amount?: number | null
          patient_amount?: number | null
          insurance_amount?: number | null
          payment_id?: string | null
          withdrawal_code?: string | null
          withdrawal_code_attempts?: number
          withdrawal_code_locked_until?: string | null
          dispensed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_items: {
        Row: {
          id: string
          reservation_id: string
          prescription_item_id: string | null
          medicine_id: string | null
          medicine_name: string
          quantity: number
          unit_price: number | null
          total_price: number | null
          insurance_coverage_rate: number | null
          insurance_amount: number | null
          patient_amount: number | null
          is_available: boolean
          unavailability_reason: string | null
        }
        Insert: {
          id?: string
          reservation_id: string
          prescription_item_id?: string | null
          medicine_id?: string | null
          medicine_name: string
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          insurance_coverage_rate?: number | null
          insurance_amount?: number | null
          patient_amount?: number | null
          is_available?: boolean
          unavailability_reason?: string | null
        }
        Update: {
          id?: string
          reservation_id?: string
          prescription_item_id?: string | null
          medicine_id?: string | null
          medicine_name?: string
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          insurance_coverage_rate?: number | null
          insurance_amount?: number | null
          patient_amount?: number | null
          is_available?: boolean
          unavailability_reason?: string | null
        }
        Relationships: []
      }
      insurance_providers: {
        Row: {
          id: string
          organization_id: string
          provider_type: string
          coverage_scope: string[] | null
          reimbursement_delay_days: number
          portal_url: string | null
          api_endpoint: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          provider_type?: string
          coverage_scope?: string[] | null
          reimbursement_delay_days?: number
          portal_url?: string | null
          api_endpoint?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider_type?: string
          coverage_scope?: string[] | null
          reimbursement_delay_days?: number
          portal_url?: string | null
          api_endpoint?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          owner_type: Database['public']['Enums']['document_owner_type']
          owner_id: string
          patient_id: string | null
          organization_id: string | null
          document_type: Database['public']['Enums']['document_type']
          storage_bucket: string
          file_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          visibility: Database['public']['Enums']['document_visibility']
          entity_type: string | null
          entity_id: string | null
          checksum: string | null
          created_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_type: Database['public']['Enums']['document_owner_type']
          owner_id: string
          patient_id?: string | null
          organization_id?: string | null
          document_type: Database['public']['Enums']['document_type']
          storage_bucket: string
          file_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          visibility?: Database['public']['Enums']['document_visibility']
          entity_type?: string | null
          entity_id?: string | null
          checksum?: string | null
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_type?: Database['public']['Enums']['document_owner_type']
          owner_id?: string
          patient_id?: string | null
          organization_id?: string | null
          document_type?: Database['public']['Enums']['document_type']
          storage_bucket?: string
          file_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          visibility?: Database['public']['Enums']['document_visibility']
          entity_type?: string | null
          entity_id?: string | null
          checksum?: string | null
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_members: {
        Row: {
          id: string
          insurance_provider_id: string
          organization_id: string
          patient_id: string | null
          beneficiary_id: string | null
          member_number: string
          holder_first_name: string
          holder_last_name: string
          holder_date_of_birth: string
          plan_name: string
          coverage_rate: number
          annual_ceiling: number
          ceiling_used: number
          coverage_start: string
          coverage_end: string | null
          status: Database['public']['Enums']['member_status']
          verified_at: string | null
          verified_by: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          insurance_provider_id: string
          organization_id: string
          patient_id?: string | null
          beneficiary_id?: string | null
          member_number: string
          holder_first_name: string
          holder_last_name: string
          holder_date_of_birth: string
          plan_name: string
          coverage_rate: number
          annual_ceiling: number
          ceiling_used?: number
          coverage_start: string
          coverage_end?: string | null
          status?: Database['public']['Enums']['member_status']
          verified_at?: string | null
          verified_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          insurance_provider_id?: string
          organization_id?: string
          patient_id?: string | null
          beneficiary_id?: string | null
          member_number?: string
          holder_first_name?: string
          holder_last_name?: string
          holder_date_of_birth?: string
          plan_name?: string
          coverage_rate?: number
          annual_ceiling?: number
          ceiling_used?: number
          coverage_start?: string
          coverage_end?: string | null
          status?: Database['public']['Enums']['member_status']
          verified_at?: string | null
          verified_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          id: string
          request_number: string | null
          reservation_id: string
          insurance_provider_id: string
          organization_id: string
          patient_id: string
          member_id: string
          requested_amount: number
          estimated_amount: number | null
          approved_amount: number | null
          patient_amount: number | null
          applied_rate: number | null
          ceiling_used: number
          status: Database['public']['Enums']['coverage_request_status']
          decision_reason: string | null
          info_request_message: string | null
          decided_by: string | null
          decided_at: string | null
          payment_id: string | null
          sla_due_at: string | null
          overdue: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_number?: string | null
          reservation_id: string
          insurance_provider_id: string
          organization_id: string
          patient_id: string
          member_id: string
          requested_amount: number
          estimated_amount?: number | null
          approved_amount?: number | null
          patient_amount?: number | null
          applied_rate?: number | null
          ceiling_used?: number
          status?: Database['public']['Enums']['coverage_request_status']
          decision_reason?: string | null
          info_request_message?: string | null
          decided_by?: string | null
          decided_at?: string | null
          payment_id?: string | null
          sla_due_at?: string | null
          overdue?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_number?: string | null
          reservation_id?: string
          insurance_provider_id?: string
          organization_id?: string
          patient_id?: string
          member_id?: string
          requested_amount?: number
          estimated_amount?: number | null
          approved_amount?: number | null
          patient_amount?: number | null
          applied_rate?: number | null
          ceiling_used?: number
          status?: Database['public']['Enums']['coverage_request_status']
          decision_reason?: string | null
          info_request_message?: string | null
          decided_by?: string | null
          decided_at?: string | null
          payment_id?: string | null
          sla_due_at?: string | null
          overdue?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          payment_number: string | null
          purpose: Database['public']['Enums']['payment_purpose']
          reservation_id: string | null
          appointment_id: string | null
          coverage_request_id: string | null
          subscription_id: string | null
          credit_pack_purchase_id: string | null
          payer_type: Database['public']['Enums']['payer_type'] | null
          payer_id: string
          recipient_type: Database['public']['Enums']['recipient_type'] | null
          recipient_id: string
          amount: number
          currency: string
          payment_method: Database['public']['Enums']['payment_method'] | null
          provider: Database['public']['Enums']['payment_provider']
          provider_transaction_id: string | null
          provider_checkout_url: string | null
          reference_code: string | null
          idempotency_key: string
          status: Database['public']['Enums']['payment_status']
          failure_code: string | null
          failure_message: string | null
          provider_fee: number
          paid_at: string | null
          expires_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_number?: string | null
          purpose: Database['public']['Enums']['payment_purpose']
          reservation_id?: string | null
          appointment_id?: string | null
          coverage_request_id?: string | null
          subscription_id?: string | null
          credit_pack_purchase_id?: string | null
          payer_type?: Database['public']['Enums']['payer_type'] | null
          payer_id: string
          recipient_type?: Database['public']['Enums']['recipient_type'] | null
          recipient_id: string
          amount: number
          currency?: string
          payment_method?: Database['public']['Enums']['payment_method'] | null
          provider: Database['public']['Enums']['payment_provider']
          provider_transaction_id?: string | null
          provider_checkout_url?: string | null
          reference_code?: string | null
          idempotency_key: string
          status?: Database['public']['Enums']['payment_status']
          failure_code?: string | null
          failure_message?: string | null
          provider_fee?: number
          paid_at?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payment_number?: string | null
          purpose?: Database['public']['Enums']['payment_purpose']
          reservation_id?: string | null
          appointment_id?: string | null
          coverage_request_id?: string | null
          subscription_id?: string | null
          credit_pack_purchase_id?: string | null
          payer_type?: Database['public']['Enums']['payer_type'] | null
          payer_id?: string
          recipient_type?: Database['public']['Enums']['recipient_type'] | null
          recipient_id?: string
          amount?: number
          currency?: string
          payment_method?: Database['public']['Enums']['payment_method'] | null
          provider?: Database['public']['Enums']['payment_provider']
          provider_transaction_id?: string | null
          provider_checkout_url?: string | null
          reference_code?: string | null
          idempotency_key?: string
          status?: Database['public']['Enums']['payment_status']
          failure_code?: string | null
          failure_message?: string | null
          provider_fee?: number
          paid_at?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string | null
          invoice_type: string
          reservation_id: string | null
          appointment_id: string | null
          subscription_id: string | null
          patient_id: string | null
          organization_id: string | null
          professional_id: string | null
          total_amount: number
          insurance_amount: number
          patient_amount: number
          tax_amount: number
          currency: string
          status: Database['public']['Enums']['invoice_status']
          pdf_document_id: string | null
          stripe_invoice_id: string | null
          issued_at: string | null
          due_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string | null
          invoice_type: string
          reservation_id?: string | null
          appointment_id?: string | null
          subscription_id?: string | null
          patient_id?: string | null
          organization_id?: string | null
          professional_id?: string | null
          total_amount: number
          insurance_amount?: number
          patient_amount?: number
          tax_amount?: number
          currency?: string
          status?: Database['public']['Enums']['invoice_status']
          pdf_document_id?: string | null
          stripe_invoice_id?: string | null
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string | null
          invoice_type?: string
          reservation_id?: string | null
          appointment_id?: string | null
          subscription_id?: string | null
          patient_id?: string | null
          organization_id?: string | null
          professional_id?: string | null
          total_amount?: number
          insurance_amount?: number
          patient_amount?: number
          tax_amount?: number
          currency?: string
          status?: Database['public']['Enums']['invoice_status']
          pdf_document_id?: string | null
          stripe_invoice_id?: string | null
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          code: Database['public']['Enums']['plan_code']
          name: string
          target_role: Database['public']['Enums']['user_role']
          price_monthly: number
          price_yearly: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          features: Json
          limits: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: Database['public']['Enums']['plan_code']
          name: string
          target_role: Database['public']['Enums']['user_role']
          price_monthly: number
          price_yearly: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          features?: Json
          limits?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: Database['public']['Enums']['plan_code']
          name?: string
          target_role?: Database['public']['Enums']['user_role']
          price_monthly?: number
          price_yearly?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          features?: Json
          limits?: Json
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string | null
          profile_id: string | null
          plan_id: string
          billing_cycle: string
          status: Database['public']['Enums']['subscription_status']
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          current_period_start: string
          current_period_end: string
          trial_end: string | null
          cancel_at_period_end: boolean
          cancelled_at: string | null
          founder_offer: boolean
          founder_offer_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          plan_id: string
          billing_cycle?: string
          status?: Database['public']['Enums']['subscription_status']
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          current_period_start: string
          current_period_end: string
          trial_end?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          founder_offer?: boolean
          founder_offer_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          plan_id?: string
          billing_cycle?: string
          status?: Database['public']['Enums']['subscription_status']
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          current_period_start?: string
          current_period_end?: string
          trial_end?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          founder_offer?: boolean
          founder_offer_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_packs: {
        Row: {
          id: string
          name: string
          credits: number
          price_xof: number
          stripe_price_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          credits: number
          price_xof: number
          stripe_price_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          credits?: number
          price_xof?: number
          stripe_price_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      ai_credit_accounts: {
        Row: {
          id: string
          organization_id: string | null
          profile_id: string | null
          balance: number
          lifetime_purchased: number
          lifetime_used: number
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          balance?: number
          lifetime_purchased?: number
          lifetime_used?: number
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          balance?: number
          lifetime_purchased?: number
          lifetime_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          id: string
          account_id: string
          profile_id: string | null
          feature: string
          entity_type: string | null
          entity_id: string | null
          tokens_in: number
          tokens_out: number
          credits_used: number
          model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          profile_id?: string | null
          feature: string
          entity_type?: string | null
          entity_id?: string | null
          tokens_in?: number
          tokens_out?: number
          credits_used: number
          model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          profile_id?: string | null
          feature?: string
          entity_type?: string | null
          entity_id?: string | null
          tokens_in?: number
          tokens_out?: number
          credits_used?: number
          model?: string | null
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          type: Database['public']['Enums']['notification_type']
          channel: Database['public']['Enums']['notification_channel']
          title: string
          body: string
          data: Json
          entity_type: string | null
          entity_id: string | null
          is_read: boolean
          read_at: string | null
          sent_at: string | null
          failed_at: string | null
          failure_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          type: Database['public']['Enums']['notification_type']
          channel: Database['public']['Enums']['notification_channel']
          title: string
          body: string
          data?: Json
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          sent_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          type?: Database['public']['Enums']['notification_type']
          channel?: Database['public']['Enums']['notification_channel']
          title?: string
          body?: string
          data?: Json
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          sent_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          profile_id: string
          token: string
          platform: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          token: string
          platform: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          token?: string
          platform?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          value: Json
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles_permissions: {
        Row: {
          id: string
          role: Database['public']['Enums']['user_role']
          permission: string
          enabled: boolean
        }
        Insert: {
          id?: string
          role: Database['public']['Enums']['user_role']
          permission: string
          enabled?: boolean
        }
        Update: {
          id?: string
          role?: Database['public']['Enums']['user_role']
          permission?: string
          enabled?: boolean
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          id: string
          subject_type: string
          subject_id: string
          submitted_by: string
          documents: string[] | null
          status: Database['public']['Enums']['verification_status']
          reviewed_by: string | null
          reviewed_at: string | null
          decision_reason: string | null
          requested_documents: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject_type: string
          subject_id: string
          submitted_by: string
          documents?: string[] | null
          status?: Database['public']['Enums']['verification_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          decision_reason?: string | null
          requested_documents?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject_type?: string
          subject_id?: string
          submitted_by?: string
          documents?: string[] | null
          status?: Database['public']['Enums']['verification_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          decision_reason?: string | null
          requested_documents?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          id: string
          slug: string
          title: string
          excerpt: string | null
          content_md: string | null
          cover_image_url: string | null
          author_name: string | null
          target_keyword: string | null
          secondary_keywords: string[] | null
          meta_title: string | null
          meta_description: string | null
          angle: string | null
          related_slugs: string[] | null
          published_at: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          excerpt?: string | null
          content_md?: string | null
          cover_image_url?: string | null
          author_name?: string | null
          target_keyword?: string | null
          secondary_keywords?: string[] | null
          meta_title?: string | null
          meta_description?: string | null
          angle?: string | null
          related_slugs?: string[] | null
          published_at?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          excerpt?: string | null
          content_md?: string | null
          cover_image_url?: string | null
          author_name?: string | null
          target_keyword?: string | null
          secondary_keywords?: string[] | null
          meta_title?: string | null
          meta_description?: string | null
          angle?: string | null
          related_slugs?: string[] | null
          published_at?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          id: string
          name: string
          email: string
          subject: string | null
          message: string
          status: string
          handled_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          subject?: string | null
          message: string
          status?: string
          handled_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          subject?: string | null
          message?: string
          status?: string
          handled_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cron_job_runs: {
        Row: {
          id: string
          job_name: string
          started_at: string
          finished_at: string | null
          status: string
          processed_count: number
          error_message: string | null
        }
        Insert: {
          id?: string
          job_name: string
          started_at?: string
          finished_at?: string | null
          status?: string
          processed_count?: number
          error_message?: string | null
        }
        Update: {
          id?: string
          job_name?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          processed_count?: number
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      user_role:
        | 'patient'
        | 'professional'
        | 'establishment_admin'
        | 'establishment_staff'
        | 'pharmacy_admin'
        | 'pharmacy_staff'
        | 'mutual_admin'
        | 'mutual_staff'
        | 'platform_admin'
        | 'super_admin'
      gender: 'male' | 'female' | 'other'
      medical_specialty:
        | 'general_medicine'
        | 'cardiology'
        | 'dermatology'
        | 'endocrinology'
        | 'gastroenterology'
        | 'gynecology'
        | 'hematology'
        | 'infectiology'
        | 'nephrology'
        | 'neurology'
        | 'oncology'
        | 'ophthalmology'
        | 'orthopedics'
        | 'otolaryngology'
        | 'pediatrics'
        | 'psychiatry'
        | 'pulmonology'
        | 'radiology'
        | 'rheumatology'
        | 'surgery'
        | 'urology'
        | 'dentistry'
        | 'physiotherapy'
        | 'nutrition'
        | 'other'
      appointment_type: 'in_person' | 'teleconsultation' | 'home_visit'
      appointment_status:
        | 'pending'
        | 'confirmed'
        | 'in_progress'
        | 'completed'
        | 'cancelled'
        | 'no_show'
      prescription_status: 'active' | 'dispensed' | 'expired' | 'cancelled'
      reservation_status:
        | 'pending'
        | 'accepted'
        | 'payment_requested'
        | 'payment_pending'
        | 'paid'
        | 'ready'
        | 'dispensed'
        | 'cancelled'
        | 'expired'
      verification_status: 'pending' | 'verified' | 'rejected' | 'suspended'
      organization_type:
        | 'clinic'
        | 'hospital'
        | 'pharmacy'
        | 'laboratory'
        | 'insurance'
        | 'mutual'
        | 'other'
      member_status: 'active' | 'inactive' | 'suspended' | 'to_verify'
      document_type:
        | 'prescription'
        | 'lab_result'
        | 'imaging'
        | 'report'
        | 'invoice'
        | 'identity'
        | 'license'
        | 'insurance_card'
        | 'other'
      document_owner_type: 'patient' | 'organization' | 'professional'
      document_visibility: 'private' | 'shared' | 'public'
      coverage_request_status:
        | 'pending'
        | 'info_requested'
        | 'approved'
        | 'partially_approved'
        | 'rejected'
        | 'paid'
      payment_purpose:
        | 'reservation'
        | 'appointment'
        | 'subscription'
        | 'credit_pack'
        | 'commission'
      payer_type: 'patient' | 'organization' | 'insurance'
      recipient_type: 'pharmacy' | 'professional' | 'organization' | 'platform'
      payment_method:
        | 'card'
        | 'wave'
        | 'orange_money'
        | 'bank_transfer'
        | 'cash'
      payment_provider: 'stripe' | 'wave' | 'orange_money' | 'manual'
      payment_status:
        | 'pending'
        | 'processing'
        | 'paid'
        | 'failed'
        | 'refunded'
        | 'cancelled'
      refund_status: 'requested' | 'approved' | 'processing' | 'completed' | 'rejected'
      invoice_status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue'
      payout_status: 'pending' | 'processing' | 'paid' | 'failed'
      plan_code: 'free' | 'starter' | 'pro' | 'enterprise'
      subscription_status:
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'cancelled'
        | 'expired'
      notification_type:
        | 'appointment_reminder'
        | 'appointment_confirmed'
        | 'appointment_cancelled'
        | 'prescription_ready'
        | 'reservation_update'
        | 'coverage_decision'
        | 'payment_received'
        | 'payment_failed'
        | 'subscription_renewal'
        | 'verification_update'
        | 'system'
      notification_channel: 'in_app' | 'push' | 'email' | 'sms' | 'whatsapp'
      deletion_request_status: 'requested' | 'processing' | 'completed' | 'rejected'
      reminder_target: 'payment' | 'coverage' | 'reservation'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never
