-- Migration 0018: BLOC 4 — idempotent additions
-- Inspected actual schema before writing; only ai_usage is brand-new.

-- ── 1. ai_usage (new table) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  feature      text NOT NULL CHECK (feature IN (
                 'smart_search','explain_document','transcribe_consultation',
                 'generate_report','pre_consultation_summary','anomaly_report')),
  credits_used integer DEFAULT 0,
  tokens_in    integer,
  tokens_out   integer,
  model        text,
  duration_ms  integer,
  created_at   timestamptz DEFAULT now()
);

-- ── 2. security_events — add BLOC-4 columns to existing table ────────────────
-- Existing cols: id, event_type, user_id, ip_address, user_agent, details, severity, created_at
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS type        text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS entity_id   uuid;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS actor_id    uuid REFERENCES public.profiles(id);

-- ── 3. email_logs — add BLOC-4 columns to existing table ────────────────────
-- Existing cols: id, user_id, to_email, template_key, sequence_key, resend_message_id,
--               status, error_message, opened_at, clicked_at, sent_at, created_at
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS profile_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS email_type    text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sequence_step integer DEFAULT 0;

-- ── 4. schedule_proposals — add missing columns ──────────────────────────────
-- Existing cols: id, establishment_id, professional_id, proposed_by, slots,
--               message, status, responded_at, refusal_reason, created_at, updated_at
ALTER TABLE public.schedule_proposals ADD COLUMN IF NOT EXISTS current_schedule_data  jsonb;
ALTER TABLE public.schedule_proposals ADD COLUMN IF NOT EXISTS proposed_schedule_data jsonb;
ALTER TABLE public.schedule_proposals ADD COLUMN IF NOT EXISTS response_message       text;

-- ── 5. documents — add missing columns ──────────────────────────────────────
-- Existing: created_by already exists; missing content_text, document_date
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content_text  text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_date date;

-- ── 6. prescription_access_logs — add missing columns ───────────────────────
-- Existing: id, prescription_id, user_id, user_role, organization_id,
--           access_type, ip_address, user_agent, created_at
ALTER TABLE public.prescription_access_logs ADD COLUMN IF NOT EXISTS action     text;
ALTER TABLE public.prescription_access_logs ADD COLUMN IF NOT EXISTS actor_id   uuid REFERENCES public.profiles(id);
ALTER TABLE public.prescription_access_logs ADD COLUMN IF NOT EXISTS pharmacy_id uuid;

-- ── 7. usage_events — add missing columns ───────────────────────────────────
-- Existing: id, organization_id, profile_id, feature_key, quantity, period_month, entity_id, created_at
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS patient_id      uuid REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS feature         text;

-- ── 8. consents — add missing columns ───────────────────────────────────────
-- Existing: id, profile_id, consent_type, granted, version, entity_type,
--           entity_id, purpose, granted_with_organization_id, valid_until,
--           ip_address, user_agent, created_at
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS type           text;
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS patient_id     uuid REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS reference_id   uuid;
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS given_at       timestamptz DEFAULT now();

-- ── 9. commission_entries — add missing amount column ───────────────────────
-- Existing: id, reservation_id, organization_id, plan_code, gross_amount,
--           rate, cap, commission_amount, net_amount, payout_id, created_at
ALTER TABLE public.commission_entries ADD COLUMN IF NOT EXISTS amount integer;

-- ── 10. pharmacy_reservations, coverage_requests, prescriptions, prescription_shares,
--        patient_professional_access — all required columns already exist, no-op.

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_usage_profile       ON public.ai_usage(profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_entity ON public.security_events(entity_id, type);
CREATE INDEX IF NOT EXISTS idx_email_logs_profile     ON public.email_logs(profile_id, email_type, sequence_step);
CREATE INDEX IF NOT EXISTS idx_pshares_prescription   ON public.prescription_shares(prescription_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_pro       ON public.usage_events(professional_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_ppa_patient            ON public.patient_professional_access(patient_id, professional_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_professional_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

-- ── RLS policies (idempotent via DO block) ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_usage' AND policyname='ai_usage_own') THEN
    CREATE POLICY "ai_usage_own" ON public.ai_usage FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='email_logs_platform') THEN
    CREATE POLICY "email_logs_platform" ON public.email_logs FOR ALL
      USING (private.is_platform());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_events' AND policyname='security_events_platform') THEN
    CREATE POLICY "security_events_platform" ON public.security_events FOR ALL
      USING (private.is_platform());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prescription_shares' AND policyname='pshares_patient') THEN
    CREATE POLICY "pshares_patient" ON public.prescription_shares FOR SELECT
      USING (patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='consents' AND policyname='consents_own') THEN
    CREATE POLICY "consents_own" ON public.consents FOR SELECT
      USING (patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_professional_access' AND policyname='ppa_patient_view') THEN
    CREATE POLICY "ppa_patient_view" ON public.patient_professional_access FOR SELECT
      USING (
        patient_id      IN (SELECT id FROM public.patients      WHERE profile_id = auth.uid())
        OR professional_id IN (SELECT id FROM public.professionals WHERE profile_id = auth.uid())
      );
  END IF;
END $$;
