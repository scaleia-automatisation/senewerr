-- ============================================================
-- 0014_private_functions.sql — Fonctions RPC SECURITY DEFINER
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- can_prepare : règle de blocage préparation pharmacie
-- La préparation ne peut commencer que si la réservation est
-- entièrement financée (paiement patient + mutuelle OK)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.can_prepare(p_reservation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.pharmacy_reservations
    WHERE id = p_reservation_id
      AND pharmacy_status = 'confirmed'
      AND (
        -- Pas d'assurance → paiement patient seul
        (insurance_status = 'none' AND patient_payment_status = 'paid')
        OR
        -- Avec assurance approuvée → paiement patient + éventuellement mutuelle
        (insurance_status IN ('approved','partially_approved') AND patient_payment_status = 'paid')
        OR
        -- Mutuelle tiers payant → paiement mutuelle reçu
        (insurance_status = 'approved' AND patient_payment_status IN ('not_required','paid'))
      )
  );
$$;

-- ────────────────────────────────────────────────────────────
-- Trigger Realtime helper : notifie le canal org:<id>
-- ────────────────────────────────────────────────────────────
-- (Realtime est configuré via supabase dashboard ; ici on s'assure
-- que les tables critiques sont dans la publication realtime)

-- Activer la réplication pour les tables de notification temps réel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- La publication existe mais ne supporte pas ADD TABLE dans ce mode
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Jobs pg_cron (planifiés — déclenchent les Edge Functions)
-- ────────────────────────────────────────────────────────────
-- Rappels RDV : toutes les heures
SELECT cron.schedule(
  'cron-appointment-reminders',
  '0 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-appointment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-appointment-reminders'
);

-- Expiration réservations : toutes les 15 minutes
SELECT cron.schedule(
  'cron-expire-reservations',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-expire-reservations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-expire-reservations'
);

-- Génération créneaux 60 jours : quotidien 01:00
SELECT cron.schedule(
  'cron-generate-slots',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-generate-slots',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-generate-slots'
);

-- Facturation mensuelle : 1er du mois 02:00
SELECT cron.schedule(
  'cron-monthly-billing',
  '0 2 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-monthly-billing',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-monthly-billing'
);

-- Séquences email : toutes les 5 minutes
SELECT cron.schedule(
  'cron-email-sequences',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-email-sequences',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-email-sequences'
);

-- Relances paiement/couverture en retard : toutes les heures
SELECT cron.schedule(
  'cron-payment-reminders',
  '30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-payment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-payment-reminders'
);

-- SLA couverture dépassé : toutes les heures
SELECT cron.schedule(
  'cron-coverage-overdue',
  '45 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/cron-coverage-overdue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-coverage-overdue'
);
