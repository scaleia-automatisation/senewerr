-- ═══════════════════════════════════════════════════════════════════════════
-- Fix handle_new_user() pour OAuth Google
-- Problèmes corrigés :
--   1. actor_type NULL avec Google OAuth → défaut 'patient'
--   2. Google fournit 'full_name'/'name' au lieu de first_name/last_name séparés
--   3. avatar_url/picture de Google non récupéré
--   4. date_of_birth chaîne vide → NULL (déjà correct, renforcé)
--   5. on conflict do nothing → évite crash si trigger se déclenche 2x
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  meta           jsonb;
  v_actor_type   actor_type;
  v_first_name   text;
  v_last_name    text;
  v_full_name    text;
begin
  meta := new.raw_user_meta_data;

  -- actor_type : OAuth (Google) ne le fournit pas → défaut 'patient'
  v_actor_type := coalesce(
    nullif(meta->>'actor_type', '')::actor_type,
    'patient'::actor_type
  );

  -- Nom/prénom : inscription classique = first_name/last_name
  --              Google OAuth          = full_name ou name
  v_full_name  := coalesce(meta->>'full_name', meta->>'name', '');
  v_first_name := coalesce(
    nullif(meta->>'first_name', ''),
    nullif(split_part(v_full_name, ' ', 1), ''),
    split_part(new.email, '@', 1)
  );
  v_last_name  := coalesce(
    nullif(meta->>'last_name', ''),
    nullif(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), ''),
    ''
  );

  insert into profils (
    id, actor_type, first_name, last_name,
    phone, email, avatar_url, account_status
  ) values (
    new.id,
    v_actor_type,
    v_first_name,
    v_last_name,
    nullif(coalesce(meta->>'phone', ''), ''),
    new.email,
    coalesce(meta->>'avatar_url', meta->>'picture'),
    case when v_actor_type = 'patient'
         then 'verified'::account_status
         else 'pending'::account_status end
  )
  on conflict (id) do nothing;

  if v_actor_type = 'patient' then
    insert into patients (profile_id, date_of_birth)
    values (
      new.id,
      case
        when meta->>'date_of_birth' is not null
         and meta->>'date_of_birth' != ''
        then (meta->>'date_of_birth')::date
        else null
      end
    )
    on conflict (profile_id) do nothing;

    insert into preferences_notifications (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end $$;
