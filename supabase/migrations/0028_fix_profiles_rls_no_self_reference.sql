-- ═══════════════════════════════════════════════════════════════════════════
-- Réécriture de TOUTES les politiques RLS qui lisaient profiles directement.
-- Remplace: (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
-- Par:      private.my_profile_id()
-- Élimine toute récursion RLS sur public.profiles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_pro ON public.profiles;
DROP POLICY IF EXISTS profiles_select_platform ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY profiles_select_platform ON public.profiles
  FOR SELECT USING (private.is_platform());

CREATE POLICY profiles_select_pro ON public.profiles
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM private.user_role_cache urc WHERE urc.user_id = auth.uid() AND urc.role = 'professional')
    AND id IN (SELECT p.profile_id FROM public.patients p WHERE private.professional_can_access_patient(p.id))
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND role = private.current_role());

-- ─── patients ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS patients_select_own ON public.patients;
DROP POLICY IF EXISTS patients_insert_own ON public.patients;
DROP POLICY IF EXISTS patients_update_own ON public.patients;

CREATE POLICY patients_select_own ON public.patients FOR SELECT
  USING (profile_id = private.my_profile_id() OR private.is_platform() OR private.professional_can_access_patient(id));
CREATE POLICY patients_insert_own ON public.patients FOR INSERT
  WITH CHECK (profile_id = private.my_profile_id());
CREATE POLICY patients_update_own ON public.patients FOR UPDATE
  USING (profile_id = private.my_profile_id())
  WITH CHECK (profile_id = private.my_profile_id());

-- ─── professionals ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS professionals_select ON public.professionals;
DROP POLICY IF EXISTS professionals_insert_own ON public.professionals;
DROP POLICY IF EXISTS professionals_update_own ON public.professionals;

CREATE POLICY professionals_select ON public.professionals FOR SELECT
  USING (verification_status = 'verified' OR profile_id = private.my_profile_id() OR private.is_platform());
CREATE POLICY professionals_insert_own ON public.professionals FOR INSERT
  WITH CHECK (profile_id = private.my_profile_id() AND private.current_role() = 'professional');
CREATE POLICY professionals_update_own ON public.professionals FOR UPDATE
  USING (profile_id = private.my_profile_id())
  WITH CHECK (profile_id = private.my_profile_id() AND verification_status = (SELECT verification_status FROM professionals WHERE id = professionals.id));

-- ─── appointments ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS appointments_select ON public.appointments;
DROP POLICY IF EXISTS appointments_insert ON public.appointments;

CREATE POLICY appointments_select ON public.appointments FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    OR establishment_id IN (SELECT id FROM establishments WHERE organization_id = ANY(private.user_org_ids()))
    OR private.is_platform()
  );
CREATE POLICY appointments_insert ON public.appointments FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()) AND status = 'requested');

-- ─── beneficiaries ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS beneficiaries_own ON public.beneficiaries;
CREATE POLICY beneficiaries_own ON public.beneficiaries FOR ALL
  USING (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()) OR private.is_platform())
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()));

-- ─── consultations ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS consultations_select ON public.consultations;
DROP POLICY IF EXISTS consultations_manage_pro ON public.consultations;
DROP POLICY IF EXISTS consultations_update_pro ON public.consultations;

CREATE POLICY consultations_select ON public.consultations FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    OR private.is_platform()
  );
CREATE POLICY consultations_manage_pro ON public.consultations FOR INSERT
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));
CREATE POLICY consultations_update_pro ON public.consultations FOR UPDATE
  USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()))
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));

-- ─── coverage_requests ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS coverage_requests_select ON public.coverage_requests;
CREATE POLICY coverage_requests_select ON public.coverage_requests FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR organization_id = ANY(private.user_org_ids())
    OR insurance_provider_id IN (SELECT id FROM insurance_providers WHERE organization_id = ANY(private.user_org_ids()))
    OR private.is_platform()
  );

