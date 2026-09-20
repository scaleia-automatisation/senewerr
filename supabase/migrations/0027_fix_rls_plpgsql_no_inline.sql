-- Fix infinite recursion: rewrite private helper functions in PL/pgSQL
-- (SQL STABLE functions can be inlined by the planner, removing the
--  SECURITY DEFINER / row_security=off boundary).

-- ─── Role cache table (no RLS → no recursion possible) ───────────────────────
CREATE TABLE IF NOT EXISTS private.user_role_cache (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  profile_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Populate from existing profiles
INSERT INTO private.user_role_cache (user_id, role, profile_id)
SELECT user_id, role, id
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role,
      profile_id = EXCLUDED.profile_id,
      updated_at = now();

-- Trigger to keep cache in sync
CREATE OR REPLACE FUNCTION private.sync_user_role_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
BEGIN
  INSERT INTO private.user_role_cache(user_id, role, profile_id)
  VALUES (NEW.user_id, NEW.role, NEW.id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        profile_id = EXCLUDED.profile_id,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_cache ON public.profiles;
CREATE TRIGGER trg_sync_role_cache
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.sync_user_role_cache();

-- ─── Helper functions (read from cache, never from profiles) ─────────────────
CREATE OR REPLACE FUNCTION private.current_role()
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE v_role user_role;
BEGIN
  SELECT role INTO v_role FROM private.user_role_cache WHERE user_id = auth.uid();
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_platform()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
BEGIN
  RETURN private.current_role() IN ('platform_admin', 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION private.my_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT profile_id INTO v_id FROM private.user_role_cache WHERE user_id = auth.uid();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.professional_can_access_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE v_result boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.patient_professional_access ppa
    JOIN public.professionals pr ON pr.id = ppa.professional_id
    WHERE ppa.patient_id = p_patient_id
      AND pr.profile_id = (SELECT profile_id FROM private.user_role_cache WHERE user_id = auth.uid())
      AND ppa.revoked_at IS NULL
      AND (ppa.valid_until IS NULL OR ppa.valid_until > now())
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.pharmacy_can_access_prescription(p_prescription_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE v_result boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.prescription_shares ps
    JOIN public.pharmacies ph ON ph.id = ps.pharmacy_id
    JOIN public.organization_members om ON om.organization_id = ph.organization_id
    WHERE ps.prescription_id = p_prescription_id
      AND om.profile_id = (SELECT profile_id FROM private.user_role_cache WHERE user_id = auth.uid())
      AND om.status = 'active'
      AND ps.status = 'active'
      AND (ps.valid_until IS NULL OR ps.valid_until > now())
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.user_org_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE v_result uuid[];
BEGIN
  SELECT ARRAY(
    SELECT organization_id FROM public.organization_members
    WHERE profile_id = (SELECT profile_id FROM private.user_role_cache WHERE user_id = auth.uid())
      AND status = 'active'
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- ─── Permissions ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT SELECT ON private.user_role_cache TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.current_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_platform() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.my_profile_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.user_org_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.professional_can_access_patient(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.pharmacy_can_access_prescription(uuid) TO authenticated, anon;
