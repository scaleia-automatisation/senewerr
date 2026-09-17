-- ============================================================
-- 0003_tables_identity.sql — Identité & Organisations
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROFILES (1:1 auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  public.user_role NOT NULL,
  first_name            text,
  last_name             text,
  phone                 text UNIQUE,
  email                 citext UNIQUE,
  avatar_url            text,
  date_of_birth         date,
  gender                text CHECK (gender IN ('f','m','other')),
  address               text,
  city                  text,
  region                text,
  locale                text DEFAULT 'fr',
  status                public.account_status DEFAULT 'active',
  two_factor_enabled    boolean DEFAULT false,
  two_factor_secret_enc text, -- chiffré pgsodium
  last_login_at         timestamptz,
  onboarding_completed_at timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_status ON public.profiles(status) WHERE deleted_at IS NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Trigger : créer le profile automatiquement à l'inscription
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'patient'::public.user_role
  );

  INSERT INTO public.profiles (user_id, role, first_name, last_name, email, phone)
  VALUES (
    NEW.id,
    v_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email::citext,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

-- ────────────────────────────────────────────────────────────
-- ORGANIZATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                public.organization_type NOT NULL,
  name                text NOT NULL,
  slug                text UNIQUE,
  registration_number text,
  ninea               text,
  address             text,
  city                text,
  region              text,
  location            geography(Point,4326),
  phone               text,
  email               citext,
  logo_url            text,
  opening_hours       jsonb, -- {mon:[["08:00","20:00"]],…}
  status              public.account_status DEFAULT 'active',
  verification_status public.verification_status DEFAULT 'pending',
  verified_at         timestamptz,
  verified_by         uuid REFERENCES public.profiles(id),
  rejection_reason    text,
  owner_profile_id    uuid REFERENCES public.profiles(id),
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_organizations_location ON public.organizations USING GIST (location);
CREATE INDEX idx_organizations_type_verif ON public.organizations(type, verification_status);
CREATE INDEX idx_organizations_status ON public.organizations(status) WHERE deleted_at IS NULL;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ORGANIZATION_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.organization_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role                  public.membership_role NOT NULL,
  status                public.membership_status DEFAULT 'invited',
  invited_by            uuid REFERENCES public.profiles(id),
  invitation_token_hash text,
  invitation_expires_at timestamptz,
  joined_at             timestamptz,
  removed_at            timestamptz,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX idx_org_members_profile ON public.organization_members(profile_id, status);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id, status);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ESTABLISHMENTS (1:1 organizations type='establishment')
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.establishments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  establishment_type public.establishment_type NOT NULL,
  description        text,
  rooms_count        int DEFAULT 1,
  accepts_walk_in    boolean DEFAULT false,
  created_at         timestamptz DEFAULT now() NOT NULL,
  updated_at         timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_establishments_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ESTABLISHMENT_SERVICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.establishment_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.establishment_services ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_est_services_updated_at
  BEFORE UPDATE ON public.establishment_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ESTABLISHMENT_ROOMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.establishment_rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.establishment_rooms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_est_rooms_updated_at
  BEFORE UPDATE ON public.establishment_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PHARMACIES (1:1 organizations type='pharmacy')
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.pharmacies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_number         text NOT NULL,
  on_duty                boolean DEFAULT false,
  accepts_insurance      boolean DEFAULT true,
  preparation_sla_minutes int DEFAULT 120,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pharmacies_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- INSURANCE_PROVIDERS (1:1 organizations type='insurance_provider')
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.insurance_providers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_number   text,
  payment_model     text DEFAULT 'tiers_payant'
    CHECK (payment_model IN ('tiers_payant','remboursement')),
  payment_delay_days int DEFAULT 30,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.insurance_providers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_insurance_providers_updated_at
  BEFORE UPDATE ON public.insurance_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
