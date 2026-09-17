-- ============================================================
-- 0007_tables_prescriptions.sql — Ordonnances & Médicaments
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MEDICINES (référentiel)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.medicines (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       text NOT NULL,
  generic_name               text,
  brand                      text,
  dosage                     text,
  form                       text, -- comprime, sirop, injectable…
  medicine_class             text,
  prescription_required      boolean DEFAULT true,
  regulatory_classification  text,
  online_purchase_allowed    boolean DEFAULT false,
  description                text,
  status                     text DEFAULT 'active',
  search_vector              tsvector GENERATED ALWAYS AS (
    to_tsvector('french',
      coalesce(name,'') || ' ' ||
      coalesce(generic_name,'') || ' ' ||
      coalesce(brand,'') || ' ' ||
      coalesce(medicine_class,'')
    )
  ) STORED,
  created_at                 timestamptz DEFAULT now() NOT NULL,
  updated_at                 timestamptz DEFAULT now() NOT NULL,
  UNIQUE (name, dosage, form)
);

CREATE INDEX idx_medicines_search ON public.medicines USING GIN (search_vector);
CREATE INDEX idx_medicines_class ON public.medicines(medicine_class);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prescriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_number text UNIQUE, -- généré à la signature
  patient_id          uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  beneficiary_id      uuid REFERENCES public.beneficiaries(id),
  professional_id     uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  consultation_id     uuid REFERENCES public.consultations(id),
  establishment_id    uuid REFERENCES public.establishments(id),
  issued_at           timestamptz,
  signed_at           timestamptz,
  valid_until         date,
  status              public.prescription_status DEFAULT 'draft',
  signature_hash      text,   -- SHA-256(contenu canonique + professional_id + signed_at)
  qr_token            text UNIQUE, -- uuid v4 opaque
  pdf_document_id     uuid,   -- FK documents migration 0009
  notes               text,
  cancelled_reason    text,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_prescriptions_patient_status ON public.prescriptions(patient_id, status);
CREATE INDEX idx_prescriptions_professional ON public.prescriptions(professional_id);
CREATE INDEX idx_prescriptions_qr ON public.prescriptions(qr_token);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prescription_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_id      uuid REFERENCES public.medicines(id),
  medicine_name    text NOT NULL,
  dosage           text,
  form             text,
  quantity         int NOT NULL CHECK (quantity > 0),
  frequency        text,
  duration_days    int,
  instructions     text,
  renewal_allowed  boolean DEFAULT false,
  renewals_total   int DEFAULT 0,
  renewals_remaining int DEFAULT 0,
  position         int NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_prescription_items_prescription ON public.prescription_items(prescription_id);

ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_prescription_items_updated_at
  BEFORE UPDATE ON public.prescription_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_SHARES (consentement partage patient → pharmacie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prescription_shares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  pharmacy_id     uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  reservation_id  uuid, -- FK pharmacy_reservations migration 0008
  shared_by       uuid NOT NULL REFERENCES public.profiles(id),
  purpose         text DEFAULT 'reservation',
  status          public.share_status DEFAULT 'active',
  valid_until     timestamptz,
  consent_id      uuid REFERENCES public.consents(id),
  revoked_at      timestamptz,
  revoked_reason  text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

-- Un seul partage actif par ordonnance/pharmacie
CREATE UNIQUE INDEX idx_prescription_shares_active
  ON public.prescription_shares(prescription_id, pharmacy_id)
  WHERE status = 'active';

CREATE INDEX idx_prescription_shares_prescription ON public.prescription_shares(prescription_id);
CREATE INDEX idx_prescription_shares_pharmacy ON public.prescription_shares(pharmacy_id);

ALTER TABLE public.prescription_shares ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_prescription_shares_updated_at
  BEFORE UPDATE ON public.prescription_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_ACCESS_LOGS (insertion uniquement serveur)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prescription_access_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  user_role       public.user_role,
  organization_id uuid,
  access_type     public.prescription_access_type NOT NULL,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_prescription_access_logs_prescription ON public.prescription_access_logs(prescription_id);

ALTER TABLE public.prescription_access_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_REVIEWS (vérification pharmacie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prescription_reviews (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id           uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  reservation_id            uuid, -- FK pharmacy_reservations migration 0008
  pharmacy_id               uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  reviewed_by               uuid NOT NULL REFERENCES public.profiles(id),
  decision                  public.prescription_check_status NOT NULL,
  problem_reason            text CHECK (problem_reason IN (
    'illisible','medicament_non_conforme','quantite','renouvellement','autre'
  )),
  comment                   text,
  shareable_with_patient    boolean DEFAULT true,
  created_at                timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_prescription_reviews_prescription ON public.prescription_reviews(prescription_id);

ALTER TABLE public.prescription_reviews ENABLE ROW LEVEL SECURITY;
