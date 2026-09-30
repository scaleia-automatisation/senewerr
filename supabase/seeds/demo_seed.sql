-- ═══════════════════════════════════════════════════════════════════════════
-- SÉNÉ WÉRR — Seed de démonstration (Bloc 29)
-- ═══════════════════════════════════════════════════════════════════════════
-- Spec 29.1 : données entièrement fictives, environnement de test uniquement.
-- NE PAS appliquer en production.
--
-- Mot de passe de tous les comptes demo : Demo2024!
-- Généré avec : crypt('Demo2024!', gen_salt('bf', 10))
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── UUIDs stables pour les comptes principaux (spec 29.2) ────────────────
-- Ces UUIDs fixes permettent de rejouer le seed de façon idempotente.

DO $$
DECLARE
  -- Comptes principaux spec 29.2
  v_patient_id      uuid := 'a1000000-demo-0000-0000-000000000001';
  v_medecin_id      uuid := 'a1000000-demo-0000-0000-000000000002';
  v_clinique_id     uuid := 'a1000000-demo-0000-0000-000000000003';
  v_pharmacie_id    uuid := 'a1000000-demo-0000-0000-000000000004';
  v_mutuelle_id     uuid := 'a1000000-demo-0000-0000-000000000005';
  v_admin_id        uuid := 'a1000000-demo-0000-0000-000000000006';
  v_superadmin_id   uuid := 'a1000000-demo-0000-0000-000000000007';
  -- Comptes supplémentaires spec 29.2
  v_patient2_id     uuid := 'a1000000-demo-0000-0000-000000000011';
  v_patient3_id     uuid := 'a1000000-demo-0000-0000-000000000012';
  v_medecin2_id     uuid := 'a1000000-demo-0000-0000-000000000013';
  v_pharmacie2_id   uuid := 'a1000000-demo-0000-0000-000000000014';
  v_mutuelle2_id    uuid := 'a1000000-demo-0000-0000-000000000015';

  v_demo_pwd text;
