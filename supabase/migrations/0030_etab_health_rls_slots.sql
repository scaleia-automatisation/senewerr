-- ============================================================
-- 0030_etab_health_rls_slots.sql
-- Policies RLS manquantes pour section 4 dashboard établissement
-- ============================================================

-- 1. appointment_slots — membres de l'organisation voient les créneaux
CREATE POLICY "slots_select_estab"
  ON public.appointment_slots FOR SELECT
  USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
    OR professional_id IN (
      SELECT p.id FROM public.professionals p WHERE p.profile_id = auth.uid()
    )
    OR private.is_platform()
  );

-- 2. schedule_exceptions — admins de l'établissement peuvent voir/créer les exceptions
CREATE POLICY "schedule_exceptions_estab_select"
  ON public.schedule_exceptions FOR SELECT
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p WHERE p.profile_id = auth.uid()
    )
    OR (
      establishment_id IS NOT NULL
      AND establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid() AND om.status = 'active'
        )
      )
    )
    OR private.is_platform()
  );

CREATE POLICY "schedule_exceptions_estab_insert"
  ON public.schedule_exceptions FOR INSERT
  WITH CHECK (
    professional_id IN (
      SELECT p.id FROM public.professionals p WHERE p.profile_id = auth.uid()
    )
    OR (
      establishment_id IS NOT NULL
      AND establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('owner', 'admin')
        )
      )
    )
  );

-- 3. prescriptions — admins de l'établissement voient les ordonnances des pros rattachés
CREATE POLICY "prescriptions_select_estab"
  ON public.prescriptions FOR SELECT
  USING (
    professional_id IN (
      SELECT pe.professional_id FROM public.professional_establishments pe
      WHERE pe.establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid() AND om.status = 'active'
        )
      )
      AND pe.status = 'active'
    )
  );
