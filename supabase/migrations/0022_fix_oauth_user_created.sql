-- Fix on_auth_user_created trigger to handle OAuth providers (Google)
-- Google sends full_name/name instead of first_name/last_name

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role       public.user_role;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'patient'::public.user_role
  );

  -- Email/password signup provides first_name / last_name directly.
  -- OAuth providers (Google, etc.) provide full_name or name instead.
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name  := NEW.raw_user_meta_data->>'last_name';

  IF v_first_name IS NULL THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email::text, '@', 1)
    );
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name  := CASE
      WHEN strpos(v_full_name, ' ') > 0
      THEN substr(v_full_name, strpos(v_full_name, ' ') + 1)
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.profiles (user_id, role, first_name, last_name, email, phone)
  VALUES (
    NEW.id,
    v_role,
    v_first_name,
    v_last_name,
    NEW.email::citext,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;
