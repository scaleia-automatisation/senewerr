-- ============================================================
-- 0009_tables_documents_insurance.sql — Documents & Mutuelle
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type     public.document_owner_type NOT NULL,
  owner_id       uuid NOT NULL,
  patient_id     uuid REFERENCES public.patients(id),
  organization_id uuid REFERENCES public.organizations(id),
  document_type  public.document_type NOT NULL,
  storage_bucket text NOT NULL,
  file_path      text UNIQUE NOT NULL,
  file_name      text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     int NOT NULL,
  visibility     public.document_visibility DEFAULT 'private',
  entity_type    text,
  entity_id      uuid,
  checksum       text,
  created_by     uuid REFERENCES public.profiles(id),
  deleted_at     timestamptz,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_documents_patient ON public.documents(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_org ON public.documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- DOCUMENT_ACCESS_LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.document_access_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  access_type text NOT NULL CHECK (access_type IN ('view','download')),
  ip_address  inet,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_doc_access_logs ON public.document_access_logs(document_id, created_at);

ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- FK différées : documents
ALTER TABLE public.professional_qualifications
  ADD CONSTRAINT fk_qual_document
  FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT fk_prescription_pdf
  FOREIGN KEY (pdf_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.consultations
  ADD CONSTRAINT fk_consultation_transcript
  FOREIGN KEY (transcript_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- INSURANCE_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.insurance_members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_provider_id uuid NOT NULL REFERENCES public.insurance_providers(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES public.organizations(id),
  patient_id           uuid REFERENCES public.patients(id),
  beneficiary_id       uuid REFERENCES public.beneficiaries(id),
  member_number        text NOT NULL,
  holder_first_name    text NOT NULL,
  holder_last_name     text NOT NULL,
  holder_date_of_birth date NOT NULL,
  plan_name            text NOT NULL,
  coverage_rate        numeric(5,2) NOT NULL,
  annual_ceiling       integer NOT NULL,
  ceiling_used         integer DEFAULT 0,
  coverage_start       date NOT NULL,
  coverage_end         date,
  status               public.member_status DEFAULT 'to_verify',
  verified_at          timestamptz,
  verified_by          uuid REFERENCES public.profiles(id),
  rejection_reason     text,
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE (insurance_provider_id, member_number)
);

CREATE INDEX idx_insurance_members_patient ON public.insurance_members(patient_id);
CREATE INDEX idx_insurance_members_provider ON public.insurance_members(insurance_provider_id, status);

ALTER TABLE public.insurance_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_insurance_members_updated_at
  BEFORE UPDATE ON public.insurance_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK différée : pharmacy_reservations → insurance_members
ALTER TABLE public.pharmacy_reservations
  ADD CONSTRAINT fk_reservation_insurance_member
  FOREIGN KEY (insurance_member_id) REFERENCES public.insurance_members(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- COVERAGE_RULES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coverage_rules (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_provider_id    uuid NOT NULL REFERENCES public.insurance_providers(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES public.organizations(id),
  plan_name                text NOT NULL,
  medicine_class           text,
  medicine_id              uuid REFERENCES public.medicines(id),
  coverage_rate            numeric(5,2) NOT NULL,
  maximum_amount           integer,
  patient_copay_rate       numeric(5,2),
  requires_manual_validation boolean DEFAULT true,
  effective_from           date NOT NULL,
  effective_until          date,
  status                   text DEFAULT 'active',
  priority                 int DEFAULT 0,
  created_at               timestamptz DEFAULT now() NOT NULL,
  updated_at               timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_coverage_rules_provider ON public.coverage_rules(insurance_provider_id, status);

ALTER TABLE public.coverage_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_coverage_rules_updated_at
  BEFORE UPDATE ON public.coverage_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- COVERAGE_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coverage_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number        text UNIQUE, -- PEC-######
  reservation_id        uuid NOT NULL REFERENCES public.pharmacy_reservations(id) ON DELETE RESTRICT,
  insurance_provider_id uuid NOT NULL REFERENCES public.insurance_providers(id) ON DELETE RESTRICT,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  patient_id            uuid NOT NULL REFERENCES public.patients(id),
  member_id             uuid NOT NULL REFERENCES public.insurance_members(id),
  requested_amount      integer NOT NULL,
  estimated_amount      integer,
  approved_amount       integer,
  patient_amount        integer,
  applied_rate          numeric(5,2),
  ceiling_used          integer DEFAULT 0,
  status                public.coverage_request_status DEFAULT 'pending',
  decision_reason       text,
  info_request_message  text,
  decided_by            uuid REFERENCES public.profiles(id),
  decided_at            timestamptz,
  payment_id            uuid, -- FK payments migration 0010
  sla_due_at            timestamptz,
  overdue               boolean GENERATED ALWAYS AS (
    sla_due_at IS NOT NULL AND sla_due_at < now()
  ) STORED,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_coverage_requests_org_status ON public.coverage_requests(organization_id, status);
CREATE INDEX idx_coverage_requests_reservation ON public.coverage_requests(reservation_id);

ALTER TABLE public.coverage_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_coverage_requests_updated_at
  BEFORE UPDATE ON public.coverage_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère PEC-######
CREATE OR REPLACE FUNCTION public.generate_coverage_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := private.next_number('PEC-');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_coverage_number
  BEFORE INSERT ON public.coverage_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_coverage_number();

-- FK différée : pharmacy_reservations → coverage_requests
ALTER TABLE public.pharmacy_reservations
  ADD CONSTRAINT fk_reservation_coverage
  FOREIGN KEY (coverage_request_id) REFERENCES public.coverage_requests(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- COVERAGE_REQUEST_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coverage_request_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_request_id uuid NOT NULL REFERENCES public.coverage_requests(id) ON DELETE CASCADE,
  old_status          public.coverage_request_status,
  new_status          public.coverage_request_status NOT NULL,
  changed_by          uuid REFERENCES public.profiles(id),
  note                text,
  created_at          timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.coverage_request_events ENABLE ROW LEVEL SECURITY;
