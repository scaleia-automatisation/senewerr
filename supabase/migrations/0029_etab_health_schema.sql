-- ============================================================
-- 0029_etab_health_schema.sql
-- Schéma pour les établissements de santé (sections 2-3 CDC)
-- ============================================================

-- 1. Nouveau rôle utilisateur health_staff
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'health_staff';

-- 2. Colonnes manquantes sur establishment_rooms
ALTER TABLE public.establishment_rooms
  ADD COLUMN IF NOT EXISTS room_type       text    NOT NULL DEFAULT 'consultation',
  ADD COLUMN IF NOT EXISTS floor           int,
  ADD COLUMN IF NOT EXISTS capacity        int     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_id      uuid    REFERENCES public.establishment_services(id) ON DELETE SET NULL;

-- room_type valeurs attendues : consultation | examination | intervention | imaging | laboratory
-- | emergency | hospitalization | waiting | administrative

-- 3. Colonne service_id sur professional_establishments (affectation par service)
ALTER TABLE public.professional_establishments
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.establishment_services(id) ON DELETE SET NULL;

-- 4. Sub-rôle spécialisé sur organization_members (laborantin, radiologue, technicien…)
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS sub_role text;
-- Valeurs attendues : laboratory_director | laboratory_technician | laboratory_staff
--                     radiologist | technician_radiography | imaging_staff
--                     head_of_service | nurse | administrative

-- 5. Table establishment_departments
CREATE TABLE IF NOT EXISTS public.establishment_departments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      uuid        NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  code                  text,
  head_professional_id  uuid        REFERENCES public.professionals(id) ON DELETE SET NULL,
  description           text,
  active                boolean     DEFAULT true NOT NULL,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.establishment_departments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_establishment_departments_updated_at
  BEFORE UPDATE ON public.establishment_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. RLS — establishments
-- SELECT : membres actifs de l'organisation propriétaire
CREATE POLICY "establishments_select" ON public.establishments
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- UPDATE : admins/owners uniquement
CREATE POLICY "establishments_update" ON public.establishments
  FOR UPDATE USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- 7. RLS — establishment_services
CREATE POLICY "estab_services_select" ON public.establishment_services
  FOR SELECT USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
  );

CREATE POLICY "estab_services_manage" ON public.establishment_services
  FOR ALL USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- 8. RLS — establishment_rooms
CREATE POLICY "estab_rooms_select" ON public.establishment_rooms
  FOR SELECT USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
  );

CREATE POLICY "estab_rooms_manage" ON public.establishment_rooms
  FOR ALL USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- 9. RLS — professional_establishments
-- SELECT : professionnel lui-même OU membres actifs de l'établissement
CREATE POLICY "pro_estab_select" ON public.professional_establishments
  FOR SELECT USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p WHERE p.profile_id = auth.uid()
    )
    OR establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
  );

-- UPDATE (ex: accepter/refuser invitation) : professionnel concerné OU admin de l'établissement
CREATE POLICY "pro_estab_update" ON public.professional_establishments
  FOR UPDATE USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p WHERE p.profile_id = auth.uid()
    )
    OR establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- INSERT : admin/owner de l'établissement seulement (invitation)
CREATE POLICY "pro_estab_insert" ON public.professional_establishments
  FOR INSERT WITH CHECK (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- 10. RLS — establishment_departments
CREATE POLICY "estab_dept_select" ON public.establishment_departments
  FOR SELECT USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
  );

CREATE POLICY "estab_dept_manage" ON public.establishment_departments
  FOR ALL USING (
    establishment_id IN (
      SELECT e.id FROM public.establishments e
      WHERE e.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );
