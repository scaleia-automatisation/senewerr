// AUTO-GENERATED — exécuter `npm run types:gen` pour regénérer depuis Supabase
// Ce fichier est un placeholder jusqu'à la connexion Supabase

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
          first_name: string | null
          last_name: string | null
          phone: string | null
          email: string | null
          avatar_url: string | null
          date_of_birth: string | null
          gender: 'f' | 'm' | 'other' | null
          address: string | null
          city: string | null
          region: string | null
          locale: string
          status: Database['public']['Enums']['account_status']
          two_factor_enabled: boolean
          last_login_at: string | null
          onboarding_completed_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      organizations: {
        Row: {
          id: string
          type: Database['public']['Enums']['organization_type']
          name: string
          slug: string | null
          status: Database['public']['Enums']['account_status']
          verification_status: Database['public']['Enums']['verification_status']
          city: string | null
          region: string | null
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          owner_profile_id: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      appointments: {
        Row: {
          id: string
          appointment_number: string | null
          patient_id: string
          professional_id: string
          establishment_id: string
          slot_id: string
          starts_at: string
          ends_at: string
          appointment_type: Database['public']['Enums']['appointment_type']
          reason: string | null
          status: Database['public']['Enums']['appointment_status']
          price: number
          payment_status: Database['public']['Enums']['patient_payment_status']
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'appointment_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
      }
      prescriptions: {
        Row: {
          id: string
          prescription_number: string | null
          patient_id: string
          professional_id: string
          consultation_id: string | null
          establishment_id: string | null
          signed_at: string | null
          valid_until: string | null
          status: Database['public']['Enums']['prescription_status']
          qr_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['prescriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['prescriptions']['Insert']>
      }
      pharmacy_reservations: {
        Row: {
          id: string
          reservation_number: string | null
          reservation_code: string
          patient_id: string
          pharmacy_id: string
          organization_id: string
          prescription_id: string | null
          subtotal: number
          total_amount: number
          patient_amount: number
          pharmacy_status: Database['public']['Enums']['pharmacy_status']
          prescription_check_status: Database['public']['Enums']['prescription_check_status']
          insurance_status: Database['public']['Enums']['insurance_status']
          patient_payment_status: Database['public']['Enums']['patient_payment_status']
          mutual_payment_status: Database['public']['Enums']['mutual_payment_status']
          preparation_status: Database['public']['Enums']['preparation_status']
          withdrawal_status: Database['public']['Enums']['withdrawal_status']
          status: Database['public']['Enums']['reservation_status']
          patient_label: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['pharmacy_reservations']['Row'], 'id' | 'reservation_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['pharmacy_reservations']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      emit_event: {
        Args: {
          p_type: string
          p_entity_type?: string
          p_entity_id?: string
          p_payload?: Json
        }
        Returns: string
      }
      audit: {
        Args: {
          p_action: string
          p_entity_type?: string
          p_entity_id?: string
          p_old?: Json
          p_new?: Json
          p_result?: string
          p_cause?: string
        }
        Returns: void
      }
    }
    Enums: {
      user_role: 'patient' | 'professional' | 'establishment_admin' | 'establishment_staff' | 'pharmacy_admin' | 'pharmacy_staff' | 'mutual_admin' | 'mutual_staff' | 'platform_admin' | 'super_admin'
      organization_type: 'establishment' | 'pharmacy' | 'insurance_provider'
      establishment_type: 'cabinet' | 'clinique' | 'hopital' | 'centre_medical' | 'laboratoire' | 'centre_imagerie'
      verification_status: 'pending' | 'verified' | 'rejected' | 'suspended'
      account_status: 'active' | 'suspended' | 'deleted'
      professional_type: 'medecin_generaliste' | 'medecin_specialiste' | 'chirurgien_dentiste' | 'sage_femme' | 'infirmier' | 'pharmacien' | 'autre'
      membership_role: 'owner' | 'admin' | 'staff'
      membership_status: 'invited' | 'active' | 'refused' | 'removed'
      appointment_type: 'in_person' | 'teleconsultation'
      appointment_status: 'requested' | 'confirmed' | 'payment_pending' | 'paid' | 'patient_arrived' | 'in_consultation' | 'completed' | 'rescheduled' | 'cancelled_patient' | 'cancelled_professional' | 'cancelled_establishment' | 'no_show'
      consultation_status: 'in_progress' | 'completed' | 'cancelled'
      prescription_status: 'draft' | 'issued' | 'signed' | 'available_patient' | 'shared_pharmacy' | 'under_pharmacy_review' | 'validated_pharmacy' | 'problem_reported' | 'expired' | 'used' | 'cancelled'
      pharmacy_status: 'pending' | 'confirmed' | 'refused'
      prescription_check_status: 'not_required' | 'pending' | 'validated' | 'rejected' | 'clarification_requested'
      insurance_status: 'none' | 'pending' | 'approved' | 'partially_approved' | 'rejected' | 'info_requested' | 'paid'
      patient_payment_status: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded'
      mutual_payment_status: 'not_required' | 'pending' | 'paid' | 'failed'
      preparation_status: 'not_started' | 'preparing' | 'ready'
      withdrawal_status: 'pending' | 'withdrawn'
      reservation_status: 'draft' | 'submitted' | 'pharmacy_review' | 'pharmacy_confirmed' | 'prescription_review' | 'insurance_pending' | 'insurance_validated' | 'insurance_refused' | 'patient_payment_pending' | 'patient_payment_received' | 'mutual_payment_pending' | 'mutual_payment_received' | 'fully_financed' | 'preparation' | 'ready' | 'withdrawal_pending' | 'withdrawn' | 'completed' | 'cancelled' | 'expired' | 'refund_pending' | 'refunded' | 'dispute'
      coverage_request_status: 'pending' | 'under_review' | 'approved' | 'partially_approved' | 'rejected' | 'info_requested' | 'payment_pending' | 'paid' | 'cancelled'
      payment_purpose: 'reservation_patient_share' | 'reservation_mutual_share' | 'appointment_fee' | 'subscription' | 'credit_pack' | 'extra_user'
      payment_method: 'card' | 'wave' | 'orange_money' | 'bank_transfer'
      payment_provider: 'stripe' | 'wave' | 'orange_money' | 'manual'
      payment_status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'under_review'
      document_type: 'ordonnance' | 'compte_rendu' | 'resultat' | 'facture' | 'recu' | 'justificatif' | 'certificat' | 'document_mutuelle' | 'autre'
      document_visibility: 'private' | 'shared_professional' | 'shared_pharmacy' | 'shared_mutual'
      health_record_type: 'allergie' | 'antecedent' | 'traitement' | 'vaccination' | 'note_medicale' | 'document'
      notification_channel: 'in_app' | 'email' | 'push' | 'sms' | 'whatsapp'
      notification_priority: 'low' | 'normal' | 'high' | 'critical'
      delivery_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped'
      dispute_category: 'paiement' | 'commande' | 'ordonnance' | 'rendez_vous' | 'mutuelle' | 'comportement' | 'autre'
      dispute_status: 'open' | 'under_review' | 'waiting_party' | 'resolved' | 'rejected' | 'closed'
      plan_code: 'patient_free' | 'pro_free' | 'pro_solo' | 'pro_pro' | 'pro_expert' | 'pharmacy_free' | 'pharmacy_start' | 'pharmacy_pro' | 'pharmacy_premium' | 'est_cabinet' | 'est_centre' | 'est_clinique' | 'est_clinique_plus' | 'mutual_start' | 'mutual_pro' | 'mutual_enterprise'
      billing_interval: 'monthly' | 'yearly'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused' | 'incomplete'
      ai_action: 'smart_search' | 'explain_document' | 'transcribe_consultation' | 'generate_report' | 'pre_consultation_summary' | 'admin_anomaly_report'
      actor_type: 'patient' | 'professional' | 'establishment' | 'pharmacy' | 'insurance_provider'
      member_status: 'to_verify' | 'verified' | 'rejected' | 'expired'
      payer_type: 'patient' | 'mutual' | 'organization'
      recipient_type: 'pharmacy' | 'professional' | 'establishment' | 'platform'
      share_status: 'active' | 'revoked' | 'expired' | 'consumed'
      availability_status: 'available' | 'low_stock' | 'unavailable'
      payout_status: 'pending' | 'scheduled' | 'paid' | 'failed'
      invoice_status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
      refund_status: 'requested' | 'approved' | 'processing' | 'completed' | 'failed' | 'rejected'
      deletion_request_status: 'requested' | 'processing' | 'anonymized' | 'rejected'
      schedule_recurrence: 'weekly' | 'once'
      exception_type: 'conge' | 'absence' | 'urgence' | 'deplacement' | 'fermeture' | 'remplacement' | 'garde' | 'journee_exceptionnelle'
      credit_transaction_type: 'plan_allocation' | 'pack_purchase' | 'consumption' | 'refund' | 'manual_adjustment' | 'expiration'
      ai_generation_status: 'started' | 'succeeded' | 'failed' | 'refunded'
      consent_type: 'cgu' | 'privacy' | 'health_data_processing' | 'prescription_share' | 'professional_record_access' | 'marketing'
      document_owner_type: 'patient' | 'beneficiary' | 'professional' | 'organization'
      schedule_proposal_status: 'proposed' | 'accepted' | 'refused' | 'withdrawn'
      reminder_target: 'patient_payment' | 'mutual_payment' | 'mutual_coverage' | 'professional_verification' | 'pharmacy_verification'
    }
  }
}
