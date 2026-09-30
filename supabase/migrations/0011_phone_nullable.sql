-- Rendre phone nullable dans profiles (téléphone retiré du formulaire d'inscription)
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- Mettre à null les chaînes vides existantes (insérées par l'ancienne version du trigger)
UPDATE profiles SET phone = NULL WHERE phone = '';

-- Corriger le trigger handle_new_user pour insérer NULL au lieu de '' quand pas de téléphone
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  meta jsonb;
BEGIN
  meta := new.raw_user_meta_data;
  INSERT INTO profiles (
    id,
    actor_type,
    first_name,
    last_name,
    phone,
    email,
    account_status
  ) VALUES (
    new.id,
    (meta->>'actor_type')::actor_type,
    COALESCE(meta->>'first_name', split_part(new.email, '@', 1)),
    COALESCE(meta->>'last_name', ''),
    NULLIF(COALESCE(meta->>'phone', ''), ''),
    new.email,
    CASE
      WHEN (meta->>'actor_type') = 'patient' THEN 'verified'::account_status
      ELSE 'pending'::account_status
    END
  );

  -- Créer automatiquement le dossier patient si actor_type = patient
  IF (meta->>'actor_type') = 'patient' THEN
    INSERT INTO patients (profile_id, date_of_birth)
    VALUES (
      new.id,
      CASE
        WHEN meta->>'date_of_birth' IS NOT NULL
        THEN (meta->>'date_of_birth')::date
        ELSE NULL
      END
    );

    INSERT INTO notification_preferences (profile_id) VALUES (new.id);
  END IF;

  RETURN new;
END $$;
