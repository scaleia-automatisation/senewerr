-- Table pour stocker les souscriptions push de chaque appareil utilisateur
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Idempotent : supprime la policy si elle existe déjà avant de la recréer
DROP POLICY IF EXISTS "push_subscriptions_self" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_self"
  ON public.push_subscriptions FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
