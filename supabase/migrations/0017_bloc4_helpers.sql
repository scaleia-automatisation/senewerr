-- ============================================================
-- 0017_bloc4_helpers.sql — Fonctions métier BLOC 4
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Colonnes additionnelles
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS accepts_online_payment  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_min_hours  integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pickup_delay_days        integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS preparation_sla_minutes  integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS open_for_reservations    boolean NOT NULL DEFAULT true;

ALTER TABLE public.insurance_members
  ADD COLUMN IF NOT EXISTS verified_at        timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason   text;

ALTER TABLE public.appointment_status_history
  ADD COLUMN IF NOT EXISTS changed_by uuid;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS pro_number_seq bigint;

-- coverage_rules : colonnes métier
ALTER TABLE public.coverage_rules
  ADD COLUMN IF NOT EXISTS insurance_provider_id  uuid REFERENCES public.insurance_providers(id),
  ADD COLUMN IF NOT EXISTS pharmacy_product_id    uuid REFERENCES public.pharmacy_products(id),
  ADD COLUMN IF NOT EXISTS coverage_rate           numeric(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_per_act             integer,
  ADD COLUMN IF NOT EXISTS is_active               boolean NOT NULL DEFAULT true;

-- ──────────────────────────────────────────────────────────
-- compute_reservation_status
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_reservation_status(r pharmacy_reservations)
RETURNS public.reservation_status
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF r.cancelled_at IS NOT NULL THEN RETURN 'cancelled'; END IF;

  IF r.expires_at < now()
     AND r.pharmacy_status = 'pending'
  THEN RETURN 'expired'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.disputes
    WHERE entity_id = r.id AND entity_type = 'reservation'
      AND status NOT IN ('resolved', 'closed')
  ) THEN RETURN 'dispute'; END IF;

  IF r.pharmacy_status = 'pending'  THEN RETURN 'pharmacy_review'; END IF;
  IF r.pharmacy_status = 'refused'  THEN RETURN 'cancelled'; END IF;

  IF r.prescription_check_status IN ('pending','clarification_requested') THEN
    RETURN 'prescription_review';
  END IF;
  IF r.prescription_check_status = 'rejected' THEN RETURN 'cancelled'; END IF;

  IF r.insurance_status IN ('pending','info_requested') THEN
    RETURN 'insurance_pending';
  END IF;
  IF r.insurance_status = 'rejected'
     AND r.patient_payment_status = 'pending'
  THEN RETURN 'insurance_refused'; END IF;

  IF r.patient_payment_status IN ('pending','failed') THEN
    RETURN 'patient_payment_pending';
  END IF;
  IF r.mutual_payment_status IN ('pending','failed') THEN
    RETURN 'mutual_payment_pending';
  END IF;

  IF r.preparation_status = 'not_started' THEN RETURN 'fully_financed'; END IF;
  IF r.preparation_status = 'preparing'   THEN RETURN 'preparation'; END IF;

  IF r.preparation_status = 'ready' AND r.withdrawal_status = 'pending' THEN
    RETURN 'ready';
  END IF;
  IF r.withdrawal_status = 'withdrawn' THEN RETURN 'completed'; END IF;

  RETURN 'pharmacy_review';
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_reservation_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.status     := public.compute_reservation_status(NEW);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_status ON public.pharmacy_reservations;
CREATE TRIGGER trg_reservation_status
  BEFORE UPDATE ON public.pharmacy_reservations
  FOR EACH ROW EXECUTE FUNCTION private.trg_reservation_status();

-- ──────────────────────────────────────────────────────────
-- can_prepare
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_prepare(r pharmacy_reservations)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    r.pharmacy_status = 'confirmed'
    AND r.prescription_check_status IN ('not_required','validated')
    AND r.insurance_status IN ('none','approved','partially_approved','paid')
    AND r.patient_payment_status IN ('not_required','paid')
    AND r.mutual_payment_status IN ('not_required','paid')
