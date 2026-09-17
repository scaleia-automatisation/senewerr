-- ============================================================
-- 0015_rls_policies.sql — Row Level Security (toutes tables)
-- ============================================================
-- Règles fondamentales :
--   1. Deny-by-default : RLS déjà activé sur toutes les tables
--   2. Les colonnes status ne sont JAMAIS modifiables depuis le client
--      → uniquement via Edge Functions ou SECURITY DEFINER RPC
--   3. Les admins plateforme (platform_admin, super_admin) ont accès
--      à tout via private.is_platform()
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid() OR private.is_platform());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Interdit de changer le rôle depuis le client
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- Les professionnels peuvent voir les profils de leurs patients
CREATE POLICY "profiles_select_pro"
  ON public.profiles FOR SELECT
  USING (
    private.current_role() = 'professional'
    AND id IN (
      SELECT profile_id FROM public.patients p
      WHERE private.professional_can_access_patient(p.id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- PATIENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "patients_select_own"
  ON public.patients FOR SELECT
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
    OR private.professional_can_access_patient(id)
  );

CREATE POLICY "patients_insert_own"
  ON public.patients FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "patients_update_own"
  ON public.patients FOR UPDATE
  USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

-- ────────────────────────────────────────────────────────────
-- BENEFICIARIES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "beneficiaries_own"
  ON public.beneficiaries FOR ALL
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.is_platform()
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- ORGANIZATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "organizations_select_public"
  ON public.organizations FOR SELECT
  USING (
    (status = 'active' AND verification_status = 'verified')
    OR id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

CREATE POLICY "organizations_update_members"
  ON public.organizations FOR UPDATE
  USING (
    id = ANY(private.user_org_ids())
    AND private.current_role() IN ('establishment_admin','pharmacy_admin','mutual_admin')
  )
  WITH CHECK (
    id = ANY(private.user_org_ids())
    -- status et verification_status non modifiables depuis le client
    AND verification_status = (SELECT verification_status FROM public.organizations WHERE id = organizations.id)
  );

-- ────────────────────────────────────────────────────────────
-- ORGANIZATION_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

CREATE POLICY "org_members_manage"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id = ANY(private.user_org_ids())
    AND private.current_role() IN ('establishment_admin','pharmacy_admin','mutual_admin')
  );

-- ────────────────────────────────────────────────────────────
-- PROFESSIONALS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "professionals_select"
  ON public.professionals FOR SELECT
  USING (
    verification_status = 'verified'
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

CREATE POLICY "professionals_insert_own"
  ON public.professionals FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND private.current_role() = 'professional'
  );

CREATE POLICY "professionals_update_own"
  ON public.professionals FOR UPDATE
  USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    -- verification_status non modifiable depuis le client
    AND verification_status = (SELECT verification_status FROM public.professionals WHERE id = professionals.id)
  );

-- ────────────────────────────────────────────────────────────
-- PROFESSIONAL_QUALIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "qualifications_own"
  ON public.professional_qualifications FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.is_platform()
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- SCHEDULES (table réelle : schedules)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "schedules_select"
  ON public.schedules FOR SELECT
  USING (status = 'active' OR
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "schedules_manage_own"
  ON public.schedules FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- SCHEDULE_EXCEPTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "schedule_exceptions_own"
  ON public.schedule_exceptions FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- PATIENT_PROFESSIONAL_ACCESS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "access_select"
  ON public.patient_professional_access FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.is_platform()
  );

CREATE POLICY "access_patient_manage"
  ON public.patient_professional_access FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "access_patient_revoke"
  ON public.patient_professional_access FOR UPDATE
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "appointments_select"
  ON public.appointments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

CREATE POLICY "appointments_insert"
  ON public.appointments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND status = 'requested'
  );

-- Pas de UPDATE direct sur appointments depuis le client (statut = serveur)

-- ────────────────────────────────────────────────────────────
-- CONSULTATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "consultations_select"
  ON public.consultations FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.is_platform()
  );