-- ─── coverage_request_events ─────────────────────────────────────────────────
DROP POLICY IF EXISTS coverage_events_select ON public.coverage_request_events;
CREATE POLICY coverage_events_select ON public.coverage_request_events FOR SELECT
  USING (
    coverage_request_id IN (
      SELECT id FROM coverage_requests
      WHERE patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
         OR organization_id = ANY(private.user_org_ids())
    )
    OR private.is_platform()
  );

-- ─── credit_wallets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS credit_wallets_select ON public.credit_wallets;
CREATE POLICY credit_wallets_select ON public.credit_wallets FOR SELECT
  USING (organization_id = ANY(private.user_org_ids()) OR profile_id = private.my_profile_id() OR private.is_platform());

-- ─── documents ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_soft_delete ON public.documents;

CREATE POLICY documents_select ON public.documents FOR SELECT
  USING (
    deleted_at IS NULL AND (
      created_by = private.my_profile_id()
      OR patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
      OR organization_id = ANY(private.user_org_ids())
      OR (visibility = 'shared_professional' AND private.professional_can_access_patient(patient_id))
      OR (visibility = 'shared_pharmacy' AND private.pharmacy_can_access_prescription(CASE WHEN entity_type = 'prescription' THEN entity_id ELSE NULL END))
      OR private.is_platform()
    )
  );
CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (created_by = private.my_profile_id());
CREATE POLICY documents_soft_delete ON public.documents FOR UPDATE
  USING (created_by = private.my_profile_id() OR organization_id = ANY(private.user_org_ids()) OR private.is_platform())
  WITH CHECK (created_by = private.my_profile_id());

-- ─── insurance_members ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS insurance_members_select ON public.insurance_members;
CREATE POLICY insurance_members_select ON public.insurance_members FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()) OR organization_id = ANY(private.user_org_ids()) OR private.is_platform());

-- ─── invoices ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR organization_id = ANY(private.user_org_ids())
    OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    OR private.is_platform()
  );

-- ─── organization_members ────────────────────────────────────────────────────
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT
  USING (profile_id = private.my_profile_id() OR organization_id = ANY(private.user_org_ids()) OR private.is_platform());

-- ─── patient_professional_access ─────────────────────────────────────────────
DROP POLICY IF EXISTS access_select ON public.patient_professional_access;
DROP POLICY IF EXISTS access_patient_manage ON public.patient_professional_access;
DROP POLICY IF EXISTS access_patient_revoke ON public.patient_professional_access;

CREATE POLICY access_select ON public.patient_professional_access FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    OR private.is_platform()
  );
CREATE POLICY access_patient_manage ON public.patient_professional_access FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()));
CREATE POLICY access_patient_revoke ON public.patient_professional_access FOR UPDATE
  USING (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()))
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()));

-- ─── payments ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (payer_id = private.my_profile_id() OR recipient_id = ANY(private.user_org_ids()) OR private.is_platform());

-- ─── pharmacy_reservations ───────────────────────────────────────────────────
DROP POLICY IF EXISTS reservations_select ON public.pharmacy_reservations;
DROP POLICY IF EXISTS reservations_insert_patient ON public.pharmacy_reservations;

CREATE POLICY reservations_select ON public.pharmacy_reservations FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id = ANY(private.user_org_ids()))
    OR private.is_platform()
  );
CREATE POLICY reservations_insert_patient ON public.pharmacy_reservations FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()) AND status = 'draft');

-- ─── prescription_items ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS prescription_items_select ON public.prescription_items;
DROP POLICY IF EXISTS prescription_items_manage_pro ON public.prescription_items;

CREATE POLICY prescription_items_select ON public.prescription_items FOR SELECT
  USING (
    prescription_id IN (
      SELECT id FROM prescriptions
      WHERE patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
         OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
         OR private.pharmacy_can_access_prescription(id)
    )
  );
CREATE POLICY prescription_items_manage_pro ON public.prescription_items FOR ALL
  USING (prescription_id IN (SELECT id FROM prescriptions WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())))
  WITH CHECK (prescription_id IN (SELECT id FROM prescriptions WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())));

-- ─── prescription_shares ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS prescription_shares_select ON public.prescription_shares;
DROP POLICY IF EXISTS prescription_shares_insert_patient ON public.prescription_shares;

