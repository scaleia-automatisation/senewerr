-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 26 — Compléments schéma (spec 26.2 tables manquantes + corrections)
-- Toutes les instructions utilisent IF NOT EXISTS / IF EXISTS pour l'idempotence.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── A. TABLES MANQUANTES SPEC 26.2 ─────────────────────────────────────────

-- health_record_entries : sous-entrées chronologiques d'un dossier médical
create table if not exists health_record_entries (
  id              uuid primary key default gen_random_uuid(),
  health_record_id uuid not null references health_records(id) on delete cascade,
  entry_type      text not null,      -- 'note' | 'measure' | 'exam' | 'attachment'
  content         text,
  data            jsonb default '{}',
  recorded_by     uuid references professionals(id),
  recorded_at     timestamptz default now()
);

-- professional_specialties : plusieurs spécialités par professionnel (spec 26.5 multi-org)
create table if not exists professional_specialties (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  specialty       text not null,
  is_primary      boolean default false,
  created_at      timestamptz default now(),
  unique(professional_id, specialty)
);

-- system_events : journal opérationnel métier — utilisé par les blocs admin 20-22
create table if not exists system_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  actor_id        uuid references profiles(id),
  actor_type      text,
  object_type     text,
  object_id       uuid,
  result          text check (result in ('success', 'failure', 'blocked')),
  metadata        jsonb default '{}',
  correlation_id  uuid default gen_random_uuid(),
  category        text,
  created_at      timestamptz default now()
);

-- platform_settings : paramètres configurables super admin (bloc 22 — spec 22.5)
create table if not exists platform_settings (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  value           text not null,
  previous_value  text,
  category        text,
  updated_by      uuid references profiles(id),
  updated_at      timestamptz default now()
);

-- feature_flags : drapeaux de fonctionnalités (bloc 22 — spec 22.2)
create table if not exists feature_flags (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  enabled         boolean not null default false,
  category        text,
  updated_by      uuid references profiles(id),
  updated_at      timestamptz default now()
);

-- ─── B. COLONNES MANQUANTES SUR TABLES EXISTANTES ────────────────────────────

-- profiles : permissions admin granulaires (bloc 22 — spec 22.3)
alter table profiles
  add column if not exists admin_permissions text[] default '{}';

-- subscriptions : actor_type + actor_id pour accès par acteur métier (bloc 23)
alter table subscriptions
  add column if not exists actor_type text,
  add column if not exists actor_id   uuid,
  add column if not exists plan_key   text,
  add column if not exists renewal_at timestamptz,
  add column if not exists actor_name text,
  add column if not exists commission_pct  numeric(5,2),
  add column if not exists commission_cap_fcfa integer;

-- litiges : colonnes utilisées par bloc 21
alter table litiges
  add column if not exists reference      text,
  add column if not exists actor_type     text,
  add column if not exists motif          text;

-- litige_messages : jointure explicite avec litiges déjà présente via litige_id
-- aucun ajout nécessaire

-- coverage_requests : colonne organisme_id alias (bloc 20 utilise organisme_id)
alter table coverage_requests
  add column if not exists organisme_id uuid references coverage_orgs(id);

-- ─── C. CONTRAINTES SPEC 26.4 — RÈGLES DE COHÉRENCE ─────────────────────────

