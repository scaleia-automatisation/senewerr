-- ============================================================
-- 0026_reminders_columns_cron.sql — Colonnes rappels + cron
-- ============================================================

-- ── Colonne heure de retrait prévue (pharmacie) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pharmacy_reservations'
      AND column_name = 'pickup_scheduled_at'
  ) THEN
    ALTER TABLE public.pharmacy_reservations
      ADD COLUMN pickup_scheduled_at timestamptz;
  END IF;
END $$;

-- ── Colonne marqueur rappel 30 min (réservation pharmacie) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pharmacy_reservations'
      AND column_name = 'reminder_30m_sent_at'
  ) THEN
    ALTER TABLE public.pharmacy_reservations
      ADD COLUMN reminder_30m_sent_at timestamptz;
  END IF;
END $$;

-- Index pour accélérer les requêtes du cron
CREATE INDEX IF NOT EXISTS idx_reservations_pickup
  ON public.pharmacy_reservations(pickup_scheduled_at)
  WHERE pickup_scheduled_at IS NOT NULL AND status NOT IN ('completed','cancelled','expired','refunded');

CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON public.appointments(starts_at, reminder_24h_sent_at, reminder_1h_sent_at)
  WHERE status = 'confirmed';

-- ── pg_cron — planification des Edge Functions ─────────────
-- Prérequis : activer les extensions pg_cron et pg_net dans
--   Supabase Dashboard → Database → Extensions
-- Puis définir la variable dans votre session SQL :
--   ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'VOTRE_CLE';
--
-- Ou planifier directement depuis le Dashboard Supabase :
--   Project → Edge Functions → appointment-reminders → Schedule → 0 * * * *
--   Project → Edge Functions → reservation-reminders → Schedule → */5 * * * *
--
-- Si pg_cron est activé, décommentez les blocs ci-dessous :

/*
SELECT cron.schedule(
  'appointment-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url        := 'https://oosgigliuhztuktkqdgn.supabase.co/functions/v1/appointment-reminders',
    headers    := jsonb_build_object(
                    'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
                    'Content-Type',  'application/json'
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'reservation-reminders-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url        := 'https://oosgigliuhztuktkqdgn.supabase.co/functions/v1/reservation-reminders',
    headers    := jsonb_build_object(
                    'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
                    'Content-Type',  'application/json'
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
*/
