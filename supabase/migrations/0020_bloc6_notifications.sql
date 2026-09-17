-- ============================================================
-- MIGRATION 0020 — BLOC 6: Notification Engine & SQL Views
-- ============================================================
-- Actual schema discovered:
--   notification_channel enum: in_app | email | push | sms | whatsapp
--   delivery_status enum:      queued | sent | delivered | failed | skipped
--   notification_priority enum: low | normal | high | critical
--   user_role enum: patient | professional | establishment_admin |
--                   establishment_staff | pharmacy_admin | pharmacy_staff |
--                   mutual_admin | mutual_staff | platform_admin | super_admin
--   organization_type enum: establishment | pharmacy | insurance_provider
--   establishment_type enum: cabinet | clinique | hopital | centre_medical |
--                             laboratoire | centre_imagerie  (no 'pharmacy')
--   pharmacies table: id, organization_id, license_number, ...
--   pharmacy_reservations.pharmacy_id → pharmacies.id
--   preparation_status enum: not_started | preparing | ready
--   UNIQUE on notification_templates: (event_type, recipient_role, channel, locale)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. NOTIFICATION_TEMPLATES — add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notification_templates
  ADD COLUMN IF NOT EXISTS badge_category text;

-- ─────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS — add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_type     text,
  ADD COLUMN IF NOT EXISTS badge_category text,
  ADD COLUMN IF NOT EXISTS data           jsonb DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 3. NOTIFICATION_DELIVERIES — add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS recipient_email             text,
  ADD COLUMN IF NOT EXISTS recipient_push_subscription jsonb,
  ADD COLUMN IF NOT EXISTS attempts                    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error                  text,
  ADD COLUMN IF NOT EXISTS scheduled_at                timestamptz DEFAULT now();

-- ─────────────────────────────────────────────────────────────
-- 4. NOTIFICATION_PREFERENCES — add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_exceptions text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS push_exceptions  text[] DEFAULT ARRAY[]::text[];

