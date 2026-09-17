-- ============================================================
-- 0013_tables_platform.sql — Plateforme, contenu, légal
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PLATFORM_SETTINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid REFERENCES public.profiles(id),
  updated_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Valeurs initiales (toutes les clés obligatoires du CDC §1.2.13)
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('reservation_payment_delay_hours',  '24',     'Délai max (heures) avant expiration de la réservation après demande de paiement'),
  ('reservation_share_validity_hours', '48',     'Validité (heures) d''un partage d''ordonnance vers pharmacie'),
  ('prescription_validity_days',        '90',     'Durée de validité par défaut d''une ordonnance (jours)'),
  ('coverage_sla_hours',               '24',     'SLA de traitement d''une demande de prise en charge (heures)'),
  ('reminder_intervals_hours',         '[24,72,168]', 'Intervalles (heures) pour les relances automatiques'),
  ('withdrawal_max_attempts',          '5',      'Nombre max d''essais de code de retrait avant verrouillage'),
  ('withdrawal_lockout_minutes',       '15',     'Durée (minutes) du verrouillage après trop d''essais'),
  ('appointment_cancellation_min_hours','2',     'Délai minimum (heures) pour annuler un RDV'),
  ('free_plan_appointments_monthly',   '20',     'Quota RDV mensuel plan gratuit professionnel'),
  ('commission_cap_default',           '5000',   'Plafond de commission par défaut (XOF)'),
  ('ai_usd_to_xof_rate',               '600',    'Taux de conversion USD → XOF pour coût IA'),
  ('maintenance_mode',                 'false',  'Active/désactive le mode maintenance'),
  ('founder_offer_active',             'true',   'Offre fondateur active (réduction plan + crédits bonus)');

-- ────────────────────────────────────────────────────────────
-- ROLES_PERMISSIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.roles_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       public.user_role NOT NULL,
  permission text NOT NULL,
  enabled    boolean DEFAULT true,
  UNIQUE (role, permission)
);

ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;

-- Fonction has_permission
CREATE OR REPLACE FUNCTION private.has_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.roles_permissions
     WHERE role = private.current_role()
       AND permission = p_permission),
    false
  );
$$;

-- ────────────────────────────────────────────────────────────
-- Fonctions utilitaires privées
-- ────────────────────────────────────────────────────────────

-- Rôle du JWT courant
CREATE OR REPLACE FUNCTION private.current_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- IDs des organisations actives de l'utilisateur
CREATE OR REPLACE FUNCTION private.user_org_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT organization_id FROM public.organization_members
    WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      AND status = 'active'
  );
$$;

-- Vérifie si admin plateforme
CREATE OR REPLACE FUNCTION private.is_platform()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT private.current_role() IN ('platform_admin','super_admin');
$$;

-- Accès professionnel → patient (via patient_professional_access valide)
CREATE OR REPLACE FUNCTION private.professional_can_access_patient(p_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.patient_professional_access ppa
    JOIN public.professionals pr ON pr.id = ppa.professional_id
    WHERE ppa.patient_id = p_patient_id
      AND pr.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      AND ppa.revoked_at IS NULL
      AND (ppa.valid_until IS NULL OR ppa.valid_until > now())
  );
$$;

-- Accès pharmacie → ordonnance (via prescription_shares actif)
CREATE OR REPLACE FUNCTION private.pharmacy_can_access_prescription(p_prescription_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.prescription_shares ps
    JOIN public.pharmacies ph ON ph.id = ps.pharmacy_id
    JOIN public.organization_members om ON om.organization_id = ph.organization_id
    WHERE ps.prescription_id = p_prescription_id
      AND om.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      AND om.status = 'active'
      AND ps.status = 'active'
      AND (ps.valid_until IS NULL OR ps.valid_until > now())
  );
$$;

-- ────────────────────────────────────────────────────────────
-- VERIFICATION_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.verification_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type      text NOT NULL CHECK (subject_type IN ('professional','organization')),
  subject_id        uuid NOT NULL,
  submitted_by      uuid NOT NULL REFERENCES public.profiles(id),
  documents         uuid[],
  status            public.verification_status DEFAULT 'pending',
  reviewed_by       uuid REFERENCES public.profiles(id),
  reviewed_at       timestamptz,
  decision_reason   text,
  requested_documents text[],
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_verification_requests_status ON public.verification_requests(status);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- DATA_DELETION_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.data_deletion_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz DEFAULT now(),
  status       public.deletion_request_status DEFAULT 'requested',
  processed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(id),
  notes        text
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- BLOG_POSTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.blog_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  excerpt           text,
  content_md        text,
  cover_image_url   text,
  author_name       text,
  target_keyword    text,
  secondary_keywords text[],
  meta_title        text,
  meta_description  text,
  angle             text,
  related_slugs     text[],
  published_at      timestamptz,
  status            text DEFAULT 'draft',
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TESTIMONIALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.testimonials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name   text NOT NULL,
  author_role   text,
  content       text NOT NULL,
  rating        int CHECK (rating BETWEEN 1 AND 5),
  approved      boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- FAQ_ITEMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.faq_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text NOT NULL,
  answer_md     text NOT NULL,
  category      text,
  display_order int DEFAULT 0,
  published     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- CONTACT_MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       citext NOT NULL,
  subject     text,
  message     text NOT NULL,
  status      text DEFAULT 'new',
  handled_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- CRON_JOB_RUNS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.cron_job_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        text NOT NULL,
  started_at      timestamptz DEFAULT now(),
  finished_at     timestamptz,
  status          text DEFAULT 'running',
  processed_count int DEFAULT 0,
  error_message   text
);

CREATE INDEX idx_cron_job_runs_name ON public.cron_job_runs(job_name, started_at DESC);

ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;
