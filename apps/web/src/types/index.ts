// ─── Acteurs ───────────────────────────────────────────────────────────────
export type ActorType = 'patient' | 'sante' | 'pharmacie' | 'couverture' | 'admin' | 'super_admin'
export type Locale = 'fr' | 'wo' | 'en'

// ─── Profil utilisateur ────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  /** id === auth.users.id — pas de colonne user_id séparée */
  actor_type: ActorType
  first_name: string
  last_name: string
  phone: string
  email?: string
  avatar_url?: string
  preferred_locale?: Locale
  account_status: AccountStatus
  verified_at?: string
  created_at: string
  updated_at: string
}

export type AccountStatus =
  | 'draft'
  | 'pending'
  | 'needs_info'
  | 'verified'
  | 'refused'
  | 'suspended'
  | 'disabled'

// ─── Patient ───────────────────────────────────────────────────────────────
export interface Patient {
  id: string
  profile_id: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  blood_group?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
  weight_kg?: number
  height_cm?: number
  allergies?: string[]
  chronic_conditions?: string[]
  emergency_contact_name?: string
  emergency_contact_phone?: string
  address_region?: string
  address_department?: string
  address_commune?: string
  address_details?: string
  nin?: string
  cmu_number?: string
  created_at: string
  updated_at: string
}

export interface PatientBeneficiary {
  id: string
  patient_id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  relationship: 'child' | 'spouse' | 'parent' | 'sibling' | 'other'
  gender?: 'male' | 'female' | 'other'
  blood_group?: string
  allergies?: string[]
  chronic_conditions?: string[]
  nin?: string
  cmu_number?: string
  created_at: string
  updated_at: string
}

// ─── Professionnel de santé ────────────────────────────────────────────────
export type ProfessionalType =
  | 'medecin_generaliste'
  | 'medecin_specialiste'
  | 'chirurgien_dentiste'
  | 'sage_femme'
  | 'infirmier'
  | 'paramedicale'
  | 'autre'

export type ProfessionalPlan = 'essentiel' | 'pro' | 'premium'

export interface Professional {
  id: string
  profile_id: string
  professional_type: ProfessionalType
  specialty?: string
  title?: string
  ordre_number?: string
  bio?: string
  languages_spoken?: string[]
  consultation_fee_fcfa?: number
  teleconsultation_fee_fcfa?: number
  teleconsultation_enabled: boolean
  home_visit_enabled: boolean
  home_visit_fee_fcfa?: number
  address_region?: string
  address_commune?: string
  plan: ProfessionalPlan
  created_at: string
  updated_at: string
}

// ─── Établissement ─────────────────────────────────────────────────────────
export type EstablishmentCategory = 'public' | 'prive' | 'specialise'
export type EstablishmentType =
  | 'case_sante' | 'poste_sante' | 'centre_sante_cs1' | 'centre_sante_cs2'
  | 'hopital_eps1' | 'hopital_eps2' | 'hopital_eps3'
  | 'clinique' | 'cabinet_medical' | 'cabinet_paramedical'
  | 'poste_sante_prive' | 'structure_entreprise' | 'dispensaire_prive'
  | 'laboratoire' | 'centre_radiologie' | 'centre_sante_mentale'
  | 'centre_reeducation' | 'centre_transfusion' | 'autre_specialise'

export type EstablishmentPlan = 'cabinet' | 'clinique' | 'hopital' | 'sur_devis'

export interface Establishment {
  id: string
  profile_id: string
  name: string
  category: EstablishmentCategory
  establishment_type: EstablishmentType
  registration_number?: string
  description?: string
  phone?: string
  email?: string
  address_region: string
  address_department?: string
  address_commune?: string
  address_details?: string
  opening_hours?: Record<string, { open: string; close: string }>
  emergency_available: boolean
  plan: EstablishmentPlan
  created_at: string
  updated_at: string
}

// ─── Pharmacie ─────────────────────────────────────────────────────────────
export type PharmacyPlan = 'decouverte' | 'start' | 'pro' | 'premium'

export interface Pharmacy {
  id: string
  profile_id: string
  name: string
  ordre_number?: string
  description?: string
  phone?: string
  email?: string
  address_region: string
  address_department?: string
  address_commune?: string
  address_details?: string
  delivery_available: boolean
  delivery_fee_fcfa?: number
  opening_hours?: Record<string, { open: string; close: string }>
  plan: PharmacyPlan
  commission_rate_percent: number
  created_at: string
  updated_at: string
}

// ─── Couverture santé ──────────────────────────────────────────────────────
export type CoverageOrgType =
  | 'mutuelle_communautaire'
  | 'msae'
  | 'mutuelle_professionnelle'
  | 'ipm'
  | 'assurance_privee'

export interface CoverageOrg {
  id: string
  profile_id: string
  org_type: CoverageOrgType
  name: string
  registration_number?: string
  description?: string
  address_region?: string
  address_details?: string
  phone?: string
  email?: string
  website?: string
  created_at: string
  updated_at: string
}

// ─── Rendez-vous ───────────────────────────────────────────────────────────
export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'arrived' | 'in_consultation'
  | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'

export type AppointmentType = 'in_person' | 'teleconsultation'

