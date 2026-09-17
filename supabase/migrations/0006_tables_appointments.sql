-- ============================================================
-- 0006_tables_appointments.sql — RDV & Consultation
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.appointments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number  text UNIQUE,
  patient_id          uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  beneficiary_id      uuid REFERENCES public.beneficiaries(id),
  professional_id     uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  establishment_id    uuid NOT NULL REFERENCES public.establishments(id) ON DELETE RESTRICT,
  slot_id             uuid UNIQUE NOT NULL REFERENCES public.appointment_slots(id),
  room_id             uuid REFERENCES public.establishment_rooms(id),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  appointment_type    public.appointment_type DEFAULT 'in_person',
  reason              text,
  status              public.appointment_status DEFAULT 'confirmed',
  price               integer DEFAULT 0,
  payment_status      public.patient_payment_status DEFAULT 'not_required',
  payment_id          uuid, -- FK payments (migration 0008)
  patient_notes       text,
  internal_notes      text,
  arrived_at          timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  cancelled_by        uuid REFERENCES public.profiles(id),
  rescheduled_from_id uuid REFERENCES public.appointments(id),
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at  timestamptz,
  created_by          uuid REFERENCES public.profiles(id),
  created_by_role     public.user_role,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_appointments_patient_starts ON public.appointments(patient_id, starts_at);
CREATE INDEX idx_appointments_professional_starts ON public.appointments(professional_id, starts_at);
CREATE INDEX idx_appointments_establishment_starts ON public.appointments(establishment_id, starts_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère RDV-######
CREATE OR REPLACE FUNCTION public.generate_appointment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.appointment_number IS NULL THEN
    NEW.appointment_number := private.next_number('RDV-');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_appointment_number
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.generate_appointment_number();

-- FK différée : appointment_slots.appointment_id → appointments
ALTER TABLE public.appointment_slots
  ADD CONSTRAINT fk_slots_appointment
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- FK différée : patient_professional_access.appointment_id → appointments
ALTER TABLE public.patient_professional_access
  ADD CONSTRAINT fk_ppa_appointment
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- APPOINTMENT_STATUS_HISTORY
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.appointment_status_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  old_status     public.appointment_status,
  new_status     public.appointment_status NOT NULL,
  changed_by     uuid REFERENCES public.profiles(id),
  changed_by_role public.user_role,
  reason         text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_appt_status_history ON public.appointment_status_history(appointment_id, created_at);

ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- CONSULTATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.consultations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id              uuid UNIQUE NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id                  uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  beneficiary_id              uuid REFERENCES public.beneficiaries(id),
  professional_id             uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  establishment_id            uuid NOT NULL REFERENCES public.establishments(id) ON DELETE RESTRICT,
  started_at                  timestamptz,
  ended_at                    timestamptz,
  reason                      text,
  clinical_notes              text, -- visible uniquement professionnel + patient si notes_shared_with_patient
  notes_shared_with_patient   boolean DEFAULT false,
  diagnosis                   text,
  treatment_plan              text,
  summary                     text,
  summary_generated_by_ai     boolean DEFAULT false,
  transcript_document_id      uuid, -- FK documents migration 0009
  status                      public.consultation_status DEFAULT 'in_progress',
  exam_requests               text[],
  created_at                  timestamptz DEFAULT now() NOT NULL,
  updated_at                  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_consultations_patient ON public.consultations(patient_id);
CREATE INDEX idx_consultations_pro_started ON public.consultations(professional_id, started_at);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Trigger : deny_client_status_update
-- Aucun statut n'est jamais écrit depuis le frontend (RLS + trigger)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.deny_client_status_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Seule la connexion service_role peut modifier les statuts
  IF current_setting('role') != 'service_role' AND
     current_setting('role') != 'postgres' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'STATUS_UPDATE_FORBIDDEN: Le statut ne peut être modifié que par le serveur'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deny_appointment_status_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.deny_client_status_update();
