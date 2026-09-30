-- ─── Acteurs ───────────────────────────────────────────────────────────────
create type actor_type as enum (
  'patient', 'sante', 'pharmacie', 'couverture', 'admin', 'super_admin'
);

-- ─── Statut de compte ──────────────────────────────────────────────────────
create type account_status as enum (
  'draft', 'pending', 'needs_info', 'verified', 'refused', 'suspended', 'disabled'
);

-- ─── Professionnel de santé ────────────────────────────────────────────────
create type professional_type as enum (
  'medecin_generaliste', 'medecin_specialiste', 'chirurgien_dentiste',
  'sage_femme', 'infirmier', 'paramedicale', 'autre'
);

-- ─── Établissement ─────────────────────────────────────────────────────────
create type establishment_category as enum ('public', 'prive', 'specialise');

create type establishment_type as enum (
  'case_sante', 'poste_sante', 'centre_sante_cs1', 'centre_sante_cs2',
  'hopital_eps1', 'hopital_eps2', 'hopital_eps3',
  'clinique', 'cabinet_medical', 'cabinet_paramedical',
  'poste_sante_prive', 'structure_entreprise', 'dispensaire_prive',
  'laboratoire', 'centre_radiologie', 'centre_sante_mentale',
  'centre_reeducation', 'centre_transfusion', 'autre_specialise'
);

-- ─── Organisme de couverture ───────────────────────────────────────────────
create type coverage_org_type as enum (
  'mutuelle_communautaire', 'msae', 'mutuelle_professionnelle', 'ipm', 'assurance_privee'
);

-- ─── Pharmacie abonnement ──────────────────────────────────────────────────
create type pharmacy_plan as enum ('decouverte', 'start', 'pro', 'premium');

-- ─── Professionnel abonnement ──────────────────────────────────────────────
create type professional_plan as enum ('essentiel', 'pro', 'premium');

-- ─── Établissement abonnement ─────────────────────────────────────────────
create type establishment_plan as enum ('cabinet', 'clinique', 'hopital', 'sur_devis');

-- ─── Rendez-vous ───────────────────────────────────────────────────────────
create type appointment_status as enum (
  'pending', 'confirmed', 'arrived', 'in_consultation',
  'completed', 'cancelled', 'rescheduled', 'no_show'
);

create type appointment_type as enum ('in_person', 'teleconsultation');

-- ─── Consultation ──────────────────────────────────────────────────────────
create type consultation_status as enum (
  'opened', 'in_progress', 'completed', 'cancelled'
);

-- ─── Ordonnance ────────────────────────────────────────────────────────────
create type prescription_status as enum (
  'draft', 'issued', 'shared', 'verifying', 'validated', 'refused', 'expired', 'used'
);

-- ─── Réservation pharmacie ────────────────────────────────────────────────
create type reservation_status as enum (
  'new', 'verifying', 'awaiting_coverage', 'awaiting_payment',
  'funded', 'to_prepare', 'preparing', 'ready', 'collected',
  'refused', 'cancelled', 'expired'
);

-- ─── Prise en charge ───────────────────────────────────────────────────────
create type coverage_request_status as enum (
  'pending', 'needs_info', 'approved', 'refused', 'cancelled'
);

-- ─── Paiement ──────────────────────────────────────────────────────────────
create type payment_status as enum (
  'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
);

create type payment_method as enum (
  'orange_money', 'wave', 'stripe', 'cash', 'bank_transfer'
);

create type payment_actor as enum ('patient', 'coverage_org', 'internal');

-- ─── Notifications ─────────────────────────────────────────────────────────
create type notification_type as enum (
  'appointment_confirmed', 'appointment_reminder', 'appointment_modified',
  'appointment_cancelled', 'patient_arrived',
  'prescription_available', 'prescription_shared',
  'reservation_confirmed', 'reservation_ready', 'reservation_expired',
  'reservation_refused', 'pickup_reminder',
  'coverage_validated', 'coverage_refused', 'coverage_info_requested',
  'payment_confirmed', 'payment_failed', 'payment_refunded',
  'account_validated', 'account_refused', 'account_needs_info',
  'subscription_renewal', 'subscription_expired',
  'document_available', 'litige_opened', 'litige_resolved'
);

create type notification_channel as enum ('in_app', 'email', 'sms', 'whatsapp', 'push');

-- ─── Documents ─────────────────────────────────────────────────────────────
create type document_type as enum (
  'prescription', 'consultation_report', 'exam_request', 'exam_result',
  'invoice', 'receipt', 'coverage_decision', 'coverage_contract',
  'identity', 'professional_license', 'administrative', 'other'
);

-- ─── Litiges ───────────────────────────────────────────────────────────────
create type litige_status as enum (
  'new', 'in_progress', 'needs_info', 'resolved', 'closed'
);

-- ─── Événements ────────────────────────────────────────────────────────────
create type event_type as enum (
  'appointment_created', 'appointment_updated', 'appointment_cancelled',
  'consultation_started', 'consultation_completed',
  'prescription_created', 'prescription_shared',
  'reservation_created', 'reservation_confirmed', 'reservation_refused',
  'reservation_paid', 'reservation_ready', 'reservation_collected',
  'coverage_requested', 'coverage_approved', 'coverage_refused',
  'payment_created', 'payment_completed', 'payment_failed',
  'account_created', 'account_verified', 'account_suspended',
  'document_uploaded', 'document_shared'
);

-- ─── Membres de famille ────────────────────────────────────────────────────
create type beneficiary_relationship as enum (
  'child', 'spouse', 'parent', 'sibling', 'other'
);

-- ─── Langue ────────────────────────────────────────────────────────────────
create type app_locale as enum ('fr', 'wo', 'en');
