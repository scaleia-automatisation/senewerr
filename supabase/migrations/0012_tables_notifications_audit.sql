-- ============================================================
-- 0012_tables_notifications_audit.sql — Notifications, Audit, Support
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DOMAIN_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.domain_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  actor_id      uuid REFERENCES public.profiles(id),
  actor_role    public.user_role,
  organization_id uuid REFERENCES public.organizations(id),
  patient_id    uuid REFERENCES public.patients(id),
  payload       jsonb DEFAULT '{}',
  processed_at  timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_domain_events_type ON public.domain_events(event_type, created_at);
CREATE INDEX idx_domain_events_entity ON public.domain_events(entity_type, entity_id);
CREATE INDEX idx_domain_events_unprocessed ON public.domain_events(processed_at) WHERE processed_at IS NULL;

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- NOTIFICATION_TEMPLATES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notification_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          text NOT NULL,
  recipient_role      public.user_role NOT NULL,
  channel             public.notification_channel NOT NULL,
  title_template      text NOT NULL,
  message_template    text NOT NULL,
  action_url_template text,
  priority            public.notification_priority DEFAULT 'normal',
  enabled             boolean DEFAULT true,
  locale              text DEFAULT 'fr',
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  UNIQUE (event_type, recipient_role, channel, locale)
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_notif_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  event_id      uuid REFERENCES public.domain_events(id),
  type          text NOT NULL,
  title         text NOT NULL,
  message       text NOT NULL,
  cause         text,
  entity_type   text,
  entity_id     uuid,
  priority      public.notification_priority DEFAULT 'normal',
  action_url    text,
  read_at       timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- NOTIFICATION_DELIVERIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notification_deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id   uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel           public.notification_channel NOT NULL,
  provider          text, -- resend, fcm…
  provider_message_id text,
  status            public.delivery_status DEFAULT 'queued',
  error_message     text,
  sent_at           timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_notif_deliveries_status ON public.notification_deliveries(status, created_at)
  WHERE status = 'queued';

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- NOTIFICATION_PREFERENCES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notification_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled   boolean DEFAULT true,
  push_enabled    boolean DEFAULT true,
  quiet_hours     jsonb DEFAULT '{"from":"22:00","to":"07:00"}',
  categories      jsonb DEFAULT '{"appointments":true,"payments":true,"pharmacy":true,"insurance":true,"marketing":false}',
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- EMAIL_LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.email_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.profiles(id),
  to_email          citext NOT NULL,
  template_key      text NOT NULL,
  sequence_key      text,
  resend_message_id text,
  status            public.delivery_status DEFAULT 'queued',
  error_message     text,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_email_logs_user ON public.email_logs(user_id, created_at);
CREATE INDEX idx_email_logs_template ON public.email_logs(template_key, created_at);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- EMAIL_SEQUENCES_STATE
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.email_sequences_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sequence_key  text NOT NULL,
  step          int NOT NULL DEFAULT 0,
  next_send_at  timestamptz,
  stopped_at    timestamptz,
  stop_reason   text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, sequence_key)
);

ALTER TABLE public.email_sequences_state ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_email_seq_updated_at
  BEFORE UPDATE ON public.email_sequences_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PUSH_SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    text UNIQUE NOT NULL,
  keys        jsonb NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- AUDIT_LOGS (append-only — aucune UPDATE/DELETE même super_admin)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES public.profiles(id),
  actor_role    public.user_role,
  organization_id uuid REFERENCES public.organizations(id),
  action        text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  patient_id    uuid,
  old_values    jsonb,
  new_values    jsonb,
  result        text NOT NULL CHECK (result IN ('success','denied','error')),
  cause         text,
  ip_address    inet,
  user_agent    text,
  request_id    text,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_logs_patient ON public.audit_logs(patient_id, created_at);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- SECURITY_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.security_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  user_id     uuid REFERENCES public.profiles(id),
  ip_address  inet,
  user_agent  text,
  details     jsonb DEFAULT '{}',
  severity    public.notification_priority DEFAULT 'normal',
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_security_events_type ON public.security_events(event_type, created_at);
CREATE INDEX idx_security_events_user ON public.security_events(user_id, created_at) WHERE user_id IS NOT NULL;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- LOGIN_ATTEMPTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  ip_address inet,
  success    boolean NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_login_attempts_identifier ON public.login_attempts(identifier, created_at);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- DISPUTES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_number   text UNIQUE, -- LIT-#####
  created_by       uuid NOT NULL REFERENCES public.profiles(id),
  created_by_role  public.user_role NOT NULL,
  organization_id  uuid REFERENCES public.organizations(id),
  patient_id       uuid REFERENCES public.patients(id),
  reservation_id   uuid REFERENCES public.pharmacy_reservations(id),
  appointment_id   uuid REFERENCES public.appointments(id),
  payment_id       uuid REFERENCES public.payments(id),
  category         public.dispute_category NOT NULL,
  description      text NOT NULL,
  status           public.dispute_status DEFAULT 'open',
  assigned_to      uuid REFERENCES public.profiles(id),
  resolution       text,
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère LIT-#####
CREATE OR REPLACE FUNCTION public.generate_dispute_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dispute_number IS NULL THEN
    NEW.dispute_number := 'LIT-' || lpad(
      (SELECT count(*) + 1 FROM public.disputes)::text, 5, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_dispute_number
  BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.generate_dispute_number();

-- ────────────────────────────────────────────────────────────
-- DISPUTE_MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.dispute_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id),
  author_role public.user_role,
  message     text NOT NULL,
  internal    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_dispute_messages_dispute ON public.dispute_messages(dispute_id, created_at);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- INTERNAL_NOTES (admin/super_admin)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.internal_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  author_id   uuid NOT NULL REFERENCES public.profiles(id),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_internal_notes_entity ON public.internal_notes(entity_type, entity_id);

ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- MESSAGES (Phase 2 — table créée, écran non construit)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id),
  recipient_type  text,
  recipient_id    uuid,
  body            text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_key, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- emit_event : insère domain_events (appelé par Edge Functions)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.emit_event(
  p_type        text,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_payload     jsonb DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.domain_events (event_type, entity_type, entity_id, payload)
  VALUES (p_type, p_entity_type, p_entity_id, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- audit() : insère audit_logs (appelé par Edge Functions)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.audit(
  p_action      text,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_old         jsonb DEFAULT NULL,
  p_new         jsonb DEFAULT NULL,
  p_result      text DEFAULT 'success',
  p_cause       text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, old_values, new_values, result, cause
  ) VALUES (
    p_action, p_entity_type, p_entity_id, p_old, p_new, p_result, p_cause
  );
END;
$$;