CREATE POLICY "consultations_manage_pro"
  ON public.consultations FOR INSERT
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "consultations_update_pro"
  ON public.consultations FOR UPDATE
  USING (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "prescriptions_select"
  ON public.prescriptions FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.pharmacy_can_access_prescription(id)
    OR private.is_platform()
  );

CREATE POLICY "prescriptions_insert_pro"
  ON public.prescriptions FOR INSERT
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- status géré serveur uniquement
CREATE POLICY "prescriptions_update_pro"
  ON public.prescriptions FOR UPDATE
  USING (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND status = (SELECT status FROM public.prescriptions WHERE id = prescriptions.id)
  );

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "prescription_items_select"
  ON public.prescription_items FOR SELECT
  USING (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE patient_id IN (
        SELECT id FROM public.patients
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
      OR professional_id IN (
        SELECT id FROM public.professionals
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
      OR private.pharmacy_can_access_prescription(prescriptions.id)
    )
  );

CREATE POLICY "prescription_items_manage_pro"
  ON public.prescription_items FOR ALL
  USING (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE professional_id IN (
        SELECT id FROM public.professionals
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  )
  WITH CHECK (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE professional_id IN (
        SELECT id FROM public.professionals
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- MEDICINES — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "medicines_select"
  ON public.medicines FOR SELECT
  USING (status = 'active' OR private.is_platform());

CREATE POLICY "medicines_manage_platform"
  ON public.medicines FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- PHARMACIES — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "pharmacies_select"
  ON public.pharmacies FOR SELECT
  USING (true);

CREATE POLICY "pharmacies_update_own"
  ON public.pharmacies FOR UPDATE
  USING (organization_id = ANY(private.user_org_ids()))
  WITH CHECK (organization_id = ANY(private.user_org_ids()));

-- ────────────────────────────────────────────────────────────
-- PHARMACY_PRODUCTS (table réelle : pharmacy_products)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "inventory_select"
  ON public.pharmacy_products FOR SELECT
  USING (availability_status = 'available' OR pharmacy_id IN (
    SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
  ));

CREATE POLICY "inventory_manage_own"
  ON public.pharmacy_products FOR ALL
  USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
    )
  )
  WITH CHECK (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- PRESCRIPTION_SHARES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "prescription_shares_select"
  ON public.prescription_shares FOR SELECT
  USING (
    shared_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
    )
    OR private.is_platform()
  );

CREATE POLICY "prescription_shares_insert_patient"
  ON public.prescription_shares FOR INSERT
  WITH CHECK (
    shared_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE patient_id IN (
        SELECT id FROM public.patients
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- PHARMACY_RESERVATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "reservations_select"
  ON public.pharmacy_reservations FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
    )
    OR private.is_platform()
  );

CREATE POLICY "reservations_insert_patient"
  ON public.pharmacy_reservations FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND status = 'draft'
  );

-- Pas d'UPDATE direct depuis le client — tous les changements de status passent par Edge Functions

-- ────────────────────────────────────────────────────────────
-- RESERVATION_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "reservation_items_select"
  ON public.reservation_items FOR SELECT
  USING (
    reservation_id IN (
      SELECT id FROM public.pharmacy_reservations
      WHERE patient_id IN (
        SELECT id FROM public.patients
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
      OR pharmacy_id IN (
        SELECT id FROM public.pharmacies WHERE organization_id = ANY(private.user_org_ids())
      )
    )
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- INSURANCE_PROVIDERS — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "insurance_providers_select"
  ON public.insurance_providers FOR SELECT
  USING (true);

CREATE POLICY "insurance_providers_manage_own"
  ON public.insurance_providers FOR UPDATE
  USING (organization_id = ANY(private.user_org_ids()))
  WITH CHECK (organization_id = ANY(private.user_org_ids()));

-- ────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  USING (
    deleted_at IS NULL AND (
      visibility = 'public'
      OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR patient_id IN (
        SELECT id FROM public.patients
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
      OR organization_id = ANY(private.user_org_ids())
      OR (visibility = 'shared' AND (
        private.professional_can_access_patient(patient_id)
        OR private.pharmacy_can_access_prescription(
          CASE WHEN entity_type = 'prescription' THEN entity_id ELSE NULL::uuid END
        )
      ))
      OR private.is_platform()
    )
  );

CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  WITH CHECK (
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "documents_soft_delete"
  ON public.documents FOR UPDATE
  USING (
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  )
  WITH CHECK (
    -- Seul deleted_at peut être mis à jour (soft delete)
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- ────────────────────────────────────────────────────────────
-- DOCUMENT_ACCESS_LOGS — insert par serveur uniquement
-- ────────────────────────────────────────────────────────────
CREATE POLICY "doc_logs_select"
  ON public.document_access_logs FOR SELECT
  USING (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- INSURANCE_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "insurance_members_select"
  ON public.insurance_members FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

CREATE POLICY "insurance_members_insert_mutual"
  ON public.insurance_members FOR INSERT
  WITH CHECK (
    organization_id = ANY(private.user_org_ids())
    AND private.current_role() = 'mutual_admin'
  );

-- status mis à jour uniquement côté serveur
CREATE POLICY "insurance_members_update_mutual"
  ON public.insurance_members FOR UPDATE
  USING (
    organization_id = ANY(private.user_org_ids())
    AND private.current_role() = 'mutual_admin'
  )
  WITH CHECK (
    organization_id = ANY(private.user_org_ids())
    AND status = (SELECT status FROM public.insurance_members WHERE id = insurance_members.id)
  );

-- ────────────────────────────────────────────────────────────
-- COVERAGE_RULES — lecture publique pour affiliés
-- ────────────────────────────────────────────────────────────
CREATE POLICY "coverage_rules_select"
  ON public.coverage_rules FOR SELECT
  USING (
    organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
    OR status = 'active'
  );

CREATE POLICY "coverage_rules_manage_mutual"
  ON public.coverage_rules FOR ALL
  USING (
    organization_id = ANY(private.user_org_ids())
    AND private.current_role() = 'mutual_admin'
  )
  WITH CHECK (
    organization_id = ANY(private.user_org_ids())
    AND private.current_role() = 'mutual_admin'
  );

-- ────────────────────────────────────────────────────────────
-- COVERAGE_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "coverage_requests_select"
  ON public.coverage_requests FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR organization_id = ANY(private.user_org_ids())
    OR insurance_provider_id IN (
      SELECT id FROM public.insurance_providers WHERE organization_id = ANY(private.user_org_ids())
    )
    OR private.is_platform()
  );

-- status géré exclusivement côté serveur

-- ────────────────────────────────────────────────────────────
-- COVERAGE_REQUEST_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "coverage_events_select"
  ON public.coverage_request_events FOR SELECT
  USING (
    coverage_request_id IN (
      SELECT id FROM public.coverage_requests
      WHERE patient_id IN (
        SELECT id FROM public.patients
        WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
      OR organization_id = ANY(private.user_org_ids())
    )
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- PAYMENT_PROVIDERS — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "payment_providers_select"
  ON public.payment_providers FOR SELECT
  USING (enabled = true OR private.is_platform());

-- ────────────────────────────────────────────────────────────
-- PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "payments_select"
  ON public.payments FOR SELECT
  USING (
    payer_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR recipient_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

-- Pas d'INSERT/UPDATE depuis le client — uniquement Edge Functions

-- ────────────────────────────────────────────────────────────
-- PAYMENT_EVENTS — serveur uniquement
-- ────────────────────────────────────────────────────────────
CREATE POLICY "payment_events_platform"
  ON public.payment_events FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- REFUNDS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "refunds_select"
  ON public.refunds FOR SELECT
  USING (
    requested_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

CREATE POLICY "refunds_insert"
  ON public.refunds FOR INSERT
  WITH CHECK (
    requested_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    -- status initial = 'requested' uniquement
    AND status = 'requested'
  );

-- ────────────────────────────────────────────────────────────
-- INVOICES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "invoices_select"
  ON public.invoices FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR organization_id = ANY(private.user_org_ids())
    OR professional_id IN (
      SELECT id FROM public.professionals
      WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- COMMISSION_ENTRIES & PAYOUTS — plateforme uniquement
-- ────────────────────────────────────────────────────────────
CREATE POLICY "commission_entries_select"
  ON public.commission_entries FOR SELECT
  USING (
    organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

CREATE POLICY "payouts_select"
  ON public.payouts FOR SELECT
  USING (
    organization_id = ANY(private.user_org_ids())
    OR beneficiary_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- REMINDERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "reminders_select"
  ON public.reminders FOR SELECT
  USING (
    recipient_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTION_PLANS — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "subscription_plans_select"
  ON public.subscription_plans FOR SELECT
  USING (public = true OR private.is_platform());

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT
  USING (
    organization_id = ANY(private.user_org_ids())
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

-- status géré par Edge Function Stripe webhook

-- ────────────────────────────────────────────────────────────
-- CREDIT_PACKS — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "credit_packs_select"
  ON public.credit_packs FOR SELECT
  USING (active = true OR private.is_platform());

-- ────────────────────────────────────────────────────────────
-- CREDIT_WALLETS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "credit_wallets_select"
  ON public.credit_wallets FOR SELECT
  USING (
    organization_id = ANY(private.user_org_ids())
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- AI_GENERATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "ai_generations_select"
  ON public.ai_generations FOR SELECT
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR organization_id = ANY(private.user_org_ids())
    OR private.is_platform()
  );

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid()
    OR private.is_platform()
  );

CREATE POLICY "notifications_mark_read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- PUSH_SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- AUDIT_LOGS — plateforme uniquement
-- ────────────────────────────────────────────────────────────
CREATE POLICY "audit_logs_platform"
  ON public.audit_logs FOR SELECT
  USING (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- PLATFORM_SETTINGS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "platform_settings_select"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "platform_settings_update"
  ON public.platform_settings FOR UPDATE
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- ROLES_PERMISSIONS — lecture publique
-- ────────────────────────────────────────────────────────────
CREATE POLICY "roles_permissions_select"
  ON public.roles_permissions FOR SELECT
  USING (true);

CREATE POLICY "roles_permissions_manage"
  ON public.roles_permissions FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- VERIFICATION_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "verification_requests_select"
  ON public.verification_requests FOR SELECT
  USING (
    submitted_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR private.is_platform()
  );

CREATE POLICY "verification_requests_insert"
  ON public.verification_requests FOR INSERT
  WITH CHECK (
    submitted_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND status = 'pending'
  );

-- ────────────────────────────────────────────────────────────
-- DATA_DELETION_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "deletion_requests_select"
  ON public.data_deletion_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR private.is_platform()
  );

CREATE POLICY "deletion_requests_insert"
  ON public.data_deletion_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'requested'
  );

-- ────────────────────────────────────────────────────────────
-- BLOG_POSTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "blog_posts_select"
  ON public.blog_posts FOR SELECT
  USING (status = 'published' OR private.is_platform());

CREATE POLICY "blog_posts_manage"
  ON public.blog_posts FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- TESTIMONIALS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "testimonials_select"
  ON public.testimonials FOR SELECT
  USING (approved = true OR private.is_platform());

CREATE POLICY "testimonials_insert"
  ON public.testimonials FOR INSERT
  WITH CHECK (true);

CREATE POLICY "testimonials_manage"
  ON public.testimonials FOR UPDATE
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- FAQ_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "faq_items_select"
  ON public.faq_items FOR SELECT
  USING (published = true OR private.is_platform());

CREATE POLICY "faq_items_manage"
  ON public.faq_items FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- CONTACT_MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "contact_messages_insert"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "contact_messages_select"
  ON public.contact_messages FOR SELECT
  USING (private.is_platform());

CREATE POLICY "contact_messages_update"
  ON public.contact_messages FOR UPDATE
  USING (private.is_platform())
  WITH CHECK (private.is_platform());

-- ────────────────────────────────────────────────────────────
-- CRON_JOB_RUNS — plateforme uniquement
-- ────────────────────────────────────────────────────────────
CREATE POLICY "cron_job_runs_platform"
  ON public.cron_job_runs FOR ALL
  USING (private.is_platform())
  WITH CHECK (private.is_platform());