$$;

-- ──────────────────────────────────────────────────────────
-- generate_reservation_code : code 4 chiffres unique
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.generate_reservation_code()
RETURNS char(4) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  code char(4);
  tries int := 0;
BEGIN
  LOOP
    code := lpad((floor(random() * 9000) + 1000)::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pharmacy_reservations
      WHERE reservation_code = code
        AND status NOT IN ('completed','cancelled','expired')
    );
    tries := tries + 1;
    IF tries > 100 THEN RAISE EXCEPTION 'Cannot generate unique reservation code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- search_professionals : RPC full-text + PostGIS
-- organisations.location contient le point géo
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_professionals(
  p_specialty       text    DEFAULT NULL,
  p_name            text    DEFAULT NULL,
  p_city            text    DEFAULT NULL,
  p_district        text    DEFAULT NULL,
  p_date            date    DEFAULT NULL,
  p_time_min        time    DEFAULT NULL,
  p_time_max        time    DEFAULT NULL,
  p_language        text    DEFAULT NULL,
  p_teleconsult     boolean DEFAULT NULL,
  p_max_fee         integer DEFAULT NULL,
  p_lat             float8  DEFAULT NULL,
  p_lng             float8  DEFAULT NULL,
  p_radius_km       float8  DEFAULT 25,
  p_sort            text    DEFAULT 'soonest',
  p_limit           int     DEFAULT 20,
  p_offset          int     DEFAULT 0
)
RETURNS TABLE(
  professional_id          uuid,
  profile_id               uuid,
  full_name                text,
  specialty                text,
  photo_url                text,
  consultation_fee         integer,
  teleconsultation_enabled boolean,
  languages                text[],
  is_verified              boolean,
  next_slot_at             timestamptz,
  establishment_id         uuid,
  establishment_name       text,
  establishment_city       text,
  distance_km              float8
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ranked AS (
    SELECT
      pr.id                           AS professional_id,
      p.id                            AS profile_id,
      p.first_name || ' ' || p.last_name AS full_name,
      pr.specialty::text              AS specialty,
      p.avatar_url                    AS photo_url,
      pr.consultation_fee,
      pr.teleconsultation_enabled,
      pr.languages,
      (pr.verification_status = 'verified') AS is_verified,
      e.id                            AS establishment_id,
      o.name                          AS establishment_name,
      o.city                          AS establishment_city,
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND o.location IS NOT NULL
        THEN ST_Distance(
               o.location::geography,
               ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
             ) / 1000.0
        ELSE NULL
      END AS distance_km,
      MIN(s.starts_at) AS next_slot_at,
      ROW_NUMBER() OVER (
        PARTITION BY pr.id
        ORDER BY
          CASE WHEN p_sort = 'fee' THEN pr.consultation_fee END ASC,
          CASE WHEN p_sort = 'distance' AND p_lat IS NOT NULL THEN
            ST_Distance(
              o.location::geography,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            )
          END ASC NULLS LAST,
          MIN(s.starts_at) ASC NULLS LAST
      ) AS rn
    FROM public.professionals pr
    JOIN public.profiles p     ON p.id = pr.profile_id
    JOIN public.professional_establishments pe
         ON pe.professional_id = pr.id AND pe.status = 'active'
    JOIN public.establishments e ON e.id = pe.establishment_id
    JOIN public.organizations  o ON o.id = e.organization_id
         AND o.status = 'active' AND o.verification_status = 'verified'
    LEFT JOIN public.appointment_slots s
         ON  s.professional_id  = pr.id
         AND s.establishment_id = e.id
         AND s.status           = 'available'
         AND (p_date IS NULL OR s.starts_at::date = p_date)
         AND (p_time_min IS NULL OR s.starts_at::time >= p_time_min)
         AND (p_time_max IS NULL OR s.starts_at::time <= p_time_max)
    WHERE
      pr.verification_status = 'verified'
      AND (p_specialty IS NULL OR pr.specialty::text = p_specialty)
      AND (p_name IS NULL
           OR (p.first_name || ' ' || p.last_name) ILIKE '%' || p_name || '%'
           OR pr.search_vector @@ plainto_tsquery('french', p_name))
      AND (p_city IS NULL OR o.city ILIKE '%' || p_city || '%')
      AND (p_language IS NULL OR pr.languages @> ARRAY[p_language])
      AND (p_teleconsult IS NULL OR pr.teleconsultation_enabled = p_teleconsult)
      AND (p_max_fee IS NULL OR pr.consultation_fee <= p_max_fee)
      AND (
        p_lat IS NULL OR p_lng IS NULL OR o.location IS NULL
        OR ST_DWithin(
             o.location::geography,
             ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
             p_radius_km * 1000
           )
      )
    GROUP BY pr.id, p.id, e.id, o.id
  )
  SELECT
    professional_id, profile_id, full_name, specialty, photo_url,
    consultation_fee, teleconsultation_enabled, languages, is_verified,
    next_slot_at, establishment_id, establishment_name, establishment_city,
    distance_km
  FROM ranked
  WHERE rn = 1
  ORDER BY
    CASE WHEN p_sort = 'soonest' THEN next_slot_at END ASC NULLS LAST,
    CASE WHEN p_sort = 'fee'     THEN consultation_fee END ASC,
    CASE WHEN p_sort = 'distance' THEN distance_km END ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset
$$;

-- ──────────────────────────────────────────────────────────
-- available_slots
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.available_slots(
  p_professional_id   uuid,
  p_establishment_id  uuid,
  p_from_date         date DEFAULT CURRENT_DATE,
  p_to_date           date DEFAULT CURRENT_DATE + 30
)
RETURNS TABLE(
  slot_id    uuid,
  starts_at  timestamptz,
  ends_at    timestamptz,
  duration   int
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    s.id AS slot_id,
    s.starts_at,
    s.ends_at,
    EXTRACT(EPOCH FROM (s.ends_at - s.starts_at))::int / 60 AS duration
  FROM public.appointment_slots s
  WHERE s.professional_id  = p_professional_id
    AND s.establishment_id = p_establishment_id
    AND s.status           = 'available'
    AND s.starts_at::date  >= p_from_date
    AND s.starts_at::date  <= p_to_date
    AND s.starts_at        > now()
  ORDER BY s.starts_at
$$;

-- ──────────────────────────────────────────────────────────
-- accept_full_patient_amount
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_full_patient_amount(p_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_patient_id uuid;
BEGIN
  SELECT patient_id INTO v_patient_id
  FROM public.pharmacy_reservations WHERE id = p_reservation_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients pt
    JOIN public.profiles p ON p.id = pt.profile_id
    WHERE pt.id = v_patient_id AND p.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;

  UPDATE public.pharmacy_reservations
  SET
    insurance_status      = 'rejected',
    mutual_payment_status = 'not_required',
    patient_amount        = total_amount,
    insurance_amount      = 0
  WHERE id = p_reservation_id AND insurance_status = 'rejected';
END;
$$;

-- ──────────────────────────────────────────────────────────
-- calculate_coverage : estimation de la part mutuelle
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_coverage(
  p_insurance_member_id uuid,
  p_items               jsonb  -- [{product_id, quantity, unit_price}]
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_member     record;
  v_total      integer := 0;
  v_covered    integer := 0;
  v_item       jsonb;
  v_rule       record;
  v_item_price integer;
  v_item_cov   integer;
BEGIN
  SELECT im.*
  INTO v_member
  FROM public.insurance_members im
  WHERE im.id = p_insurance_member_id AND im.status = 'verified';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'MEMBER_NOT_VERIFIED');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_price := ((v_item->>'unit_price')::integer) * ((v_item->>'quantity')::integer);
    v_total := v_total + v_item_price;

    SELECT cr.* INTO v_rule
    FROM public.coverage_rules cr
    WHERE cr.insurance_provider_id = v_member.insurance_provider_id
      AND cr.is_active
      AND (cr.pharmacy_product_id IS NULL
           OR cr.pharmacy_product_id = (v_item->>'product_id')::uuid)
    ORDER BY cr.pharmacy_product_id NULLS LAST LIMIT 1;

    IF FOUND THEN
      v_item_cov := LEAST(
        (v_item_price * v_rule.coverage_rate / 100)::integer,
        COALESCE(v_rule.max_per_act, v_item_price)
      );
      v_covered := v_covered + v_item_cov;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total',          v_total,
    'covered_amount', v_covered,
    'patient_amount', v_total - v_covered,
    'currency',       'XOF'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- mark_no_show
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_no_show(p_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.appointments
  SET status = 'no_show', updated_at = now()
  WHERE id = p_appointment_id
    AND status IN ('confirmed','paid','patient_arrived')
    AND starts_at + interval '15 minutes' <= now();

  IF NOT FOUND THEN RAISE EXCEPTION 'NO_SHOW_NOT_ALLOWED'; END IF;

  INSERT INTO public.appointment_status_history(appointment_id, status, changed_by)
  VALUES (p_appointment_id, 'no_show', auth.uid());
END;
$$;

-- ──────────────────────────────────────────────────────────
-- verify_member
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_member(
  p_member_id uuid,
  p_action    text,
  p_reason    text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_action = 'verify' THEN
    UPDATE public.insurance_members
    SET status = 'verified', verified_at = now()
    WHERE id = p_member_id AND status = 'to_verify';
  ELSIF p_action = 'reject' THEN
    UPDATE public.insurance_members
    SET status = 'rejected', rejection_reason = p_reason
    WHERE id = p_member_id AND status = 'to_verify';
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- adjust_stock
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_delta      integer,
  p_note       text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_qty integer;
BEGIN
  SELECT stock_quantity + p_delta INTO v_new_qty
  FROM public.pharmacy_products WHERE id = p_product_id;

  IF v_new_qty < 0 THEN RAISE EXCEPTION 'NEGATIVE_STOCK'; END IF;

  UPDATE public.pharmacy_products
  SET stock_quantity = v_new_qty, updated_at = now()
  WHERE id = p_product_id;

  INSERT INTO public.pharmacy_stock_movements
    (pharmacy_product_id, movement_type, quantity, performed_by, note)
  VALUES (p_product_id, 'adjustment', p_delta, auth.uid(), p_note);
END;
$$;

-- ──────────────────────────────────────────────────────────
-- cancel_prescription RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_prescription(
  p_prescription_id uuid,
  p_reason          text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Seul le professionnel propriétaire peut annuler
  IF NOT EXISTS (
    SELECT 1 FROM public.prescriptions pr
    JOIN public.professionals pro ON pro.id = pr.professional_id
    JOIN public.profiles p ON p.id = pro.profile_id
    WHERE pr.id = p_prescription_id AND p.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prescription_shares
    WHERE prescription_id = p_prescription_id
      AND status IN ('active','viewed')
  ) THEN RAISE EXCEPTION 'PRESCRIPTION_ALREADY_SHARED'; END IF;

  UPDATE public.prescriptions
  SET status = 'cancelled', cancelled_reason = p_reason, updated_at = now()
  WHERE id = p_prescription_id AND status NOT IN ('cancelled','used');
END;
$$;

-- ──────────────────────────────────────────────────────────
-- Indexes BLOC 4
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_apt_slots_available
  ON public.appointment_slots(professional_id, establishment_id, starts_at)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_prescriptions_qr
  ON public.prescriptions(qr_token)
  WHERE qr_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pshares_reservation
  ON public.prescription_shares(reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservations_patient
  ON public.pharmacy_reservations(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_devents_patient
  ON public.domain_events(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devents_entity
  ON public.domain_events(entity_type, entity_id, created_at DESC);
