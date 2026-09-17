-- ============================================================
-- 0008_tables_pharmacy_reservations.sql — Pharmacie & Réservations
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Code de retrait : 4 chiffres unique parmi réservations actives
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.generate_reservation_code()
RETURNS char(4) LANGUAGE plpgsql AS $$
DECLARE
  v_code char(4);
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'CODE_POOL_EXHAUSTED: Impossible de générer un code de retrait unique'
        USING ERRCODE = 'P0003';
    END IF;

    v_code := lpad(floor(random() * 10000)::int::text, 4, '0');

    SELECT EXISTS(
      SELECT 1 FROM public.pharmacy_reservations
      WHERE reservation_code = v_code
        AND status NOT IN ('completed','cancelled','expired','refunded')
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- PHARMACY_PRODUCTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.pharmacy_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id           uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id), -- dénormalisé pour RLS
  medicine_id           uuid NOT NULL REFERENCES public.medicines(id),
  stock_quantity        int DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity     int DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity    int GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,
  price                 integer NOT NULL,
  tva_applicable        boolean DEFAULT false,
  tva_rate              numeric(4,2) DEFAULT 0,
  expiration_date       date,
  photo_url             text,
  prescription_required boolean DEFAULT true,
  availability_status   public.availability_status DEFAULT 'unavailable',
  low_stock_threshold   int DEFAULT 5,
  deleted_at            timestamptz,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,
  UNIQUE (pharmacy_id, medicine_id)
);

CREATE INDEX idx_pharmacy_products_medicine_avail ON public.pharmacy_products(medicine_id, availability_status);
CREATE INDEX idx_pharmacy_products_org ON public.pharmacy_products(organization_id);

ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pharmacy_products_updated_at
  BEFORE UPDATE ON public.pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : calcule availability_status à chaque modification de stock
CREATE OR REPLACE FUNCTION private.update_availability_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_quantity - NEW.reserved_quantity > NEW.low_stock_threshold THEN
    NEW.availability_status := 'available';
  ELSIF NEW.stock_quantity - NEW.reserved_quantity > 0 THEN
    NEW.availability_status := 'low_stock';
  ELSE
    NEW.availability_status := 'unavailable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_pharmacy_product_availability
  BEFORE INSERT OR UPDATE OF stock_quantity, reserved_quantity, low_stock_threshold
  ON public.pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION private.update_availability_status();

-- ────────────────────────────────────────────────────────────
-- PHARMACY_STOCK_MOVEMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.pharmacy_stock_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_product_id uuid NOT NULL REFERENCES public.pharmacy_products(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES public.organizations(id),
  movement_type       text CHECK (movement_type IN ('restock','adjustment','reserve','release','withdraw','expired')),
  quantity            int NOT NULL,
  reservation_id      uuid, -- FK pharmacy_reservations (ajoutée ci-dessous)
  performed_by        uuid REFERENCES public.profiles(id),
  note                text,
  created_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_stock_movements_product ON public.pharmacy_stock_movements(pharmacy_product_id, created_at);
CREATE INDEX idx_stock_movements_org ON public.pharmacy_stock_movements(organization_id);

ALTER TABLE public.pharmacy_stock_movements ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PHARMACY_RESERVATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.pharmacy_reservations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number        text UNIQUE,   -- MED-#####
  reservation_code          char(4) NOT NULL,
  patient_id                uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  beneficiary_id            uuid REFERENCES public.beneficiaries(id),
  pharmacy_id               uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE RESTRICT,
  organization_id           uuid NOT NULL REFERENCES public.organizations(id),
  prescription_id           uuid REFERENCES public.prescriptions(id),
  prescription_share_id     uuid REFERENCES public.prescription_shares(id),
  insurance_provider_id     uuid REFERENCES public.insurance_providers(id),
  insurance_member_id       uuid, -- FK insurance_members (migration 0009)
  coverage_request_id       uuid, -- FK coverage_requests (migration 0009)

  -- Montants (XOF, entiers)
  subtotal                  integer NOT NULL CHECK (subtotal >= 0),
  tax_amount                integer DEFAULT 0,
  total_amount              integer NOT NULL CHECK (total_amount >= 0),
  insurance_amount          integer DEFAULT 0,
  patient_amount            integer NOT NULL CHECK (patient_amount >= 0),
  commission_amount         integer DEFAULT 0,
  commission_rate           numeric(5,2) DEFAULT 0,
  currency                  char(3) DEFAULT 'XOF',

  -- Sous-statuts indépendants (7 pilliers)
  pharmacy_status           public.pharmacy_status DEFAULT 'pending',
  prescription_check_status public.prescription_check_status DEFAULT 'not_required',
  insurance_status          public.insurance_status DEFAULT 'none',
  patient_payment_status    public.patient_payment_status DEFAULT 'pending',
  mutual_payment_status     public.mutual_payment_status DEFAULT 'not_required',
  preparation_status        public.preparation_status DEFAULT 'not_started',
  withdrawal_status         public.withdrawal_status DEFAULT 'pending',

  -- Statut global calculé (JAMAIS écrit depuis le client)
  status                    public.reservation_status DEFAULT 'submitted',
  patient_label             text, -- généré par compute_reservation_status()

  -- Détails
  pharmacy_refusal_reason   text,
  expires_at                timestamptz,
  financed_at               timestamptz,
  preparation_started_at    timestamptz,
  ready_at                  timestamptz,
  withdrawn_at              timestamptz,
  completed_at              timestamptz,
  cancelled_at              timestamptz,
  cancelled_by              uuid REFERENCES public.profiles(id),
  cancellation_reason       text,
  withdrawal_failed_attempts int DEFAULT 0,
  withdrawal_locked_until   timestamptz,

  created_at                timestamptz DEFAULT now() NOT NULL,
  updated_at                timestamptz DEFAULT now() NOT NULL
);

