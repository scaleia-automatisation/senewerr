-- Migration vers FCM : remplacement des colonnes VAPID par un simple token FCM
-- Idempotente : peut être exécutée plusieurs fois sans erreur

-- Ajout de la colonne fcm_token si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'push_subscriptions'
      AND column_name  = 'fcm_token'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN fcm_token text;
  END IF;
END $$;

-- Suppression des colonnes VAPID devenues inutiles (si elles existent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = 'endpoint'
  ) THEN
    ALTER TABLE public.push_subscriptions DROP COLUMN endpoint;
    ALTER TABLE public.push_subscriptions DROP COLUMN p256dh;
    ALTER TABLE public.push_subscriptions DROP COLUMN auth;
  END IF;
END $$;

-- Contrainte unicité sur (user_id, fcm_token) si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_token_unique'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_token_unique UNIQUE (user_id, fcm_token);
  END IF;
END $$;