-- Spec 26.4 : un rendez-vous doit toujours être rattaché à un patient,
-- un professionnel et un créneau.
-- patient_id et schedule_id sont déjà NOT NULL.
-- professional_id est nullable (en cas d'établissement seul) — on ajoute un check.
alter table appointments
  add constraint if not exists chk_appointment_has_provider
  check (professional_id is not null or establishment_id is not null);

-- Spec 26.4 : une ordonnance doit toujours être rattachée à un patient et
-- à son prescripteur — déjà NOT NULL dans 0003_schema.sql.

-- Spec 26.4 : une réservation doit toujours être rattachée à un patient
-- et à une pharmacie — déjà NOT NULL.

-- Spec 26.4 : une demande de prise en charge doit être liée à un organisme
-- et à une opération concernée.
alter table coverage_requests
  add constraint if not exists chk_coverage_request_has_operation
  check (
    prescription_id is not null or
    reservation_id  is not null or
    appointment_id  is not null
  );

-- Spec 26.4 : un paiement doit être rattaché à une opération et à un payeur.
-- payer_id est déjà NOT NULL. On s'assure qu'une opération est présente.
alter table payments
  add constraint if not exists chk_payment_has_operation
  check (
    reservation_id  is not null or
    appointment_id  is not null or
    subscription_id is not null
  );

-- Spec 26.4 : un retrait ne peut être enregistré qu'une seule fois.
-- pharmacy_reservations.pickup_code est déjà UNIQUE.
-- On ajoute un index partiel sur collected_at pour détecter les doublons.
create unique index if not exists idx_reservation_single_collection
  on pharmacy_reservations(id)
  where collected_at is not null;

-- ─── D. INDEX BLOC 26 ────────────────────────────────────────────────────────

-- system_events
create index if not exists idx_system_events_type     on system_events(event_type);
create index if not exists idx_system_events_actor    on system_events(actor_id);
create index if not exists idx_system_events_category on system_events(category);
create index if not exists idx_system_events_created  on system_events(created_at desc);
create index if not exists idx_system_events_result   on system_events(result);

-- health_record_entries
create index if not exists idx_hr_entries_record on health_record_entries(health_record_id);

-- professional_specialties
create index if not exists idx_prof_specialties on professional_specialties(professional_id);

-- platform_settings
create index if not exists idx_platform_settings_category on platform_settings(category);

-- feature_flags
create index if not exists idx_feature_flags_category on feature_flags(category);

-- subscriptions (colonnes ajoutées)
create index if not exists idx_subscriptions_actor    on subscriptions(actor_type, actor_id);
create index if not exists idx_subscriptions_status   on subscriptions(status);
create index if not exists idx_subscriptions_renewal  on subscriptions(renewal_at)
  where status in ('active', 'trialing', 'past_due');

-- ─── E. ARCHIVAGE / ANONYMISATION SPEC 26.4 ─────────────────────────────────
-- "Les données supprimées nécessaires à la traçabilité doivent être archivées
--  ou anonymisées selon les règles applicables."

-- Table d'archivage des profils supprimés (soft-delete déjà sur profiles via is_deleted)
create table if not exists archived_profiles (
  id              uuid primary key default gen_random_uuid(),
  original_id     uuid not null,
  actor_type      text,
  anonymized_data jsonb not null default '{}',
  reason          text,
  archived_by     uuid,
  archived_at     timestamptz default now()
);

-- ─── F. RLS SUR NOUVELLES TABLES ─────────────────────────────────────────────

alter table system_events        enable row level security;
alter table platform_settings    enable row level security;
alter table feature_flags        enable row level security;
alter table health_record_entries enable row level security;
alter table professional_specialties enable row level security;
alter table archived_profiles    enable row level security;

-- system_events : lecture réservée aux admins et super_admins
create policy if not exists "system_events_admin_read"
  on system_events for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.actor_type::text = 'admin' or p.actor_type::text = 'super_admin')
    )
  );

-- platform_settings : lecture/écriture super_admin uniquement
create policy if not exists "platform_settings_superadmin"
  on platform_settings for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.actor_type::text = 'super_admin'
    )
  );

-- feature_flags : lecture publique (feature gates côté client), écriture super_admin
create policy if not exists "feature_flags_read"
  on feature_flags for select
  using (true);

create policy if not exists "feature_flags_write_superadmin"
  on feature_flags for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.actor_type::text = 'super_admin'
    )
  );

-- health_record_entries : même politique que health_records (patient + professionnel)
create policy if not exists "hr_entries_patient_read"
  on health_record_entries for select
  using (
    exists (
      select 1 from health_records hr
      join patients pat on pat.id = hr.patient_id
      where hr.id = health_record_entries.health_record_id
        and pat.profile_id = auth.uid()
    )
  );

create policy if not exists "hr_entries_professional_write"
  on health_record_entries for all
  using (
    exists (
      select 1 from professionals pro
      where pro.profile_id = auth.uid()
        and pro.id = health_record_entries.recorded_by
    )
  );
