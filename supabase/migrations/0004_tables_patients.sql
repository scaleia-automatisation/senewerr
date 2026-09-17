-- ============================================================
-- 0004_tables_patients.sql — Patients & Dossier Central
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Séquences de numérotation (PAT-######, PRO-######, etc.)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.number_sequences (
  prefix text PRIMARY KEY,
  last_value int DEFAULT 0
);

CREATE OR REPLACE FUNCTION private.next_number(p_prefix text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO private.number_sequences(prefix, last_value)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = number_sequences.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN p_prefix || lpad(v_next::text, 6, '0');
END;
$$;

-- ────────────────────────────────────────────────────────────
-- PATIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.patients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_number        text UNIQUE,
  national_id_enc       text,
  blood_group           text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  preferred_language    text DEFAULT 'fr',
  deleted_at            timestamptz,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère PAT-######
CREATE OR REPLACE FUNCTION public.generate_patient_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.patient_number IS NULL THEN
    NEW.patient_number := private.next_number('PAT-');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_patient_number
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.generate_patient_number();

-- ────────────────────────────────────────────────────────────
-- BENEFICIARIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.beneficiaries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  date_of_birth date NOT NULL,
  gender        text CHECK (gender IN ('f','m','other')),
  relationship  text CHECK (relationship IN ('enfant','parent','conjoint','proche')),
  phone         text,
  notes         text,
  status        public.account_status DEFAULT 'active',
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_beneficiaries_patient ON public.beneficiaries(patient_id);

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- HEALTH_RECORDS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.health_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  beneficiary_id uuid REFERENCES public.beneficiaries(id),
  record_type    public.health_record_type NOT NULL,
  title          text,
  content        text,
  severity       text, -- pour les allergies
  source_type    text, -- consultation, patient, document
  source_id      uuid,
  visibility     public.document_visibility DEFAULT 'private',
  created_by     uuid REFERENCES public.profiles(id),
  deleted_at     timestamptz,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_health_records_patient_type ON public.health_records(patient_id, record_type);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_health_records_updated_at
  BEFORE UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PATIENT_PROFESSIONAL_ACCESS (consentement technique)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.patient_professional_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL, -- FK vers professionals (créée à la migration 0005)
  granted_via     text CHECK (granted_via IN ('appointment','manual')),
  appointment_id  uuid, -- FK vers appointments (créée à la migration 0006)
  scope           text[] DEFAULT '{identity,allergies,current_treatments,own_consultations}',
  valid_from      timestamptz DEFAULT now(),
  valid_until     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_ppa_professional_patient ON public.patient_professional_access(professional_id, patient_id);
CREATE INDEX idx_ppa_patient ON public.patient_professional_access(patient_id);

ALTER TABLE public.patient_professional_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ppa_updated_at
  BEFORE UPDATE ON public.patient_professional_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- CONSENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.consents (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type                public.consent_type NOT NULL,
  granted                     boolean NOT NULL,
  version                     text,
  entity_type                 text,
  entity_id                   uuid,
  purpose                     text,
  granted_with_organization_id uuid REFERENCES public.organizations(id),
  valid_until                 timestamptz,
  ip_address                  inet,
  user_agent                  text,
  created_at                  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_consents_profile_type ON public.consents(profile_id, consent_type);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- FAVORITES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('professional','pharmacy','establishment')),
  entity_id   uuid NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (patient_id, entity_type, entity_id)
);

CREATE INDEX idx_favorites_patient ON public.favorites(patient_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