-- Code unique parmi les réservations actives
CREATE UNIQUE INDEX idx_reservation_code_active
  ON public.pharmacy_reservations(reservation_code)
  WHERE status NOT IN ('completed','cancelled','expired','refunded');

CREATE INDEX idx_reservations_patient ON public.pharmacy_reservations(patient_id, created_at DESC);
CREATE INDEX idx_reservations_org_status ON public.pharmacy_reservations(organization_id, status);
CREATE INDEX idx_reservations_insurance ON public.pharmacy_reservations(insurance_provider_id, insurance_status);

ALTER TABLE public.pharmacy_reservations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_reservations_updated_at
  BEFORE UPDATE ON public.pharmacy_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère MED-##### + reservation_code
CREATE OR REPLACE FUNCTION public.init_reservation_identifiers()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reservation_number IS NULL THEN
    NEW.reservation_number := private.next_number('MED-');
    -- MED- préfixe 5 chiffres
    NEW.reservation_number := 'MED-' || lpad(
      (regexp_replace(NEW.reservation_number, '^MED-0*', ''))::int::text, 5, '0'
    );
  END IF;
  IF NEW.reservation_code IS NULL OR NEW.reservation_code = '0000' THEN
    NEW.reservation_code := private.generate_reservation_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_reservation_identifiers
  BEFORE INSERT ON public.pharmacy_reservations
  FOR EACH ROW EXECUTE FUNCTION public.init_reservation_identifiers();

