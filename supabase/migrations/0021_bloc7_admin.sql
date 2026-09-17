-- ============================================================
-- 0021_bloc7_admin.sql — Admin infrastructure (BLOC 7)
-- Tables: admin_notes (new) + missing seeds for existing tables
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ADMIN_NOTES (new)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  author_id   uuid REFERENCES public.profiles(id),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_notes_entity
  ON public.admin_notes(entity_type, entity_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_admin_notes_updated_at'
      AND tgrelid = 'public.admin_notes'::regclass
  ) THEN
    CREATE TRIGGER set_admin_notes_updated_at
      BEFORE UPDATE ON public.admin_notes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- PLATFORM_SETTINGS — missing keys (INSERT IGNORE)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('booking_delay_minutes',      '30',          'Délai mini (minutes) avant réservation'),
  ('payment_timeout_hours',      '24',          'Timeout paiement (heures)'),
  ('reminder_delays_days',       '[3, 7]',      'Jours avant rappels'),
  ('sla_pec_hours',              '24',          'SLA prise en charge (heures)'),
  ('withdrawal_code_attempts',   '5',           'Tentatives max code retrait'),
  ('default_commission_pct',     '5.0',         'Commission par défaut (%)'),
  ('usd_to_xof',                 '600',         'Taux de conversion USD/XOF'),
  ('maintenance_message',        '""',          'Message de maintenance'),
  ('founder_offer_enabled',      'true',        'Offre fondateur active'),
  ('allowed_email_domains',      '[]',          'Domaines email autorisés (vide = tous)'),
  ('ai_pricing',                 '{"gpt-4.1-mini":{"input_per_m":0.40,"output_per_m":1.60},"whisper-1":{"per_minute":0.006}}', 'Tarification IA')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- ROLES_PERMISSIONS — admin-specific permissions (INSERT IGNORE)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.roles_permissions (role, permission, enabled) VALUES
  -- platform_admin
  ('platform_admin', 'admin.view_platform_settings',  true),
  ('platform_admin', 'admin.view_admin_notes',        true),
  ('platform_admin', 'admin.write_admin_notes',       true),
  ('platform_admin', 'admin.view_verification_requests', true),
  ('platform_admin', 'admin.update_verification_requests', true),
  ('platform_admin', 'admin.send_reminders',          true),
  ('platform_admin', 'admin.view_audit_logs',         true),
  -- super_admin
  ('super_admin',    'admin.view_platform_settings',  true),
  ('super_admin',    'admin.update_platform_settings', true),
  ('super_admin',    'admin.delete_platform_settings', true),
  ('super_admin',    'admin.view_admin_notes',        true),
  ('super_admin',    'admin.write_admin_notes',       true),
  ('super_admin',    'admin.delete_admin_notes',      true),
  ('super_admin',    'admin.view_verification_requests', true),
  ('super_admin',    'admin.update_verification_requests', true),
  ('super_admin',    'admin.send_reminders',          true),
  ('super_admin',    'admin.view_audit_logs',         true),
  ('super_admin',    'super.manage_roles_permissions', true)
ON CONFLICT (role, permission) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — admin_notes
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_notes_select"   ON public.admin_notes;
DROP POLICY IF EXISTS "admin_notes_insert"   ON public.admin_notes;
DROP POLICY IF EXISTS "admin_notes_update"   ON public.admin_notes;
DROP POLICY IF EXISTS "admin_notes_delete"   ON public.admin_notes;

CREATE POLICY "admin_notes_select"
  ON public.admin_notes FOR SELECT
  USING (private.current_role() IN ('platform_admin', 'super_admin'));

CREATE POLICY "admin_notes_insert"
  ON public.admin_notes FOR INSERT
  WITH CHECK (private.current_role() IN ('platform_admin', 'super_admin'));

CREATE POLICY "admin_notes_update"
  ON public.admin_notes FOR UPDATE
  USING (private.current_role() IN ('platform_admin', 'super_admin'))
  WITH CHECK (private.current_role() IN ('platform_admin', 'super_admin'));

CREATE POLICY "admin_notes_delete"
  ON public.admin_notes FOR DELETE
  USING (private.current_role() = 'super_admin');

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — platform_settings (supplement if missing)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_settings'
      AND policyname = 'platform_settings_delete'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "platform_settings_delete"
        ON public.platform_settings FOR DELETE
        USING (private.current_role() = 'super_admin')
    $pol$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_settings'
      AND policyname = 'platform_settings_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "platform_settings_insert"
        ON public.platform_settings FOR INSERT
        WITH CHECK (private.current_role() = 'super_admin')
    $pol$;
  END IF;
END;
$$;
