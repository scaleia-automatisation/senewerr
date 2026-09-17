-- ============================================================
-- 0005_tables_professionals.sql — Professionnels & Planning
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROFESSIONALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.professionals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_number text UNIQUE,
  professional_type   public.professional_type NOT NULL,
  order_number        text, -- n° ordre professionnel
  specialty           text NOT NULL,
  sub_specialties     text[],
  bio                 text,
  languages           text[] DEFAULT '{fr}',
  consultation_fee    integer DEFAULT 0,
  teleconsultation_enabled boolean DEFAULT false,
  accepted_insurers   uuid[], -- ids insurance_providers
  verification_status public.verification_status DEFAULT 'pending',
  verified_at         timestamptz,
  verified_by         uuid REFERENCES public.profiles(id),
  rejection_reason    text,
  rating_avg          numeric(2,1),
  rating_count        int DEFAULT 0,
  search_vector       tsvector GENERATED ALWAYS AS (
    to_tsvector('french',
      coalesce(specialty,'') || ' ' ||
      coalesce(array_to_string(sub_specialties,' '),'') || ' ' ||
      coalesce(bio,'')
    )
  ) STORED,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_professionals_search ON public.professionals USING GIN (search_vector);
CREATE INDEX idx_professionals_specialty ON public.professionals(specialty);
CREATE INDEX idx_professionals_verif ON public.professionals(verification_status);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère PRO-######
CREATE OR REPLACE FUNCTION public.generate_professional_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.professional_number IS NULL THEN
    NEW.professional_number := private.next_number('PRO-');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_professional_number
  BEFORE INSERT ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.generate_professional_number();

-- FK différée vers professionals depuis patient_professional_access
ALTER TABLE public.patient_professional_access
  ADD CONSTRAINT fk_ppa_professional
  FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- PROFESSIONAL_QUALIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.professional_qualifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id     uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  qualification_type  text CHECK (qualification_type IN ('diplome','certification','experience')),
  title               text NOT NULL,
  institution         text,
  year                int,
  document_id         uuid, -- FK documents créée migration 0009
  verification_status public.verification_status DEFAULT 'pending',
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.professional_qualifications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_prof_qualif_updated_at
  BEFORE UPDATE ON public.professional_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PROFESSIONAL_ESTABLISHMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.professional_establishments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id       uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  establishment_id      uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  role                  text DEFAULT 'praticien',
  status                public.membership_status DEFAULT 'invited',
  invited_by            uuid REFERENCES public.profiles(id),
  invitation_token_hash text,
  invitation_expires_at timestamptz,
  start_date            date,
  end_date              date,
  refusal_reason        text,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,
  UNIQUE (professional_id, establishment_id)
);

CREATE INDEX idx_pro_est_professional ON public.professional_establishments(professional_id);
CREATE INDEX idx_pro_est_establishment ON public.professional_establishments(establishment_id);

ALTER TABLE public.professional_establishments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pro_est_updated_at
  BEFORE UPDATE ON public.professional_establishments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- SCHEDULE_PROPOSALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.schedule_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id  uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  proposed_by      uuid NOT NULL REFERENCES public.profiles(id),
  slots            jsonb NOT NULL, -- [{day_of_week,start_time,end_time,appointment_duration}]
  message          text,
  status           public.schedule_proposal_status DEFAULT 'proposed',
  responded_at     timestamptz,
  refusal_reason   text,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.schedule_proposals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON public.schedule_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- SCHEDULES (agenda maître)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.schedules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id      uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  establishment_id     uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  day_of_week          smallint CHECK (day_of_week BETWEEN 0 AND 6),
  start_time           time NOT NULL,
  end_time             time NOT NULL,
  appointment_duration int DEFAULT 30,
  buffer_minutes       int DEFAULT 0,
  recurrence_type      public.schedule_recurrence DEFAULT 'weekly',
  specific_date        date, -- si recurrence_type = 'once'
  valid_from           date NOT NULL,
  valid_until          date,
  status               text DEFAULT 'active',
  created_by           uuid REFERENCES public.profiles(id),
  proposal_id          uuid REFERENCES public.schedule_proposals(id),
  deleted_at           timestamptz,
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT schedules_times_check CHECK (start_time < end_time)
);

CREATE INDEX idx_schedules_professional_day ON public.schedules(professional_id, day_of_week);
CREATE INDEX idx_schedules_establishment ON public.schedules(establishment_id);
CREATE INDEX idx_schedules_active ON public.schedules(professional_id, valid_from, valid_until) WHERE deleted_at IS NULL;

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation anti-chevauchement (vérification applicative dans Edge Function + contrainte SQL)
CREATE OR REPLACE FUNCTION private.check_schedule_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_conflict int;
BEGIN
  IF NEW.recurrence_type = 'weekly' THEN
    SELECT COUNT(*) INTO v_conflict
    FROM public.schedules
    WHERE professional_id = NEW.professional_id
      AND establishment_id = NEW.establishment_id
      AND day_of_week = NEW.day_of_week
      AND recurrence_type = 'weekly'
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND NOT (NEW.end_time <= start_time OR NEW.start_time >= end_time)
      AND NOT (valid_until < NEW.valid_from OR NEW.valid_until < valid_from);

    IF v_conflict > 0 THEN
      RAISE EXCEPTION 'SCHEDULE_OVERLAP: Planning en conflit avec un créneau existant'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_schedule_overlap
  BEFORE INSERT OR UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION private.check_schedule_overlap();

-- ────────────────────────────────────────────────────────────
-- SCHEDULE_EXCEPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.schedule_exceptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id             uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  establishment_id            uuid REFERENCES public.establishments(id),
  exception_type              public.exception_type NOT NULL,
  date                        date NOT NULL,
  start_time                  time,
  end_time                    time,
  reason                      text,
  replacement_professional_id uuid REFERENCES public.professionals(id),
  created_by                  uuid REFERENCES public.profiles(id),
  affected_appointments_count int DEFAULT 0,
  created_at                  timestamptz DEFAULT now() NOT NULL,
  updated_at                  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_schedule_exceptions_pro_date ON public.schedule_exceptions(professional_id, date);

ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_exceptions_updated_at
  BEFORE UPDATE ON public.schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- APPOINTMENT_SLOTS (créneaux matérialisés)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.appointment_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  schedule_id     uuid REFERENCES public.schedules(id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  status          text DEFAULT 'available'
    CHECK (status IN ('available','booked','blocked')),
  appointment_id  uuid, -- FK vers appointments créée migration 0006
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL,
  UNIQUE (professional_id, starts_at)
);

CREATE INDEX idx_slots_professional_starts ON public.appointment_slots(professional_id, starts_at);
CREATE INDEX idx_slots_establishment_starts ON public.appointment_slots(establishment_id, starts_at);
CREATE INDEX idx_slots_status ON public.appointment_slots(status) WHERE status = 'available';

ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_slots_updated_at
  BEFORE UPDATE ON public.appointment_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