CREATE POLICY prescription_shares_select ON public.prescription_shares FOR SELECT
  USING (shared_by = private.my_profile_id() OR pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id = ANY(private.user_org_ids())) OR private.is_platform());
CREATE POLICY prescription_shares_insert_patient ON public.prescription_shares FOR INSERT
  WITH CHECK (
    shared_by = private.my_profile_id()
    AND prescription_id IN (SELECT id FROM prescriptions WHERE patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id()))
  );

-- ─── prescriptions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS prescriptions_select ON public.prescriptions;
DROP POLICY IF EXISTS prescriptions_insert_pro ON public.prescriptions;
DROP POLICY IF EXISTS prescriptions_update_pro ON public.prescriptions;

CREATE POLICY prescriptions_select ON public.prescriptions FOR SELECT
  USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
    OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    OR private.pharmacy_can_access_prescription(id)
    OR private.is_platform()
  );
CREATE POLICY prescriptions_insert_pro ON public.prescriptions FOR INSERT
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));
CREATE POLICY prescriptions_update_pro ON public.prescriptions FOR UPDATE
  USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()))
  WITH CHECK (
    professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id())
    AND status = (SELECT status FROM prescriptions WHERE id = prescriptions.id)
  );

-- ─── professional_qualifications ─────────────────────────────────────────────
DROP POLICY IF EXISTS qualifications_own ON public.professional_qualifications;
CREATE POLICY qualifications_own ON public.professional_qualifications FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()) OR private.is_platform())
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));

-- ─── refunds ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS refunds_select ON public.refunds;
DROP POLICY IF EXISTS refunds_insert ON public.refunds;
CREATE POLICY refunds_select ON public.refunds FOR SELECT USING (requested_by = private.my_profile_id() OR private.is_platform());
CREATE POLICY refunds_insert ON public.refunds FOR INSERT WITH CHECK (requested_by = private.my_profile_id() AND status = 'requested');

-- ─── reminders ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS reminders_select ON public.reminders;
CREATE POLICY reminders_select ON public.reminders FOR SELECT USING (recipient_profile_id = private.my_profile_id() OR private.is_platform());

-- ─── reservation_items ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS reservation_items_select ON public.reservation_items;
CREATE POLICY reservation_items_select ON public.reservation_items FOR SELECT
  USING (
    reservation_id IN (
      SELECT id FROM pharmacy_reservations
      WHERE patient_id IN (SELECT id FROM patients WHERE profile_id = private.my_profile_id())
         OR pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id = ANY(private.user_org_ids()))
    )
    OR private.is_platform()
  );

-- ─── schedule_exceptions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_exceptions_own ON public.schedule_exceptions;
CREATE POLICY schedule_exceptions_own ON public.schedule_exceptions FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()))
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));

-- ─── schedules ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS schedules_manage_own ON public.schedules;
DROP POLICY IF EXISTS schedules_select ON public.schedules;
CREATE POLICY schedules_manage_own ON public.schedules FOR ALL
  USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()))
  WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));
CREATE POLICY schedules_select ON public.schedules FOR SELECT
  USING (status = 'active' OR professional_id IN (SELECT id FROM professionals WHERE profile_id = private.my_profile_id()));

-- ─── subscriptions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT
  USING (organization_id = ANY(private.user_org_ids()) OR profile_id = private.my_profile_id() OR private.is_platform());

-- ─── verification_requests ───────────────────────────────────────────────────
DROP POLICY IF EXISTS verification_requests_select ON public.verification_requests;
DROP POLICY IF EXISTS verification_requests_insert ON public.verification_requests;
CREATE POLICY verification_requests_select ON public.verification_requests FOR SELECT
  USING (submitted_by = private.my_profile_id() OR private.is_platform());
CREATE POLICY verification_requests_insert ON public.verification_requests FOR INSERT
  WITH CHECK (submitted_by = private.my_profile_id() AND status = 'pending');

-- ─── ai_generations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ai_generations_select ON public.ai_generations;
CREATE POLICY ai_generations_select ON public.ai_generations FOR SELECT
  USING (profile_id = private.my_profile_id() OR organization_id = ANY(private.user_org_ids()) OR private.is_platform());
