-- ═══════════════════════════════════════════════════════════════════════════
-- SÉNÉ WÉRR — Schéma principal
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILS UTILISATEURS ─────────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  actor_type      actor_type not null,
  first_name      text not null,
  last_name       text not null,
  phone           text unique not null,
  email           text,
  avatar_url      text,
  preferred_locale app_locale default 'fr',
  account_status  account_status default 'draft',
  verification_notes text,
  verified_at     timestamptz,
  verified_by     uuid references profiles(id),
  is_deleted      boolean default false,
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 2. PATIENTS ─────────────────────────────────────────────────────────
create table patients (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid unique not null references profiles(id) on delete cascade,
  date_of_birth       date,
  gender              text check (gender in ('male', 'female', 'other')),
  blood_group         text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  weight_kg           numeric(5,2),
  height_cm           numeric(5,1),
  allergies           text[],
  chronic_conditions  text[],
  emergency_contact_name  text,
  emergency_contact_phone text,
  address_region      text,
  address_department  text,
  address_commune     text,
  address_details     text,
  nin                 text unique,
  cmu_number          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 3. BÉNÉFICIAIRES (FAMILLE) ──────────────────────────────────────────
create table patient_beneficiaries (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  date_of_birth   date,
  gender          text check (gender in ('male', 'female', 'other')),
  relationship    beneficiary_relationship not null,
  blood_group     text,
  allergies       text[],
  chronic_conditions text[],
  nin             text,
  cmu_number      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 4. CONSENTEMENTS PATIENTS ───────────────────────────────────────────
create table patient_consents (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  consent_type    text not null,
  accepted        boolean not null,
  ip_address      text,
  user_agent      text,
  accepted_at     timestamptz default now()
);

-- ─── 5. PROFESSIONNELS DE SANTÉ ──────────────────────────────────────────
create table professionals (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid unique not null references profiles(id) on delete cascade,
  professional_type       professional_type not null,
  specialty               text,
  title                   text,
  ordre_number            text,
  ordre_document_url      text,
  bio                     text,
  languages_spoken        text[] default array['fr'],
  consultation_fee_fcfa   integer,
  teleconsultation_fee_fcfa integer,
  teleconsultation_enabled boolean default false,
  home_visit_enabled      boolean default false,
  home_visit_fee_fcfa     integer,
  address_region          text,
  address_department      text,
  address_commune         text,
  address_details         text,
  latitude                numeric(10,8),
  longitude               numeric(11,8),
  plan                    professional_plan default 'essentiel',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── 6. QUALIFICATIONS PROFESSIONNELLES ──────────────────────────────────
create table professional_qualifications (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  title           text not null,
  institution     text not null,
  year            integer,
  document_url    text,
  created_at      timestamptz default now()
);

-- ─── 7. ÉTABLISSEMENTS DE SANTÉ ──────────────────────────────────────────
create table establishments (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid unique not null references profiles(id) on delete cascade,
  name                    text not null,
  category                establishment_category not null,
  establishment_type      establishment_type not null,
  registration_number     text,
  registration_document_url text,
  description             text,
  phone                   text,
  email                   text,
  website                 text,
  address_region          text not null,
  address_department      text,
  address_commune         text,
  address_details         text,
  latitude                numeric(10,8),
  longitude               numeric(11,8),
  capacity_beds           integer,
  emergency_available     boolean default false,
  ambulance_available     boolean default false,
  logo_url                text,
  cover_image_url         text,
  opening_hours           jsonb,
  plan                    establishment_plan default 'cabinet',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── 8. SERVICES D'ÉTABLISSEMENT ─────────────────────────────────────────
create table establishment_services (
  id              uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name            text not null,
  description     text,
  fee_fcfa        integer,
  duration_min    integer,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ─── 9. MEMBRES PROFESSIONNELS D'UN ÉTABLISSEMENT ────────────────────────
create table professional_establishment_memberships (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  role            text default 'member',
  is_primary      boolean default false,
  joined_at       timestamptz default now(),
  left_at         timestamptz,
  unique(professional_id, establishment_id)
);

-- ─── 10. PHARMACIES ──────────────────────────────────────────────────────
create table pharmacies (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid unique not null references profiles(id) on delete cascade,
  name                    text not null,
  ordre_number            text,
  registration_document_url text,
  description             text,
  phone                   text,
  email                   text,
  address_region          text not null,
  address_department      text,
  address_commune         text,
  address_details         text,
  latitude                numeric(10,8),
  longitude               numeric(11,8),
  opening_hours           jsonb,
  delivery_available      boolean default false,
  delivery_radius_km      integer,
  delivery_fee_fcfa       integer,
  logo_url                text,
  cover_image_url         text,
  plan                    pharmacy_plan default 'decouverte',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  commission_rate_percent numeric(5,2) default 3.0,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── 11. PRODUITS PHARMACIE ──────────────────────────────────────────────
create table pharmacy_products (
  id                  uuid primary key default gen_random_uuid(),
  pharmacy_id         uuid not null references pharmacies(id) on delete cascade,
  name                text not null,
  generic_name        text,
  brand_name          text,
  dci                 text,
  category            text,
  form                text,
  dosage              text,
  description         text,
  unit_price_fcfa     integer not null,
  prescription_required boolean default false,
  is_available        boolean default true,
  image_url           text,
  barcode             text,
  amm_number          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 12. MOUVEMENTS DE STOCK ─────────────────────────────────────────────
create table pharmacy_stock_movements (
  id              uuid primary key default gen_random_uuid(),
  pharmacy_id     uuid not null references pharmacies(id) on delete cascade,
  product_id      uuid not null references pharmacy_products(id) on delete cascade,
  movement_type   text check (movement_type in ('in', 'out', 'adjustment', 'reserved', 'unreserved')),
  quantity        integer not null,
  stock_after     integer not null,
  reference_type  text,
  reference_id    uuid,
  note            text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

-- ─── 13. STOCK PHARMACIE (vue matérialisée logique) ──────────────────────
create table pharmacy_stock (
  id              uuid primary key default gen_random_uuid(),
  pharmacy_id     uuid not null references pharmacies(id) on delete cascade,
  product_id      uuid not null references pharmacy_products(id) on delete cascade,
  quantity_total  integer not null default 0,
  quantity_reserved integer not null default 0,
  quantity_available integer generated always as (quantity_total - quantity_reserved) stored,
  reorder_threshold integer default 5,
  expiry_date     date,
  batch_number    text,
  updated_at      timestamptz default now(),
  unique(pharmacy_id, product_id)
);

-- ─── 14. ORGANISMES DE COUVERTURE ────────────────────────────────────────
create table coverage_orgs (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid unique not null references profiles(id) on delete cascade,
  name                text not null,
  org_type            coverage_org_type not null,
  registration_number text,
  registration_document_url text,
  description         text,
  phone               text,
  email               text,
  website             text,
  address_region      text,
  address_details     text,
  logo_url            text,
  stripe_customer_id  text,
  stripe_subscription_id text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 15. FORMULES / PLANS DE COUVERTURE ──────────────────────────────────
create table coverage_plans (
  id                  uuid primary key default gen_random_uuid(),
  coverage_org_id     uuid not null references coverage_orgs(id) on delete cascade,
  name                text not null,
  description         text,
  is_active           boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 16. RÈGLES DE COUVERTURE ─────────────────────────────────────────────
create table coverage_rules (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references coverage_plans(id) on delete cascade,
  rule_type           text not null,
  category            text,
  coverage_percent    integer not null check (coverage_percent between 0 and 100),
  max_amount_fcfa     integer,
  annual_limit_fcfa   integer,
  waiting_days        integer default 0,
  requires_referral   boolean default false,
  notes               text,
  created_at          timestamptz default now()
);

-- ─── 17. ADHÉRENTS ───────────────────────────────────────────────────────
create table coverage_members (
  id                  uuid primary key default gen_random_uuid(),
  coverage_org_id     uuid not null references coverage_orgs(id) on delete cascade,
  plan_id             uuid references coverage_plans(id),
  patient_id          uuid references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  member_number       text unique,
  start_date          date not null,
  end_date            date,
  is_active           boolean default true,
  employer_name       text,
  employee_number     text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  check (patient_id is not null or beneficiary_id is not null)
);

-- ─── 18. PLANNINGS / AGENDAS ─────────────────────────────────────────────
create table schedules (
  id                  uuid primary key default gen_random_uuid(),
  owner_type          text check (owner_type in ('professional', 'establishment')),
  professional_id     uuid references professionals(id) on delete cascade,
  establishment_id    uuid references establishments(id) on delete cascade,
  service_id          uuid references establishment_services(id),
  name                text not null default 'Agenda principal',
  slot_duration_min   integer not null default 30,
  buffer_min          integer default 0,
  max_advance_days    integer default 60,
  min_advance_hours   integer default 1,
  appointment_types   appointment_type[] default array['in_person']::appointment_type[],
  is_active           boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  check (professional_id is not null or establishment_id is not null)
);

-- ─── 19. CRÉNEAUX HORAIRES ───────────────────────────────────────────────
create table schedule_slots (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null references schedules(id) on delete cascade,
  day_of_week     integer check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  max_patients    integer default 1,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ─── 20. EXCEPTIONS / CONGÉS ─────────────────────────────────────────────
create table schedule_exceptions (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null references schedules(id) on delete cascade,
  exception_date  date not null,
  is_available    boolean default false,
  start_time      time,
  end_time        time,
  reason          text,
  created_at      timestamptz default now()
);

-- ─── 21. RENDEZ-VOUS ─────────────────────────────────────────────────────
create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  schedule_id         uuid not null references schedules(id),
  professional_id     uuid references professionals(id),
  establishment_id    uuid references establishments(id),
  service_id          uuid references establishment_services(id),
  patient_id          uuid not null references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  appointment_type    appointment_type not null default 'in_person',
  status              appointment_status not null default 'pending',
  appointment_date    date not null,
  start_time          time not null,
  end_time            time not null,
  duration_min        integer,
  reason              text,
  notes               text,
  teleconsult_room_url text,
  cancelled_by        uuid references profiles(id),
  cancel_reason       text,
  cancelled_at        timestamptz,
  reminder_sent_24h   boolean default false,
  reminder_sent_1h    boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 22. CONSULTATIONS ───────────────────────────────────────────────────
create table consultations (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid unique references appointments(id),
  professional_id     uuid not null references professionals(id),
  patient_id          uuid not null references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  status              consultation_status not null default 'opened',
  chief_complaint     text,
  clinical_notes      text,
  diagnosis           text[],
  treatment_plan      text,
  follow_up_date      date,
  fee_fcfa            integer,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 23. DOSSIERS MÉDICAUX ───────────────────────────────────────────────
create table health_records (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references patients(id) on delete cascade,
  beneficiary_id      uuid references patient_beneficiaries(id),
  record_type         text not null,
  title               text not null,
  content             text,
  data                jsonb,
  document_url        text,
  recorded_by         uuid references professionals(id),
  recorded_at         date not null default current_date,
  consultation_id     uuid references consultations(id),
  is_visible_to_patient boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 24. ORDONNANCES ─────────────────────────────────────────────────────
create table prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  consultation_id     uuid references consultations(id),
  professional_id     uuid not null references professionals(id),
  patient_id          uuid not null references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  status              prescription_status not null default 'draft',
  issued_at           timestamptz,
  expires_at          date,
  notes               text,
  qr_code             text unique,
  share_token         text unique default encode(gen_random_bytes(16), 'hex'),
  shared_at           timestamptz,
  validated_by        uuid references pharmacies(id),
  validated_at        timestamptz,
  used_at             timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 25. MÉDICAMENTS DE L'ORDONNANCE ─────────────────────────────────────
create table prescription_items (
  id                  uuid primary key default gen_random_uuid(),
  prescription_id     uuid not null references prescriptions(id) on delete cascade,
  medication_name     text not null,
  dci                 text,
  dosage              text,
  form                text,
  frequency           text,
  duration            text,
  quantity            integer,
  instructions        text,
  is_substitutable    boolean default true,
  created_at          timestamptz default now()
);

-- ─── 26. RÉSERVATIONS PHARMACIE ──────────────────────────────────────────
create table pharmacy_reservations (
  id                  uuid primary key default gen_random_uuid(),
  pharmacy_id         uuid not null references pharmacies(id),
  patient_id          uuid not null references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  prescription_id     uuid references prescriptions(id),
  coverage_request_id uuid,
  status              reservation_status not null default 'new',
  pickup_code         text unique default upper(substring(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  expiry_at           timestamptz not null,
  has_paid            boolean default false,
  total_amount_fcfa   integer default 0,
  patient_share_fcfa  integer,
  coverage_share_fcfa integer,
  notes               text,
  refused_reason      text,
  refused_by          uuid references profiles(id),
  confirmed_at        timestamptz,
  prepared_at         timestamptz,
  ready_at            timestamptz,
  collected_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 27. ARTICLES DE LA RÉSERVATION ──────────────────────────────────────
create table pharmacy_reservation_items (
  id                  uuid primary key default gen_random_uuid(),
  reservation_id      uuid not null references pharmacy_reservations(id) on delete cascade,
  product_id          uuid references pharmacy_products(id),
  prescription_item_id uuid references prescription_items(id),
  medication_name     text not null,
  quantity            integer not null default 1,
  unit_price_fcfa     integer,
  total_price_fcfa    integer,
  is_substituted      boolean default false,
  substituted_product_id uuid references pharmacy_products(id),
  created_at          timestamptz default now()
);

-- ─── 28. DEMANDES DE PRISE EN CHARGE ─────────────────────────────────────
create table coverage_requests (
  id                  uuid primary key default gen_random_uuid(),
  coverage_member_id  uuid not null references coverage_members(id),
  coverage_org_id     uuid not null references coverage_orgs(id),
  plan_id             uuid references coverage_plans(id),
  patient_id          uuid references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  prescription_id     uuid references prescriptions(id),
  reservation_id      uuid references pharmacy_reservations(id),
  appointment_id      uuid references appointments(id),
  request_type        text check (request_type in ('pharmacy', 'consultation', 'exam', 'hospitalization', 'other')),
  status              coverage_request_status not null default 'pending',
  total_amount_fcfa   integer,
  coverage_percent    integer,
  coverage_amount_fcfa integer,
  patient_amount_fcfa integer,
  reason              text,
  admin_notes         text,
  reviewed_by         uuid references profiles(id),
  reviewed_at         timestamptz,
  additional_docs_requested text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Update FK in pharmacy_reservations
alter table pharmacy_reservations
  add constraint fk_reservation_coverage_request
  foreign key (coverage_request_id) references coverage_requests(id);

-- ─── 29. DÉCISIONS DE COUVERTURE ─────────────────────────────────────────
create table coverage_decisions (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references coverage_requests(id) on delete cascade,
  decision            text check (decision in ('approved', 'refused', 'partial')),
  coverage_amount_fcfa integer,
  patient_amount_fcfa integer,
  reason              text,
  valid_until         date,
  decided_by          uuid not null references profiles(id),
  decided_at          timestamptz default now()
);

-- ─── 30. PAIEMENTS ───────────────────────────────────────────────────────
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  reference           text unique not null default 'PAY-' || upper(substring(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  payer_id            uuid not null references profiles(id),
  payer_actor         payment_actor not null,
  payee_id            uuid references profiles(id),
  amount_fcfa         integer not null,
  fee_fcfa            integer default 0,
  net_amount_fcfa     integer,
  method              payment_method not null,
  status              payment_status not null default 'pending',
  currency            text default 'XOF',
  description         text,
  reservation_id      uuid references pharmacy_reservations(id),
  appointment_id      uuid references appointments(id),
  subscription_id     uuid,
  provider_reference  text,
  provider_data       jsonb,
  initiated_at        timestamptz default now(),
  completed_at        timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  refunded_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 31. ÉVÉNEMENTS DE PAIEMENT ──────────────────────────────────────────
create table payment_events (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid not null references payments(id) on delete cascade,
  event_type      text not null,
  status_from     payment_status,
  status_to       payment_status,
  provider_event  text,
  raw_payload     jsonb,
  created_at      timestamptz default now()
);

-- ─── 32. FACTURES ────────────────────────────────────────────────────────
create table invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_number      text unique not null,
  payment_id          uuid references payments(id),
  payer_id            uuid not null references profiles(id),
  payee_id            uuid references profiles(id),
  items               jsonb not null default '[]',
  subtotal_fcfa       integer not null,
  tax_fcfa            integer default 0,
  total_fcfa          integer not null,
  notes               text,
  issued_at           date default current_date,
  due_at              date,
  paid_at             date,
  document_url        text,
  created_at          timestamptz default now()
);

-- ─── 33. REMBOURSEMENTS ──────────────────────────────────────────────────
create table refunds (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid not null references payments(id) on delete cascade,
  amount_fcfa     integer not null,
  reason          text,
  status          payment_status default 'pending',
  provider_reference text,
  processed_by    uuid references profiles(id),
  processed_at    timestamptz,
  created_at      timestamptz default now()
);

-- ─── 34. ABONNEMENTS ─────────────────────────────────────────────────────
create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references profiles(id),
  plan_name               text not null,
  status                  text check (status in ('trialing', 'active', 'past_due', 'cancelled', 'unpaid')),
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  amount_fcfa             integer,
  interval                text check (interval in ('month', 'year')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_ends_at           timestamptz,
  cancelled_at            timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── 35. NOTIFICATIONS ───────────────────────────────────────────────────
create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid not null references profiles(id) on delete cascade,
  notification_type   notification_type not null,
  channel             notification_channel not null default 'in_app',
  title               text not null,
  body                text not null,
  data                jsonb,
  is_read             boolean default false,
  read_at             timestamptz,
  sent_at             timestamptz,
  reference_type      text,
  reference_id        uuid,
  created_at          timestamptz default now()
);

-- ─── 36. PRÉFÉRENCES DE NOTIFICATION ─────────────────────────────────────
create table notification_preferences (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid unique not null references profiles(id) on delete cascade,
  in_app_enabled      boolean default true,
  email_enabled       boolean default true,
  sms_enabled         boolean default false,
  whatsapp_enabled    boolean default false,
  push_enabled        boolean default false,
  disabled_types      notification_type[] default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 37. DOCUMENTS ───────────────────────────────────────────────────────
create table documents (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id) on delete cascade,
  patient_id          uuid references patients(id),
  beneficiary_id      uuid references patient_beneficiaries(id),
  document_type       document_type not null,
  title               text not null,
  description         text,
  file_url            text not null,
  file_size_bytes     integer,
  mime_type           text,
  uploaded_by         uuid references profiles(id),
  is_shared           boolean default false,
  shared_with         uuid[],
  reference_type      text,
  reference_id        uuid,
  expires_at          date,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 38. LITIGES ─────────────────────────────────────────────────────────
create table litiges (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid not null references profiles(id),
  reported_id         uuid references profiles(id),
  reference_type      text,
  reference_id        uuid,
  subject             text not null,
  description         text not null,
  status              litige_status default 'new',
  resolution          text,
  assigned_to         uuid references profiles(id),
  resolved_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 39. MESSAGES DE LITIGE ──────────────────────────────────────────────
create table litige_messages (
  id          uuid primary key default gen_random_uuid(),
  litige_id   uuid not null references litiges(id) on delete cascade,
  sender_id   uuid not null references profiles(id),
  content     text not null,
  attachments text[],
  created_at  timestamptz default now()
);

-- ─── 40. LOGS D'AUDIT ────────────────────────────────────────────────────
create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references profiles(id),
  action          text not null,
  table_name      text,
  record_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz default now()
);

-- ─── 41. LOGS D'ÉVÉNEMENTS MÉTIER ────────────────────────────────────────
create table event_logs (
  id              uuid primary key default gen_random_uuid(),
  event_type      event_type not null,
  actor_id        uuid references profiles(id),
  data            jsonb not null default '{}',
  created_at      timestamptz default now()
);

-- ─── 42. ÉVALUATIONS / AVIS ──────────────────────────────────────────────
create table reviews (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references patients(id),
  target_type         text check (target_type in ('professional', 'establishment', 'pharmacy')),
  professional_id     uuid references professionals(id),
  establishment_id    uuid references establishments(id),
  pharmacy_id         uuid references pharmacies(id),
  appointment_id      uuid references appointments(id),
  rating              integer check (rating between 1 and 5),
  comment             text,
  is_anonymous        boolean default false,
  is_visible          boolean default true,
  moderated_by        uuid references profiles(id),
  moderated_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 43. RÉPONSES AUX AVIS ───────────────────────────────────────────────
create table review_replies (
  id              uuid primary key default gen_random_uuid(),
  review_id       uuid not null references reviews(id) on delete cascade,
  author_id       uuid not null references profiles(id),
  content         text not null,
  created_at      timestamptz default now()
);

-- ─── 44. MESSAGES IN-APP (MESSAGERIE SIMPLE) ─────────────────────────────
create table messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null,
  sender_id       uuid not null references profiles(id),
  recipient_id    uuid not null references profiles(id),
  content         text not null,
  is_read         boolean default false,
  read_at         timestamptz,
  attachments     text[],
  created_at      timestamptz default now()
);

-- ─── 45. TARIFS ET GRILLES ────────────────────────────────────────────────
create table pricing_plans (
  id                  uuid primary key default gen_random_uuid(),
  actor_type          actor_type not null,
  plan_name           text not null,
  display_name        text not null,
  description         text,
  price_monthly_fcfa  integer,
  price_yearly_fcfa   integer,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  features            jsonb not null default '[]',
  is_active           boolean default true,
  sort_order          integer default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── 46. TOKENS OTP / VÉRIFICATION ────────────────────────────────────────
create table verification_tokens (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  token           text not null,
  token_type      text check (token_type in ('phone', 'email', 'password_reset')),
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz default now()
);

-- ─── 47. SESSIONS TÉLÉCONSULTATION ────────────────────────────────────────
create table teleconsultation_sessions (
  id                  uuid primary key default gen_random_uuid(),
  consultation_id     uuid unique not null references consultations(id),
  room_id             text unique not null,
  provider            text default 'daily.co',
  room_url            text,
  recording_url       text,
  duration_seconds    integer,
  started_at          timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz default now()
);

-- ─── 48. EXPIRATIONS DE RÉSERVATIONS (job scheduler helper) ──────────────
create table reservation_expiry_jobs (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid unique not null references pharmacy_reservations(id) on delete cascade,
  expires_at      timestamptz not null,
  processed       boolean default false,
  processed_at    timestamptz,
  created_at      timestamptz default now()
);