-- ─────────────────────────────────────────────────────────────
-- 5. RLS POLICIES — add missing ones (idempotent via DO block)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='notification_templates' AND policyname='notif_tmpl_platform') THEN
    EXECUTE 'CREATE POLICY notif_tmpl_platform ON public.notification_templates FOR ALL USING (private.is_platform())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='notification_templates' AND policyname='notif_tmpl_read') THEN
    EXECUTE 'CREATE POLICY notif_tmpl_read ON public.notification_templates FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='notification_deliveries' AND policyname='deliveries_platform') THEN
    EXECUTE 'CREATE POLICY deliveries_platform ON public.notification_deliveries FOR ALL USING (private.is_platform())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='notification_preferences' AND policyname='notif_prefs_own') THEN
    EXECUTE 'CREATE POLICY notif_prefs_own ON public.notification_preferences FOR ALL USING (user_id = auth.uid() OR private.is_platform())';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_profile
  ON public.notifications(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL AND deleted_at IS NULL;

-- delivery_status enum: queued | sent | delivered | failed | skipped
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_queued
  ON public.notification_deliveries(scheduled_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_notif_templates_event
  ON public.notification_templates(event_type, recipient_role, enabled);

-- ─────────────────────────────────────────────────────────────
-- 7. SQL VIEWS
-- ─────────────────────────────────────────────────────────────

-- v_pharmacy_todo: task counters for pharmacy dashboard
-- pharmacies table: id, organization_id, ...
-- pharmacy_reservations.pharmacy_id → pharmacies.id
CREATE OR REPLACE VIEW public.v_pharmacy_todo AS
SELECT
  p.id              AS pharmacy_id,
  p.organization_id,
  COUNT(DISTINCT CASE WHEN pr.prescription_check_status = 'pending'                                    THEN pr.id END) AS prescriptions_to_verify,
  COUNT(DISTINCT CASE WHEN pr.pharmacy_status = 'pending'                                              THEN pr.id END) AS reservations_to_accept,
  COUNT(DISTINCT CASE WHEN pr.patient_payment_status = 'pending'
                       AND pr.pharmacy_status = 'confirmed'                                            THEN pr.id END) AS patient_payments_pending,
  COUNT(DISTINCT CASE WHEN pr.mutual_payment_status  = 'pending'
                       AND pr.pharmacy_status = 'confirmed'                                            THEN pr.id END) AS mutual_payments_pending,
  COUNT(DISTINCT CASE WHEN pr.preparation_status = 'not_started'
                       AND pr.pharmacy_status = 'confirmed'                                            THEN pr.id END) AS orders_to_prepare,
  COUNT(DISTINCT CASE WHEN pr.preparation_status = 'ready'
                       AND pr.withdrawal_status = 'pending'                                            THEN pr.id END) AS orders_ready
FROM public.pharmacies p
LEFT JOIN public.pharmacy_reservations pr
  ON pr.pharmacy_id = p.id
  AND pr.status NOT IN ('cancelled','expired')
GROUP BY p.id, p.organization_id;

-- v_mutual_todo: task counters for insurance/mutual dashboard
-- insurance_members.status enum: to_verify | verified | rejected | expired
-- coverage_requests.status: pending | under_review | approved | ... | paid | cancelled
CREATE OR REPLACE VIEW public.v_mutual_todo AS
SELECT
  o.id AS organization_id,
  COUNT(DISTINCT CASE WHEN im.status = 'to_verify'                                                     THEN im.id END) AS members_to_verify,
  COUNT(DISTINCT CASE WHEN cr.status = 'pending'                                                       THEN cr.id END) AS coverage_requests_pending,
  COUNT(DISTINCT CASE WHEN cr.status = 'approved' AND cr.payment_id IS NULL                           THEN cr.id END) AS payments_to_make,
  COUNT(DISTINCT CASE WHEN cr.status = 'approved' AND cr.payment_id IS NOT NULL
                       AND date_trunc('month', cr.updated_at) = date_trunc('month', now())             THEN cr.id END) AS payments_made_month,
  COUNT(DISTINCT CASE WHEN cr.status = 'pending'
                       AND now() - cr.created_at > interval '24 hours'                                THEN cr.id END) AS overdue_requests
FROM public.organizations o
LEFT JOIN public.insurance_members im ON im.insurance_provider_id = o.id
LEFT JOIN public.coverage_requests cr ON cr.insurance_provider_id = o.id
WHERE o.type = 'insurance_provider'
GROUP BY o.id;

-- v_admin_todo: platform-wide task counters (scalar subqueries)
-- organizations.verification_status: pending | verified | rejected | suspended
-- payments.status enum: pending | processing | paid | failed | cancelled | ...
CREATE OR REPLACE VIEW public.v_admin_todo AS
SELECT
  (SELECT COUNT(*) FROM public.organizations
   WHERE verification_status = 'pending'
     AND type = 'pharmacy')                                         AS pharmacies_to_verify,
  (SELECT COUNT(*) FROM public.organizations
   WHERE verification_status = 'pending'
     AND type = 'insurance_provider')                               AS mutuelles_to_verify,
  (SELECT COUNT(*) FROM public.organizations
   WHERE verification_status = 'pending'
     AND type = 'establishment')                                    AS establishments_to_verify,
  (SELECT COUNT(*) FROM public.coverage_requests
   WHERE status = 'pending'
     AND now() - created_at > interval '24 hours')                 AS overdue_coverage,
  (SELECT COUNT(*) FROM public.payments
   WHERE status = 'pending'
     AND now() - created_at > interval '48 hours')                 AS payments_prolonged;

-- v_pro_today: today's appointment counters per professional
-- appointments.starts_at (not scheduled_at)
CREATE OR REPLACE VIEW public.v_pro_today AS
SELECT
  a.professional_id,
  COUNT(*)                                                          AS appointments_today,
  COUNT(CASE WHEN a.status = 'patient_arrived' THEN 1 END)         AS patients_arrived,
  COUNT(CASE WHEN a.status = 'in_consultation' THEN 1 END)         AS in_consultation
FROM public.appointments a
WHERE date_trunc('day', a.starts_at) = date_trunc('day', now())
  AND a.status NOT IN (
    'cancelled_patient','cancelled_professional',
    'cancelled_establishment','no_show'
  )
GROUP BY a.professional_id;

-- v_establishment_today: today's appointment counters per establishment
CREATE OR REPLACE VIEW public.v_establishment_today AS
SELECT
  a.establishment_id,
  COUNT(*)                                                          AS appointments_today,
  COUNT(CASE WHEN a.status = 'patient_arrived' THEN 1 END)         AS patients_arrived,
  COUNT(CASE WHEN a.status = 'confirmed'       THEN 1 END)         AS confirmed_slots,
  COUNT(CASE WHEN a.status = 'in_consultation' THEN 1 END)         AS in_consultation
FROM public.appointments a
WHERE date_trunc('day', a.starts_at) = date_trunc('day', now())
  AND a.status NOT IN (
    'cancelled_patient','cancelled_professional',
    'cancelled_establishment','no_show'
  )
GROUP BY a.establishment_id;

-- ─────────────────────────────────────────────────────────────
-- 8. DISPATCH FUNCTION (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────
-- channel enum uses 'in_app' (not 'app')
-- notifications uses: user_id, message, type (not profile_id, body)

CREATE OR REPLACE FUNCTION public.dispatch_notification(
  p_event_type     text,
  p_recipient_id   uuid,         -- maps to notifications.user_id
  p_recipient_role text          DEFAULT NULL,
  p_data           jsonb         DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tmpl     record;
  v_notif_id uuid;
BEGIN
  SELECT * INTO v_tmpl
  FROM public.notification_templates
  WHERE event_type = p_event_type
    AND channel    = 'in_app'
    AND enabled    = true
    AND (p_recipient_role IS NULL OR recipient_role::text = p_recipient_role)
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    event_type,
    badge_category,
    priority,
    data,
    title,
    message
  ) VALUES (
    p_recipient_id,
    p_event_type,
    p_event_type,
    v_tmpl.badge_category,
    v_tmpl.priority,
    p_data,
    v_tmpl.title_template,
    v_tmpl.message_template
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. SEED — notification_templates routing matrix
-- ─────────────────────────────────────────────────────────────
-- channel values: in_app | email | push  (not 'app')
-- UNIQUE (event_type, recipient_role, channel, locale); locale NULL = default locale

INSERT INTO public.notification_templates
  (event_type, recipient_role, channel, priority, title_template, message_template, badge_category, enabled)
VALUES
-- ── PATIENT: Appointments ───────────────────────────────────
('APPOINTMENT_CREATED',      'patient',      'in_app', 'normal',   'Rendez-vous confirmé',         'Votre rendez-vous avec {{professional_name}} est confirmé : {{date}} à {{time}}, {{establishment}}.', 'Rendez-vous', true),
('APPOINTMENT_CREATED',      'patient',      'email',  'normal',   'Rendez-vous confirmé',         'Votre rendez-vous avec {{professional_name}} est confirmé : {{date}} à {{time}}, {{establishment}}.', 'Rendez-vous', true),
('APPOINTMENT_CREATED',      'professional', 'in_app', 'normal',   'Nouveau rendez-vous',          'Nouveau rendez-vous : {{patient_name}} le {{date}} à {{time}} — {{establishment}}.', 'Agenda', true),
('APPOINTMENT_CREATED',      'professional', 'email',  'normal',   'Nouveau rendez-vous',          'Nouveau rendez-vous : {{patient_name}} le {{date}} à {{time}} — {{establishment}}.', 'Agenda', true),

('APPOINTMENT_REMINDER_24H', 'patient',      'in_app', 'normal',   'Rappel rendez-vous',           'Rappel : rendez-vous demain à {{time}} avec Dr {{professional_name}}.', 'Rendez-vous', true),
('APPOINTMENT_REMINDER_24H', 'patient',      'email',  'normal',   'Rappel rendez-vous',           'Rappel : rendez-vous demain à {{time}} avec Dr {{professional_name}}.', 'Rendez-vous', true),

('APPOINTMENT_REMINDER_1H',  'patient',      'push',   'high',     'Rendez-vous dans 1h',          'Votre rendez-vous est dans 1 h. [Je suis arrivé] sera disponible sur place.', 'Rendez-vous', true),

('APPOINTMENT_CANCELLED',    'patient',      'in_app', 'high',     'Rendez-vous annulé',           'Votre rendez-vous du {{date}} a été annulé par {{actor}} : {{reason}}.', 'Rendez-vous', true),
('APPOINTMENT_CANCELLED',    'patient',      'email',  'high',     'Rendez-vous annulé',           'Votre rendez-vous du {{date}} a été annulé par {{actor}} : {{reason}}.', 'Rendez-vous', true),
('APPOINTMENT_CANCELLED',    'patient',      'push',   'high',     'Rendez-vous annulé',           'Votre rendez-vous du {{date}} a été annulé par {{actor}}.', 'Rendez-vous', true),

-- ── PROFESSIONAL: Arrivals, invitations, plan limits ────────
('PATIENT_ARRIVED',          'professional', 'in_app', 'high',     'Patient arrivé',               '{{patient_name}} est arrivé (RDV {{time}}).', 'Aujourd''hui', true),
('PATIENT_ARRIVED',          'professional', 'push',   'high',     'Patient arrivé',               '{{patient_name}} est arrivé (RDV {{time}}).', 'Aujourd''hui', true),

('ESTABLISHMENT_INVITATION', 'professional', 'in_app', 'high',     'Invitation établissement',     '{{establishment_name}} vous invite à rejoindre son équipe.', 'Établissements', true),
('ESTABLISHMENT_INVITATION', 'professional', 'email',  'high',     'Invitation établissement',     '{{establishment_name}} vous invite à rejoindre son équipe.', 'Établissements', true),

('PLAN_LIMIT_REACHED',       'professional', 'in_app', 'high',     'Limite du plan atteinte',      'Vous avez atteint {{used}}/{{limit}} rendez-vous ce mois (plan {{plan_name}}). Les patients ne peuvent plus réserver.', NULL, true),
('PLAN_LIMIT_REACHED',       'professional', 'email',  'high',     'Limite du plan atteinte',      'Vous avez atteint {{used}}/{{limit}} rendez-vous ce mois (plan {{plan_name}}).', NULL, true),

('AI_CREDITS_EXHAUSTED',     'professional', 'in_app', 'normal',   'Plus de crédits IA',           'Plus de crédits IA ce mois.', NULL, true),

('ACTOR_VERIFIED',           'professional', 'in_app', 'normal',   'Compte vérifié',               'Votre compte est vérifié, vous êtes visible des patients.', NULL, true),
('ACTOR_VERIFIED',           'professional', 'email',  'normal',   'Compte vérifié',               'Votre compte est vérifié, vous êtes visible des patients.', NULL, true),

('ACTOR_REJECTED',           'professional', 'in_app', 'high',     'Vérification échouée',         'Votre compte n''a pas pu être vérifié : {{reason}}.', NULL, true),
('ACTOR_REJECTED',           'professional', 'email',  'high',     'Vérification échouée',         'Votre compte n''a pas pu être vérifié : {{reason}}.', NULL, true),

-- ── PATIENT: Prescriptions ───────────────────────────────────
('PRESCRIPTION_CREATED',     'patient',      'in_app', 'high',     'Nouvelle ordonnance',          'Une nouvelle ordonnance est disponible ({{prescription_number}}).', 'Ordonnances', true),
('PRESCRIPTION_CREATED',     'patient',      'email',  'high',     'Nouvelle ordonnance',          'Une nouvelle ordonnance est disponible ({{prescription_number}}).', 'Ordonnances', true),
('PRESCRIPTION_CREATED',     'patient',      'push',   'high',     'Nouvelle ordonnance',          'Ordonnance {{prescription_number}} disponible.', 'Ordonnances', true),

-- ── PATIENT: Pharmacy reservations ──────────────────────────
('PHARMACY_CONFIRMED',       'patient',      'in_app', 'normal',   'Réservation acceptée',         '{{pharmacy_name}} a accepté votre réservation {{reservation_number}}.', 'Réservations', true),
('PHARMACY_CONFIRMED',       'patient',      'push',   'normal',   'Réservation acceptée',         '{{pharmacy_name}} a accepté votre réservation {{reservation_number}}.', 'Réservations', true),

('PHARMACY_REFUSED',         'patient',      'in_app', 'high',     'Réservation refusée',          '{{pharmacy_name}} ne peut pas honorer votre réservation {{reservation_number}} : {{reason}}.', 'Réservations', true),
('PHARMACY_REFUSED',         'patient',      'email',  'high',     'Réservation refusée',          '{{pharmacy_name}} ne peut pas honorer votre réservation {{reservation_number}} : {{reason}}.', 'Réservations', true),
('PHARMACY_REFUSED',         'patient',      'push',   'high',     'Réservation refusée',          'Réservation {{reservation_number}} refusée.', 'Réservations', true),

('ORDER_READY',              'patient',      'in_app', 'high',     'Commande prête',               'Votre réservation est prête — {{pharmacy_name}}, {{address}}. Code : {{code}}.', 'Réservations', true),
('ORDER_READY',              'patient',      'email',  'high',     'Commande prête',               'Votre réservation est prête — {{pharmacy_name}}, {{address}}. Code : {{code}}.', 'Réservations', true),
('ORDER_READY',              'patient',      'push',   'high',     'Commande prête',               'Commande prête chez {{pharmacy_name}}. Code : {{code}}.', 'Réservations', true),

('RESERVATION_EXPIRED',      'patient',      'in_app', 'normal',   'Réservation expirée',          'Votre réservation {{reservation_number}} a expiré : {{expiry_reason}}.', 'Réservations', true),
('RESERVATION_EXPIRED',      'patient',      'email',  'normal',   'Réservation expirée',          'Votre réservation {{reservation_number}} a expiré : {{expiry_reason}}.', 'Réservations', true),

-- ── PATIENT: Insurance / mutual ──────────────────────────────
('INSURANCE_VALIDATED',      'patient',      'in_app', 'high',     'Prise en charge validée',      'Votre mutuelle prend en charge {{amount}} FCFA. Reste à payer : {{patient_amount}} FCFA.', 'Paiements', true),
('INSURANCE_VALIDATED',      'patient',      'email',  'high',     'Prise en charge validée',      'Votre mutuelle prend en charge {{amount}} FCFA. Reste à payer : {{patient_amount}} FCFA.', 'Paiements', true),
('INSURANCE_VALIDATED',      'patient',      'push',   'high',     'PEC validée',                  'Mutuelle validée — reste {{patient_amount}} FCFA.', 'Paiements', true),

('INSURANCE_REFUSED',        'patient',      'in_app', 'high',     'Prise en charge refusée',      'Mutuelle non prise en charge : {{reason}}. Montant : {{total}} FCFA.', 'Réservations', true),
('INSURANCE_REFUSED',        'patient',      'email',  'high',     'Prise en charge refusée',      'Mutuelle non prise en charge : {{reason}}. Montant : {{total}} FCFA.', 'Réservations', true),
('INSURANCE_REFUSED',        'patient',      'push',   'high',     'PEC refusée',                  'Mutuelle refusée pour {{reservation_number}}.', 'Réservations', true),

-- ── PATIENT: Payments & membership ──────────────────────────
('PATIENT_PAYMENT_FAILED',   'patient',      'in_app', 'high',     'Paiement échoué',              'Votre paiement a échoué : {{failure_reason}}.', 'Paiements', true),
('PATIENT_PAYMENT_FAILED',   'patient',      'email',  'high',     'Paiement échoué',              'Votre paiement a échoué : {{failure_reason}}.', 'Paiements', true),
('PATIENT_PAYMENT_FAILED',   'patient',      'push',   'high',     'Paiement échoué',              'Votre paiement a échoué : {{failure_reason}}.', 'Paiements', true),

('MEMBER_VERIFIED',          'patient',      'in_app', 'normal',   'Adhésion confirmée',           '{{insurance_name}} a confirmé votre adhésion n° {{member_number}}.', 'Ma mutuelle', true),
('MEMBER_VERIFIED',          'patient',      'email',  'normal',   'Adhésion confirmée',           '{{insurance_name}} a confirmé votre adhésion n° {{member_number}}.', 'Ma mutuelle', true),

('MEMBER_REJECTED',          'patient',      'in_app', 'high',     'Adhésion non reconnue',        '{{insurance_name}} n''a pas reconnu l''adhésion n° {{member_number}} : {{reason}}.', 'Ma mutuelle', true),
('MEMBER_REJECTED',          'patient',      'email',  'high',     'Adhésion non reconnue',        '{{insurance_name}} n''a pas reconnu l''adhésion n° {{member_number}} : {{reason}}.', 'Ma mutuelle', true),

-- ── PHARMACY STAFF ───────────────────────────────────────────
('PHARMACY_RESERVATION_CREATED', 'pharmacy_staff', 'in_app', 'high', 'Nouvelle réservation',      'Nouvelle réservation {{reservation_number}} — {{product_count}} produit(s).', 'Nouvelles', true),
('PHARMACY_RESERVATION_CREATED', 'pharmacy_staff', 'push',   'high', 'Nouvelle réservation',      'Nouvelle réservation {{reservation_number}}.', 'Nouvelles', true),
('PHARMACY_RESERVATION_CREATED', 'pharmacy_staff', 'email',  'high', 'Nouvelle réservation',      'Nouvelle réservation {{reservation_number}} — {{product_count}} produit(s).', 'Nouvelles', true),

('ORDER_FINANCED',           'pharmacy_staff', 'in_app', 'high',   'Commande financée',            'Commande {{reservation_number}} financée — à préparer.', 'À préparer', true),
('ORDER_FINANCED',           'pharmacy_staff', 'push',   'high',   'Commande financée',            'Commande {{reservation_number}} financée — à préparer.', 'À préparer', true),

('PATIENT_PAYMENT_RECEIVED', 'pharmacy_staff', 'in_app', 'normal', 'Paiement reçu',               'Paiement patient reçu — {{reservation_number}} ({{amount}} FCFA).', 'Commandes', true),
('PATIENT_PAYMENT_RECEIVED', 'mutual_staff',   'in_app', 'normal', 'Paiement patient reçu',       'Paiement patient reçu — {{reservation_number}} ({{amount}} FCFA).', 'Demandes', true),
('PATIENT_PAYMENT_RECEIVED', 'mutual_staff',   'email',  'normal', 'Paiement patient reçu',       'Paiement patient reçu — {{reservation_number}} ({{amount}} FCFA).', 'Demandes', true),

-- ── PHARMACY ADMIN ───────────────────────────────────────────
('STOCK_LOW',                'pharmacy_admin', 'in_app', 'normal', 'Stock faible',                 'Stock faible : {{product_name}} ({{quantity}} restant(s)).', 'Catalogue', true),

('PAYOUT_PAID',              'pharmacy_admin', 'in_app', 'normal', 'Reversement effectué',         'Reversement de {{amount}} FCFA effectué ({{period}}).', 'Finances', true),
('PAYOUT_PAID',              'pharmacy_admin', 'email',  'normal', 'Reversement effectué',         'Reversement de {{amount}} FCFA effectué ({{period}}).', 'Finances', true),

('SUBSCRIPTION_PAST_DUE',    'pharmacy_admin', 'in_app', 'high',   'Abonnement impayé',            'Votre abonnement est impayé : {{stripe_failure_message}}.', NULL, true),
('SUBSCRIPTION_PAST_DUE',    'pharmacy_admin', 'email',  'high',   'Abonnement impayé',            'Votre abonnement n''a pas pu être renouvelé : {{stripe_failure_message}}. Accès en lecture seule le {{restriction_date}}.', NULL, true),
('SUBSCRIPTION_PAST_DUE',    'platform_admin', 'in_app', 'normal', 'Abonnement impayé (org)',      'Abonnement impayé : {{organization_name}}.', NULL, true),

-- ── MUTUAL / INSURANCE STAFF ─────────────────────────────────
('COVERAGE_REQUEST_CREATED', 'mutual_staff',   'in_app', 'high',   'Nouvelle demande PEC',         'Nouvelle demande PEC-{{request_number}} — {{patient_name}} — {{amount}} FCFA.', 'Demandes', true),
('COVERAGE_REQUEST_CREATED', 'mutual_staff',   'email',  'high',   'Nouvelle demande PEC',         'Nouvelle demande PEC-{{request_number}} — {{patient_name}} — {{amount}} FCFA.', 'Demandes', true),

('COVERAGE_REQUEST_OVERDUE', 'mutual_admin',   'in_app', 'high',   'PEC en retard',                'PEC-{{request_number}} dépasse le délai de traitement de 24 h.', 'En retard', true),
('COVERAGE_REQUEST_OVERDUE', 'mutual_admin',   'email',  'high',   'PEC en retard',                'PEC-{{request_number}} dépasse le délai de traitement de 24 h.', 'En retard', true),

-- ── PLATFORM ADMIN ───────────────────────────────────────────
('VERIFICATION_REQUESTED',   'platform_admin', 'in_app', 'normal', 'Vérification demandée',        '{{entity_type}} à vérifier : {{entity_name}}.', 'Acteurs', true),

('DISPUTE_OPENED',           'platform_admin', 'in_app', 'high',   'Nouveau litige',               'Nouveau litige {{dispute_number}} ({{category}}) par {{role}}.', 'Litiges', true),
('DISPUTE_OPENED',           'platform_admin', 'email',  'high',   'Nouveau litige',               'Nouveau litige {{dispute_number}} ({{category}}) par {{role}}.', 'Litiges', true),

('WEBHOOK_INVALID_SIGNATURE','platform_admin', 'in_app', 'critical','Webhook invalide',             'Webhook {{psp}} rejeté : signature invalide (IP {{ip}}).', 'Sécurité', true),
('WEBHOOK_INVALID_SIGNATURE','platform_admin', 'email',  'critical','Webhook invalide',             'Webhook {{psp}} rejeté : signature invalide (IP {{ip}}).', 'Sécurité', true),

('SECURITY_ALERT',           'platform_admin', 'in_app', 'critical','Alerte sécurité',             'Activité inhabituelle : {{alert_type}} — {{details}}.', 'Sécurité', true),
('SECURITY_ALERT',           'platform_admin', 'email',  'critical','Alerte sécurité',             'Activité inhabituelle : {{alert_type}} — {{details}}.', 'Sécurité', true),

('PAYMENT_PENDING_PROLONGED','platform_admin', 'in_app', 'high',   'Paiement en attente',          'Paiement {{payment_id}} en attente depuis {{hours}} h.', 'Paiements', true)

ON CONFLICT (event_type, recipient_role, channel, locale) DO NOTHING;