-- ────────────────────────────────────────────────────────────
-- compute_reservation_status() : calcule le statut global
-- Règle : statut = sous-statuts les plus en attente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.compute_reservation_status(p_id uuid)
RETURNS TABLE(
  new_status    public.reservation_status,
  patient_label text
) LANGUAGE plpgsql AS $$
DECLARE
  r public.pharmacy_reservations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.pharmacy_reservations WHERE id = p_id;

  -- Annulation / expiration priment sur tout
  IF r.status = 'cancelled' THEN
    RETURN QUERY SELECT 'cancelled'::public.reservation_status, 'Annulée';
    RETURN;
  END IF;
  IF r.status = 'expired' THEN
    RETURN QUERY SELECT 'expired'::public.reservation_status, 'Expirée';
    RETURN;
  END IF;
  IF r.status IN ('refund_pending','refunded') THEN
    RETURN QUERY SELECT r.status, 'Remboursement';
    RETURN;
  END IF;
  IF r.status = 'dispute' THEN
    RETURN QUERY SELECT 'dispute'::public.reservation_status, 'Litige';
    RETURN;
  END IF;

  -- Pharmacie refuse
  IF r.pharmacy_status = 'refused' THEN
    RETURN QUERY SELECT 'cancelled'::public.reservation_status, 'Refusée';
    RETURN;
  END IF;

  -- 1. Pharmacie doit confirmer
  IF r.pharmacy_status = 'pending' THEN
    RETURN QUERY SELECT 'submitted'::public.reservation_status, 'À traiter';
    RETURN;
  END IF;

  -- 2. Vérification ordonnance
  IF r.prescription_check_status = 'pending' THEN
    RETURN QUERY SELECT 'prescription_review'::public.reservation_status, 'En cours';
    RETURN;
  END IF;
  IF r.prescription_check_status = 'rejected' THEN
    RETURN QUERY SELECT 'cancelled'::public.reservation_status, 'Annulée';
    RETURN;
  END IF;

  -- 3. Assurance
  IF r.insurance_status = 'pending' THEN
    RETURN QUERY SELECT 'insurance_pending'::public.reservation_status, 'En cours';
    RETURN;
  END IF;
  IF r.insurance_status = 'rejected' THEN
    RETURN QUERY SELECT 'insurance_refused'::public.reservation_status, 'Assurance refusée';
    RETURN;
  END IF;

  -- 4. Paiement patient
  IF r.patient_payment_status = 'pending' THEN
    RETURN QUERY SELECT 'patient_payment_pending'::public.reservation_status, 'En attente de paiement';
    RETURN;
  END IF;
  IF r.patient_payment_status = 'failed' THEN
    RETURN QUERY SELECT 'patient_payment_pending'::public.reservation_status, 'Paiement échoué';
    RETURN;
  END IF;

  -- 5. Paiement mutuelle
  IF r.mutual_payment_status = 'pending' THEN
    RETURN QUERY SELECT 'mutual_payment_pending'::public.reservation_status, 'En cours';
    RETURN;
  END IF;

  -- 6. Préparation
  IF r.preparation_status = 'not_started' THEN
    RETURN QUERY SELECT 'fully_financed'::public.reservation_status, 'En cours';
    RETURN;
  END IF;
  IF r.preparation_status = 'preparing' THEN
    RETURN QUERY SELECT 'preparation'::public.reservation_status, 'En préparation';
    RETURN;
  END IF;
  IF r.preparation_status = 'ready' AND r.withdrawal_status = 'pending' THEN
    RETURN QUERY SELECT 'ready'::public.reservation_status, 'Prête à retirer';
    RETURN;
  END IF;

  -- 7. Retrait
  IF r.withdrawal_status = 'withdrawn' THEN
    RETURN QUERY SELECT 'completed'::public.reservation_status, 'Terminée';
    RETURN;
  END IF;

  RETURN QUERY SELECT r.status, 'En cours';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RESERVATION_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reservation_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id          uuid NOT NULL REFERENCES public.pharmacy_reservations(id) ON DELETE CASCADE,
  pharmacy_product_id     uuid NOT NULL REFERENCES public.pharmacy_products(id),
  prescription_item_id    uuid REFERENCES public.prescription_items(id),
  medicine_name_snapshot  text NOT NULL,
  dosage_snapshot         text,
  quantity                int NOT NULL CHECK (quantity > 0),
  unit_price              integer NOT NULL,
  subtotal                integer NOT NULL,
  covered_amount          integer DEFAULT 0,
  created_at              timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_reservation_items_reservation ON public.reservation_items(reservation_id);

ALTER TABLE public.reservation_items ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RESERVATION_STATUS_HISTORY
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reservation_status_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.pharmacy_reservations(id) ON DELETE CASCADE,
  field          text NOT NULL, -- status, pharmacy_status, insurance_status…
  old_value      text,
  new_value      text NOT NULL,
  changed_by     uuid REFERENCES public.profiles(id),
  changed_by_role public.user_role,
  reason         text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_reservation_status_history ON public.reservation_status_history(reservation_id, created_at);

ALTER TABLE public.reservation_status_history ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- WITHDRAWAL_ATTEMPTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.withdrawal_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.pharmacy_reservations(id) ON DELETE CASCADE,
  pharmacy_id    uuid NOT NULL REFERENCES public.pharmacies(id),
  entered_code   char(4) NOT NULL,
  success        boolean NOT NULL,
  attempted_by   uuid REFERENCES public.profiles(id),
  ip_address     inet,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_withdrawal_attempts_reservation ON public.withdrawal_attempts(reservation_id, created_at);

ALTER TABLE public.withdrawal_attempts ENABLE ROW LEVEL SECURITY;

-- FK différées résolues
ALTER TABLE public.pharmacy_stock_movements
  ADD CONSTRAINT fk_stock_movement_reservation
  FOREIGN KEY (reservation_id) REFERENCES public.pharmacy_reservations(id) ON DELETE SET NULL;

ALTER TABLE public.prescription_shares
  ADD CONSTRAINT fk_prescription_shares_reservation
  FOREIGN KEY (reservation_id) REFERENCES public.pharmacy_reservations(id) ON DELETE SET NULL;

ALTER TABLE public.prescription_reviews
  ADD CONSTRAINT fk_prescription_reviews_reservation
  FOREIGN KEY (reservation_id) REFERENCES public.pharmacy_reservations(id) ON DELETE CASCADE;

-- deny statut direct
CREATE TRIGGER deny_reservation_status_update
  BEFORE UPDATE ON public.pharmacy_reservations
  FOR EACH ROW EXECUTE FUNCTION private.deny_client_status_update();
