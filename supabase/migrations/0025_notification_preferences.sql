-- Préférences de notifications push par utilisateur
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_self" ON public.notification_preferences;
CREATE POLICY "notification_preferences_self"
  ON public.notification_preferences FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
