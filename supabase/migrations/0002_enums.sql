-- ============================================================
-- 0002_enums.sql — Enums Postgres (source de vérité unique)
-- ============================================================

CREATE TYPE public.user_role AS ENUM (
  'patient','professional','establishment_admin','establishment_staff',
  'pharmacy_admin','pharmacy_staff','mutual_admin','mutual_staff',
  'platform_admin','super_admin'
);

CREATE TYPE public.organization_type AS ENUM (
  'establishment','pharmacy','insurance_provider'
);

CREATE TYPE public.establishment_type AS ENUM (
  'cabinet','clinique','hopital','centre_medical','laboratoire','centre_imagerie'
);

CREATE TYPE public.verification_status AS ENUM (
  'pending','verified','rejected','suspended'
);

CREATE TYPE public.account_status AS ENUM (
  'active','suspended','deleted'
);

CREATE TYPE public.professional_type AS ENUM (
  'medecin_generaliste','medecin_specialiste','chirurgien_dentiste',
  'sage_femme','infirmier','pharmacien','autre'
);

CREATE TYPE public.membership_role AS ENUM (
  'owner','admin','staff'
);

CREATE TYPE public.membership_status AS ENUM (
  'invited','active','refused','removed'
);

CREATE TYPE public.schedule_recurrence AS ENUM (
  'weekly','once'
);

CREATE TYPE public.schedule_proposal_status AS ENUM (
  'proposed','accepted','refused','withdrawn'
);

CREATE TYPE public.exception_type AS ENUM (
  'conge','absence','urgence','deplacement','fermeture',
  'remplacement','garde','journee_exceptionnelle'
);

CREATE TYPE public.appointment_type AS ENUM (
  'in_person','teleconsultation'
);

CREATE TYPE public.appointment_status AS ENUM (
  'requested','confirmed','payment_pending','paid','patient_arrived',
  'in_consultation','completed','rescheduled',
  'cancelled_patient','cancelled_professional','cancelled_establishment','no_show'
);

CREATE TYPE public.consultation_status AS ENUM (
  'in_progress','completed','cancelled'
);

CREATE TYPE public.prescription_status AS ENUM (
  'draft','issued','signed','available_patient','shared_pharmacy',
  'under_pharmacy_review','validated_pharmacy','problem_reported',
  'expired','used','cancelled'
);

CREATE TYPE public.prescription_access_type AS ENUM (
  'viewed','downloaded','shared','printed','validated','problem_reported','revoked'
);

CREATE TYPE public.share_status AS ENUM (
  'active','revoked','expired','consumed'
);

CREATE TYPE public.availability_status AS ENUM (
  'available','low_stock','unavailable'
);

CREATE TYPE public.pharmacy_status AS ENUM (
  'pending','confirmed','refused'
);

CREATE TYPE public.prescription_check_status AS ENUM (
  'not_required','pending','validated','rejected','clarification_requested'
);

CREATE TYPE public.insurance_status AS ENUM (
  'none','pending','approved','partially_approved','rejected','info_requested','paid'
);

CREATE TYPE public.patient_payment_status AS ENUM (
  'not_required','pending','paid','failed','refunded'
);

CREATE TYPE public.mutual_payment_status AS ENUM (
  'not_required','pending','paid','failed'
);

CREATE TYPE public.preparation_status AS ENUM (
  'not_started','preparing','ready'
);

CREATE TYPE public.withdrawal_status AS ENUM (
  'pending','withdrawn'
);

CREATE TYPE public.reservation_status AS ENUM (
  'draft','submitted','pharmacy_review','pharmacy_confirmed',
  'prescription_review','insurance_pending','insurance_validated','insurance_refused',
  'patient_payment_pending','patient_payment_received',
  'mutual_payment_pending','mutual_payment_received','fully_financed',
  'preparation','ready','withdrawal_pending','withdrawn','completed',
  'cancelled','expired','refund_pending','refunded','dispute'
);