BEGIN
  -- Hash commun pour tous les comptes demo
  v_demo_pwd := crypt('Demo2024!', gen_salt('bf', 10));

  -- ── Étape 1 : auth.users ────────────────────────────────────────────────
  -- Spec 27 feedback : tous les tokens doivent être '' (chaîne vide), pas NULL.

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  ) VALUES
    (v_patient_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'patient@test.senewerr.sn',    v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"patient"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_medecin_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'medecin@test.senewerr.sn',    v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"sante"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_clinique_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'clinique@test.senewerr.sn',   v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"sante"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_pharmacie_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pharmacie@test.senewerr.sn',  v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"pharmacie"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_mutuelle_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mutuelle@test.senewerr.sn',   v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"couverture"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_admin_id,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@test.senewerr.sn',      v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"admin"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_superadmin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'superadmin@test.senewerr.sn', v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"super_admin"}',
     '', '', '', '', '', '', '', now(), now()),
    -- Comptes supplémentaires
    (v_patient2_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'patient2@test.senewerr.sn',   v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"patient"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_patient3_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'patient3@test.senewerr.sn',   v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"patient"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_medecin2_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'medecin2@test.senewerr.sn',   v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"sante"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_pharmacie2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pharmacie2@test.senewerr.sn', v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"pharmacie"}',
     '', '', '', '', '', '', '', now(), now()),
    (v_mutuelle2_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mutuelle2@test.senewerr.sn',  v_demo_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"actor_type":"couverture"}',
     '', '', '', '', '', '', '', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ── Étape 2 : auth.identities ────────────────────────────────────────────
  INSERT INTO auth.identities (id, user_id, provider, identity_data, created_at, updated_at, last_sign_in_at, provider_id)
  VALUES
    (gen_random_uuid(), v_patient_id,    'email', format('{"sub":"%s","email":"patient@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_patient_id)::jsonb,    now(), now(), now(), 'patient@test.senewerr.sn'),
    (gen_random_uuid(), v_medecin_id,    'email', format('{"sub":"%s","email":"medecin@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_medecin_id)::jsonb,    now(), now(), now(), 'medecin@test.senewerr.sn'),
    (gen_random_uuid(), v_clinique_id,   'email', format('{"sub":"%s","email":"clinique@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_clinique_id)::jsonb,   now(), now(), now(), 'clinique@test.senewerr.sn'),
    (gen_random_uuid(), v_pharmacie_id,  'email', format('{"sub":"%s","email":"pharmacie@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_pharmacie_id)::jsonb,  now(), now(), now(), 'pharmacie@test.senewerr.sn'),
    (gen_random_uuid(), v_mutuelle_id,   'email', format('{"sub":"%s","email":"mutuelle@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_mutuelle_id)::jsonb,   now(), now(), now(), 'mutuelle@test.senewerr.sn'),
    (gen_random_uuid(), v_admin_id,      'email', format('{"sub":"%s","email":"admin@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_admin_id)::jsonb,      now(), now(), now(), 'admin@test.senewerr.sn'),
    (gen_random_uuid(), v_superadmin_id, 'email', format('{"sub":"%s","email":"superadmin@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_superadmin_id)::jsonb, now(), now(), now(), 'superadmin@test.senewerr.sn'),
    (gen_random_uuid(), v_patient2_id,   'email', format('{"sub":"%s","email":"patient2@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_patient2_id)::jsonb,   now(), now(), now(), 'patient2@test.senewerr.sn'),
    (gen_random_uuid(), v_patient3_id,   'email', format('{"sub":"%s","email":"patient3@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_patient3_id)::jsonb,   now(), now(), now(), 'patient3@test.senewerr.sn'),
    (gen_random_uuid(), v_medecin2_id,   'email', format('{"sub":"%s","email":"medecin2@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_medecin2_id)::jsonb,   now(), now(), now(), 'medecin2@test.senewerr.sn'),
    (gen_random_uuid(), v_pharmacie2_id, 'email', format('{"sub":"%s","email":"pharmacie2@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_pharmacie2_id)::jsonb, now(), now(), now(), 'pharmacie2@test.senewerr.sn'),
    (gen_random_uuid(), v_mutuelle2_id,  'email', format('{"sub":"%s","email":"mutuelle2@test.senewerr.sn","email_verified":true,"phone_verified":false}', v_mutuelle2_id)::jsonb,  now(), now(), now(), 'mutuelle2@test.senewerr.sn')
  ON CONFLICT DO NOTHING;

  -- ── Étape 3 : public.profiles ────────────────────────────────────────────
  -- profiles.id = auth.users.id (clé étrangère directe)
  INSERT INTO public.profiles (id, actor_type, first_name, last_name, phone, email, account_status, created_at, updated_at)
  VALUES
    (v_patient_id,    'patient',     'Awa',            'Diop',                       '+221700000001', 'patient@test.senewerr.sn',    'verified', now(), now()),
    (v_medecin_id,    'sante',       'Mamadou',        'Ndiaye',                     '+221700000002', 'medecin@test.senewerr.sn',    'verified', now(), now()),
    (v_clinique_id,   'sante',       'Clinique',       'de Démonstration',           '+221700000003', 'clinique@test.senewerr.sn',   'verified', now(), now()),
    (v_pharmacie_id,  'pharmacie',   'Pharmacie',      'du Centre',                  '+221700000004', 'pharmacie@test.senewerr.sn',  'verified', now(), now()),
    (v_mutuelle_id,   'couverture',  'Mutuelle',       'de Démonstration',           '+221700000005', 'mutuelle@test.senewerr.sn',   'verified', now(), now()),
    (v_admin_id,      'admin',       'Administrateur', 'Test',                       '+221700000006', 'admin@test.senewerr.sn',      'verified', now(), now()),
    (v_superadmin_id, 'super_admin', 'Super Admin',    'Test',                       '+221700000007', 'superadmin@test.senewerr.sn', 'verified', now(), now()),
    -- Comptes supplémentaires
    (v_patient2_id,   'patient',     'Ibrahima',       'Fall',                       '+221700000011', 'patient2@test.senewerr.sn',   'verified', now(), now()),
    (v_patient3_id,   'patient',     'Fatou',          'Sall',                       '+221700000012', 'patient3@test.senewerr.sn',   'verified', now(), now()),
    (v_medecin2_id,   'sante',       'Aissatou',       'Ba',                         '+221700000013', 'medecin2@test.senewerr.sn',   'verified', now(), now()),
    (v_pharmacie2_id, 'pharmacie',   'Grande Pharmacie', 'de Test',                  '+221700000014', 'pharmacie2@test.senewerr.sn', 'verified', now(), now()),
    (v_mutuelle2_id,  'couverture',  'IPM',            'Démo',                       '+221700000015', 'mutuelle2@test.senewerr.sn',  'verified', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ── patients (enregistrements liés aux profils patient) ──────────────────
  INSERT INTO public.patients (id, profile_id, date_of_birth, gender, blood_group, address_region, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_patient_id,  '1990-03-15', 'female', 'O+', 'Dakar',    now(), now()),
    (gen_random_uuid(), v_patient2_id, '1985-07-22', 'male',   'A+', 'Thiès',    now(), now()),
    (gen_random_uuid(), v_patient3_id, '2000-11-10', 'female', 'B+', 'Dakar',    now(), now())
  ON CONFLICT (profile_id) DO NOTHING;

END $$;

-- ── Spec 29.3 — Médicaments fictifs ─────────────────────────────────────────
-- Identifiés clairement comme fictifs pour éviter toute confusion.
-- À insérer dans la table de catalogue médicament de la pharmacie de test.

DO $$
DECLARE
  v_pharmacie_id uuid := 'a1000000-demo-0000-0000-000000000004';
  v_pharm_rec    uuid;
BEGIN
  -- Récupérer l'ID du dossier pharmacie lié au profil
  SELECT id INTO v_pharm_rec FROM public.pharmacies WHERE profile_id = v_pharmacie_id LIMIT 1;

  IF v_pharm_rec IS NOT NULL THEN
    INSERT INTO public.pharmacy_inventory (
      id, pharmacy_id, medication_name, reference, dosage, stock_quantity, unit_price_fcfa, created_at, updated_at
    ) VALUES
      (gen_random_uuid(), v_pharm_rec, 'Médicament Démo A', 'TEST-MED-001', '500 mg',   30, 2500,  now(), now()),
      (gen_random_uuid(), v_pharm_rec, 'Médicament Démo B', 'TEST-MED-002', '250 mg',   15, 1800,  now(), now()),
      (gen_random_uuid(), v_pharm_rec, 'Médicament Démo C', 'TEST-MED-003', '1 000 mg',  0, 3200,  now(), now()),
      (gen_random_uuid(), v_pharm_rec, 'Médicament Démo D', 'TEST-MED-004', '100 mg',   50, 900,   now(), now()),
      (gen_random_uuid(), v_pharm_rec, 'Médicament Démo E', 'TEST-MED-005', '10 mg',    20, 4500,  now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── Fix de sécurité — tokens vides sur tous les comptes demo ─────────────────
-- Étape 4 du feedback seed : correction préventive si des NULL ont été insérés.
UPDATE auth.users
SET
  confirmation_token     = COALESCE(NULLIF(confirmation_token, ''),     ''),
  recovery_token         = COALESCE(NULLIF(recovery_token, ''),         ''),
  email_change_token_new = COALESCE(NULLIF(email_change_token_new, ''), ''),
  email_change           = COALESCE(NULLIF(email_change, ''),           ''),
  phone_change           = COALESCE(NULLIF(phone_change, ''),           ''),
  phone_change_token     = COALESCE(NULLIF(phone_change_token, ''),     ''),
  reauthentication_token = COALESCE(NULLIF(reauthentication_token, ''), '')
WHERE email LIKE '%@test.senewerr.sn';
