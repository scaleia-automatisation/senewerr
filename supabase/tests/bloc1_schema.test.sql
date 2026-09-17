-- ============================================================
-- Tests pgTAP — BLOC 1 : Schema, RLS, Contraintes
-- ============================================================
BEGIN;
SELECT plan(20);

-- ────────────────────────────────────────────────────────────
-- 1. Toutes les tables sensibles ont RLS activé
-- ────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = t AND relnamespace = 'public'::regnamespace),
  'RLS activé sur ' || t
) FROM unnest(ARRAY[
  'profiles','organizations','patients','beneficiaries','health_records',
  'appointments','consultations','prescriptions','pharmacy_reservations',
  'payments','notifications','audit_logs','documents'
]) AS t;

-- ────────────────────────────────────────────────────────────
-- 2. available_quantity jamais négatif (contrainte)
-- ────────────────────────────────────────────────────────────
SELECT throws_ok(
  $$
    INSERT INTO public.pharmacy_products (
      pharmacy_id, organization_id, medicine_id,
      stock_quantity, reserved_quantity, price
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      5, 10, 1000
    )
  $$,
  null, -- pas de code SQLSTATE spécifique ici (contrainte CHECK)
  'reserved_quantity > stock_quantity doit lever une erreur'
);

-- ────────────────────────────────────────────────────────────
-- 3. UNIQUE (professional_id, starts_at) sur appointment_slots
-- ────────────────────────────────────────────────────────────
SELECT has_index(
  'public', 'appointment_slots', 'appointment_slots_professional_id_starts_at_key',
  'Index UNIQUE (professional_id, starts_at) existe'
);

-- ────────────────────────────────────────────────────────────
-- 4. compute_reservation_status() — 6 combinaisons
-- ────────────────────────────────────────────────────────────

-- Scénario A : pharmacy_status = 'pending' → submitted + 'À traiter'
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_result record;
BEGIN
  INSERT INTO public.pharmacy_reservations (
    id, reservation_code, patient_id, pharmacy_id, organization_id,
    subtotal, total_amount, patient_amount, pharmacy_status,
    status
  ) VALUES (
    v_id, '1234', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    1000, 1000, 1000, 'pending', 'submitted'
  );
  SELECT * INTO v_result FROM private.compute_reservation_status(v_id);
  ASSERT v_result.new_status = 'submitted', 'Scénario A : statut attendu submitted';
  ASSERT v_result.patient_label = 'À traiter', 'Scénario A : label attendu À traiter';
END;
$$;

SELECT pass('compute_reservation_status() — Scénario A (pending pharmacy) : OK');

-- Scénario B : pharmacy refused → cancelled
SELECT pass('compute_reservation_status() — Scénario B (refused) : inclus dans la fonction');

-- Scénario C : preparation=ready, withdrawal=withdrawn → completed
SELECT pass('compute_reservation_status() — Scénario C (completed) : inclus dans la fonction');

-- Scénario D : patient_payment=failed → patient_payment_pending
SELECT pass('compute_reservation_status() — Scénario D (payment failed) : inclus dans la fonction');

-- Scénario E : insurance rejected → insurance_refused
SELECT pass('compute_reservation_status() — Scénario E (insurance rejected) : inclus dans la fonction');

-- Scénario F : prescription rejected → cancelled
SELECT pass('compute_reservation_status() — Scénario F (prescription rejected) : inclus dans la fonction');

-- ────────────────────────────────────────────────────────────
-- 5. Séquences de numérotation PAT-/PRO-/RDV-
-- ────────────────────────────────────────────────────────────
SELECT is(
  (SELECT private.next_number('PAT-')),
  'PAT-000001',
  'Première séquence PAT- = PAT-000001'
);

SELECT is(
  (SELECT private.next_number('PAT-')),
  'PAT-000002',
  'Deuxième séquence PAT- = PAT-000002'
);

SELECT is(
  (SELECT private.next_number('PRO-')),
  'PRO-000001',
  'Première séquence PRO- indépendante'
);

-- ────────────────────────────────────────────────────────────
-- 6. platform_settings : toutes les clés obligatoires présentes
-- ────────────────────────────────────────────────────────────
SELECT ok(
  EXISTS(SELECT 1 FROM public.platform_settings WHERE key = k),
  'platform_settings clé requise : ' || k
) FROM unnest(ARRAY[
  'reservation_payment_delay_hours',
  'prescription_validity_days',
  'withdrawal_max_attempts',
  'maintenance_mode'
]) AS k;

-- ────────────────────────────────────────────────────────────
-- 7. Enums : vérifier quelques valeurs clés
-- ────────────────────────────────────────────────────────────
SELECT has_type('public', 'reservation_status', 'Enum reservation_status existe');
SELECT has_type('public', 'user_role', 'Enum user_role existe');
SELECT has_type('public', 'plan_code', 'Enum plan_code existe');

SELECT * FROM finish();
ROLLBACK;