export interface Appointment {
  id: string
  schedule_id: string
  professional_id?: string
  establishment_id?: string
  service_id?: string
  patient_id: string
  beneficiary_id?: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  appointment_date: string
  start_time: string
  end_time: string
  duration_min?: number
  reason?: string
  notes?: string
  teleconsult_room_url?: string
  cancelled_at?: string
  cancel_reason?: string
  created_at: string
  updated_at: string
}

// ─── Ordonnance ────────────────────────────────────────────────────────────
export type PrescriptionStatus =
  | 'draft' | 'issued' | 'shared' | 'verifying'
  | 'validated' | 'refused' | 'expired' | 'used'

export interface Prescription {
  id: string
  consultation_id?: string
  professional_id: string
  patient_id: string
  beneficiary_id?: string
  status: PrescriptionStatus
  issued_at?: string
  expires_at?: string
  notes?: string
  qr_code?: string
  share_token?: string
  created_at: string
  updated_at: string
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  medication_name: string
  dci?: string
  dosage?: string
  form?: string
  frequency?: string
  duration?: string
  quantity?: number
  instructions?: string
  is_substitutable: boolean
  created_at: string
}

// ─── Médicament / Réservation ──────────────────────────────────────────────
export type ReservationStatus =
  | 'new' | 'verifying' | 'awaiting_coverage' | 'awaiting_payment'
  | 'funded' | 'to_prepare' | 'preparing' | 'ready' | 'collected'
  | 'refused' | 'cancelled' | 'expired'

export interface PharmacyReservation {
  id: string
  pharmacy_id: string
  patient_id: string
  beneficiary_id?: string
  prescription_id?: string
  coverage_request_id?: string
  status: ReservationStatus
  pickup_code: string
  expiry_at: string
  has_paid: boolean
  total_amount_fcfa: number
  patient_share_fcfa?: number
  coverage_share_fcfa?: number
  notes?: string
  refused_reason?: string
  confirmed_at?: string
  ready_at?: string
  collected_at?: string
  created_at: string
  updated_at: string
}

// ─── Couverture / Prise en charge ──────────────────────────────────────────
export type CoverageRequestStatus =
  | 'pending' | 'needs_info' | 'approved' | 'refused' | 'cancelled'

export interface CoverageRequest {
  id: string
  coverage_member_id: string
  coverage_org_id: string
  plan_id?: string
  patient_id?: string
  beneficiary_id?: string
  prescription_id?: string
  reservation_id?: string
  appointment_id?: string
  request_type?: 'pharmacy' | 'consultation' | 'exam' | 'hospitalization' | 'other'
  status: CoverageRequestStatus
  total_amount_fcfa?: number
  coverage_percent?: number
  coverage_amount_fcfa?: number
  patient_amount_fcfa?: number
  reason?: string
  admin_notes?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

// ─── Paiement ──────────────────────────────────────────────────────────────
export type PaymentStatus =
  | 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled'

export type PaymentMethod = 'orange_money' | 'wave' | 'stripe' | 'cash' | 'bank_transfer'

export interface Payment {
  id: string
  reference: string
  payer_id: string
  amount_fcfa: number
  fee_fcfa: number
  net_amount_fcfa: number
  method: PaymentMethod
  status: PaymentStatus
  description?: string
  reservation_id?: string
  appointment_id?: string
  provider_reference?: string
  initiated_at: string
  completed_at?: string
  failed_at?: string
  failure_reason?: string
  created_at: string
  updated_at: string
}

// ─── Notification ──────────────────────────────────────────────────────────
export type NotificationType =
  | 'appointment_confirmed' | 'appointment_reminder' | 'appointment_modified'
  | 'appointment_cancelled' | 'patient_arrived'
  | 'prescription_available' | 'prescription_shared'
  | 'reservation_confirmed' | 'reservation_ready' | 'reservation_expired'
  | 'reservation_refused' | 'pickup_reminder'
  | 'coverage_validated' | 'coverage_refused' | 'coverage_info_requested'
  | 'payment_confirmed' | 'payment_failed' | 'payment_refunded'
  | 'account_validated' | 'account_refused' | 'account_needs_info'
  | 'subscription_renewal' | 'subscription_expired'
  | 'document_available' | 'litige_opened' | 'litige_resolved'

export interface Notification {
  id: string
  recipient_id: string
  notification_type: NotificationType
  title: string
  body: string
  is_read: boolean
  read_at?: string
  data?: Record<string, unknown>
  reference_type?: string
  reference_id?: string
  created_at: string
}

// ─── Document ──────────────────────────────────────────────────────────────
export type DocumentType =
  | 'prescription' | 'consultation_report' | 'exam_request' | 'exam_result'
  | 'invoice' | 'receipt' | 'coverage_decision' | 'coverage_contract'
  | 'identity' | 'professional_license' | 'administrative' | 'other'

export interface Document {
  id: string
  owner_id: string
  patient_id?: string
  beneficiary_id?: string
  document_type: DocumentType
  title: string
  description?: string
  file_url: string
  file_size_bytes?: number
  mime_type?: string
  is_shared: boolean
  shared_with?: string[]
  expires_at?: string
  created_at: string
  updated_at: string
}