CREATE TYPE public.coverage_request_status AS ENUM (
  'pending','under_review','approved','partially_approved','rejected',
  'info_requested','payment_pending','paid','cancelled'
);

CREATE TYPE public.member_status AS ENUM (
  'to_verify','verified','rejected','expired'
);

CREATE TYPE public.payer_type AS ENUM (
  'patient','mutual','organization'
);

CREATE TYPE public.recipient_type AS ENUM (
  'pharmacy','professional','establishment','platform'
);

CREATE TYPE public.payment_purpose AS ENUM (
  'reservation_patient_share','reservation_mutual_share','appointment_fee',
  'subscription','credit_pack','extra_user'
);

CREATE TYPE public.payment_method AS ENUM (
  'card','wave','orange_money','bank_transfer'
);

CREATE TYPE public.payment_provider AS ENUM (
  'stripe','wave','orange_money','manual'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending','processing','paid','failed','cancelled',
  'refunded','partially_refunded','under_review'
);

CREATE TYPE public.refund_status AS ENUM (
  'requested','approved','processing','completed','failed','rejected'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft','issued','paid','overdue','cancelled'
);

CREATE TYPE public.payout_status AS ENUM (
  'pending','scheduled','paid','failed'
);

CREATE TYPE public.document_type AS ENUM (
  'ordonnance','compte_rendu','resultat','facture','recu',
  'justificatif','certificat','document_mutuelle','autre'
);

CREATE TYPE public.document_owner_type AS ENUM (
  'patient','beneficiary','professional','organization'
);

CREATE TYPE public.document_visibility AS ENUM (
  'private','shared_professional','shared_pharmacy','shared_mutual'
);

CREATE TYPE public.health_record_type AS ENUM (
  'allergie','antecedent','traitement','vaccination','note_medicale','document'
);

CREATE TYPE public.notification_channel AS ENUM (
  'in_app','email','push','sms','whatsapp'
);

CREATE TYPE public.notification_priority AS ENUM (
  'low','normal','high','critical'
);

CREATE TYPE public.delivery_status AS ENUM (
  'queued','sent','delivered','failed','skipped'
);

CREATE TYPE public.dispute_category AS ENUM (
  'paiement','commande','ordonnance','rendez_vous','mutuelle','comportement','autre'
);

CREATE TYPE public.dispute_status AS ENUM (
  'open','under_review','waiting_party','resolved','rejected','closed'
);

CREATE TYPE public.actor_type AS ENUM (
  'patient','professional','establishment','pharmacy','insurance_provider'
);

CREATE TYPE public.plan_code AS ENUM (
  'patient_free','pro_free','pro_solo','pro_pro','pro_expert',
  'pharmacy_free','pharmacy_start','pharmacy_pro','pharmacy_premium',
  'est_cabinet','est_centre','est_clinique','est_clinique_plus',
  'mutual_start','mutual_pro','mutual_enterprise'
);

CREATE TYPE public.billing_interval AS ENUM (
  'monthly','yearly'
);

CREATE TYPE public.subscription_status AS ENUM (
  'trialing','active','past_due','cancelled','paused','incomplete'
);

CREATE TYPE public.credit_transaction_type AS ENUM (
  'plan_allocation','pack_purchase','consumption','refund','manual_adjustment','expiration'
);

CREATE TYPE public.ai_action AS ENUM (
  'smart_search','explain_document','transcribe_consultation',
  'generate_report','pre_consultation_summary','admin_anomaly_report'
);

CREATE TYPE public.ai_generation_status AS ENUM (
  'started','succeeded','failed','refunded'
);

CREATE TYPE public.consent_type AS ENUM (
  'cgu','privacy','health_data_processing','prescription_share',
  'professional_record_access','marketing'
);

CREATE TYPE public.reminder_target AS ENUM (
  'patient_payment','mutual_payment','mutual_coverage',
  'professional_verification','pharmacy_verification'
);

CREATE TYPE public.deletion_request_status AS ENUM (
  'requested','processing','anonymized','rejected'
);
