-- Migration 0018: BLOC 4 missing tables

-- Table for AI usage tracking
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  feature       text NOT NULL CHECK (feature IN ('smart_search','explain_document','transcribe_consultation','generate_report','pre_consultation_summary','anomaly_report')),
  credits_used  integer DEFAULT 0,
  tokens_in     integer,
  tokens_out    integer,
  model         text,
  duration_ms   integer,
  created_at    timestamptz DEFAULT now()
);

-- Table for security events (withdrawal failures, etc.)
CREATE TABLE IF NOT EXISTS public.security_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
-- Add columns to security_events that may be missing if table pre-existed
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS type        text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS entity_id   uuid;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS actor_id    uuid REFERENCES public.profiles(id);
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS details     jsonb;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Table for email sequence tracking (prevent duplicate sends)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  email_type     text NOT NULL,
  sequence_step  integer DEFAULT 0,
  sent_at        timestamptz DEFAULT now()
);

-- Table for schedule proposals
CREATE TABLE IF NOT EXISTS public.schedule_proposals (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id        uuid REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  establishment_id       uuid REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  proposed_by            uuid REFERENCES public.profiles(id) NOT NULL,
  current_schedule_data  jsonb,
  proposed_schedule_data jsonb NOT NULL,
  message                text,
  status                 text DEFAULT 'pending' CHECK (status IN ('pending','accepted','refused')),
  response_message       text,
  responded_at           timestamptz,
  created_at             timestamptz DEFAULT now()
);

-- Add missing columns to pharmacy_reservations if not already there
ALTER TABLE public.pharmacy_reservations
  ADD COLUMN IF NOT EXISTS withdrawal_status         text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS withdrawn_at              timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_failed_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_locked_until   timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at              timestamptz,
  ADD COLUMN IF NOT EXISTS pharmacy_refusal_reason   text,
  ADD COLUMN IF NOT EXISTS preparation_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS mutual_payment_status     text DEFAULT 'not_required';

-- Add missing columns to coverage_requests if not already there
ALTER TABLE public.coverage_requests
  ADD COLUMN IF NOT EXISTS approved_amount       integer,
  ADD COLUMN IF NOT EXISTS applied_rate          numeric(5,2),
  ADD COLUMN IF NOT EXISTS decision_reason       text,
  ADD COLUMN IF NOT EXISTS info_request_message  text,
  ADD COLUMN IF NOT EXISTS decided_by            uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS decided_at            timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at            timestamptz;

-- Add missing columns to documents if not already there
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_text   text,
  ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS document_date  date;

-- Add missing columns to prescriptions if not already there
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS issued_at            timestamptz,
  ADD COLUMN IF NOT EXISTS signature_hash       text,
  ADD COLUMN IF NOT EXISTS prescription_number  text;

-- prescription_shares table if missing
CREATE TABLE IF NOT EXISTS public.prescription_shares (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  patient_id      uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  pharmacy_id     uuid REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  shared_by       uuid REFERENCES public.profiles(id) NOT NULL,
  status          text DEFAULT 'active' CHECK (status IN ('active','expired','consumed','revoked')),
  valid_until     timestamptz NOT NULL,
  reservation_id  uuid,
  purpose         text DEFAULT 'reservation',
  created_at      timestamptz DEFAULT now()
);

-- prescription_access_logs
CREATE TABLE IF NOT EXISTS public.prescription_access_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  action          text NOT NULL,
  actor_id        uuid REFERENCES public.profiles(id),
  pharmacy_id     uuid,
  created_at      timestamptz DEFAULT now()
);

-- usage_events for plan limits
CREATE TABLE IF NOT EXISTS public.usage_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  patient_id      uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  feature         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- patient_professional_access
CREATE TABLE IF NOT EXISTS public.patient_professional_access (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  appointment_id  uuid REFERENCES public.appointments(id),
  granted_via     text DEFAULT 'appointment',
  valid_until     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (patient_id, professional_id)
);

-- consents
CREATE TABLE IF NOT EXISTS public.consents (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type           text NOT NULL,
  patient_id     uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  reference_id   uuid,
  reference_type text,
  given_at       timestamptz DEFAULT now()
);

-- commission_entries
CREATE TABLE IF NOT EXISTS public.commission_entries (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  reservation_id  uuid,
  amount          integer NOT NULL,
  rate            numeric(5,4),
  created_at      timestamptz DEFAULT now()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_profile       ON public.ai_usage(profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_entity ON public.security_events(entity_id, type);
CREATE INDEX IF NOT EXISTS idx_email_logs_profile     ON public.email_logs(profile_id, email_type, sequence_step);
CREATE INDEX IF NOT EXISTS idx_pshares_prescription   ON public.prescription_shares(prescription_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_pro       ON public.usage_events(professional_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_ppa_patient            ON public.patient_professional_access(patient_id, professional_id);

-- RLS
ALTER TABLE public.ai_usage                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_shares         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_access_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_professional_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries          ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses, users only see their own)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_usage' AND policyname='ai_usage_own') THEN
    CREATE POLICY "ai_usage_own" ON public.ai_usage FOR SELECT USING (profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='email_logs_platform') THEN
    CREATE POLICY "email_logs_platform" ON public.email_logs FOR ALL USING (private.is_platform());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_events' AND policyname='security_events_platform') THEN
    CREATE POLICY "security_events_platform" ON public.security_events FOR ALL USING (private.is_platform());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prescription_shares' AND policyname='pshares_patient') THEN
    CREATE POLICY "pshares_patient" ON public.prescription_shares FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='consents' AND policyname='consents_own') THEN
    CREATE POLICY "consents_own" ON public.consents FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_professional_access' AND policyname='ppa_patient_view') THEN
    CREATE POLICY "ppa_patient_view" ON public.patient_professional_access FOR SELECT USING (
      patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
      OR professional_id IN (SELECT id FROM public.professionals WHERE profile_id = auth.uid())
    );
  END IF;
END $$;
