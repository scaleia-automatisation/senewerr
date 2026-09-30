-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTIONS SCHÉMA — colonnes manquantes identifiées lors de l'audit
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles : colonne full_name calculée ────────────────────────────────
alter table profiles
  add column if not exists full_name text generated always as (first_name || ' ' || last_name) stored;

create index if not exists idx_profiles_full_name on profiles(full_name);

-- ─── 2. pharmacy_reservations : colonnes métier manquantes ───────────────────
alter table pharmacy_reservations
  add column if not exists quantity        integer,
  add column if not exists pharmacist_notes text,
  add column if not exists has_coverage    boolean default false;

-- ─── 3. payments : colonnes manquantes pour le frontend ──────────────────────
alter table payments
  add column if not exists payment_type   text,
  add column if not exists reference_code text,
  add column if not exists confirmed_at   timestamptz,
  add column if not exists patient_id     uuid references patients(id),
  add column if not exists pharmacy_id    uuid references pharmacies(id),
  add column if not exists notes          text,
  add column if not exists receipt_url    text,
  add column if not exists reconciled_at  timestamptz;

create index if not exists idx_payments_patient_id  on payments(patient_id);
create index if not exists idx_payments_pharmacy_id on payments(pharmacy_id);
create index if not exists idx_payments_payment_type on payments(payment_type);

-- ─── 4. coverage_requests : colonnes alias pour le frontend ──────────────────
-- Le front utilise des noms courts ; on ajoute ces colonnes en complément
-- des colonnes _fcfa existantes.
alter table coverage_requests
  add column if not exists amount_total        integer,
  add column if not exists amount_covered      integer,
  add column if not exists amount_patient      integer,
  add column if not exists decided_at          timestamptz,
  add column if not exists decision_notes      text,
  add column if not exists exclusions_notes    text,
  add column if not exists required_documents  text;

-- ─── 5. Synchronisation bidirectionnelle coverage_requests ───────────────────
-- Trigger qui maintient la cohérence entre colonnes _fcfa et colonnes courtes
create or replace function sync_coverage_amounts() returns trigger language plpgsql as $$
begin
  -- priorité aux colonnes courtes (front)
  if NEW.amount_total is not null and NEW.amount_total is distinct from OLD.amount_total then
    NEW.total_amount_fcfa := NEW.amount_total;
  elsif NEW.total_amount_fcfa is not null and NEW.total_amount_fcfa is distinct from OLD.total_amount_fcfa then
    NEW.amount_total := NEW.total_amount_fcfa;
  end if;

  if NEW.amount_covered is not null and NEW.amount_covered is distinct from OLD.amount_covered then
    NEW.coverage_amount_fcfa := NEW.amount_covered;
  elsif NEW.coverage_amount_fcfa is not null and NEW.coverage_amount_fcfa is distinct from OLD.coverage_amount_fcfa then
    NEW.amount_covered := NEW.coverage_amount_fcfa;
  end if;

  if NEW.amount_patient is not null and NEW.amount_patient is distinct from OLD.amount_patient then
    NEW.patient_amount_fcfa := NEW.amount_patient;
  elsif NEW.patient_amount_fcfa is not null and NEW.patient_amount_fcfa is distinct from OLD.patient_amount_fcfa then
    NEW.amount_patient := NEW.patient_amount_fcfa;
  end if;

  if NEW.decided_at is not null and NEW.decided_at is distinct from OLD.decided_at then
    NEW.reviewed_at := NEW.decided_at;
  elsif NEW.reviewed_at is not null and NEW.reviewed_at is distinct from OLD.reviewed_at then
    NEW.decided_at := NEW.reviewed_at;
  end if;

  if NEW.decision_notes is not null and NEW.decision_notes is distinct from OLD.decision_notes then
    NEW.admin_notes := NEW.decision_notes;
  elsif NEW.admin_notes is not null and NEW.admin_notes is distinct from OLD.admin_notes then
    NEW.decision_notes := NEW.admin_notes;
  end if;

  if NEW.required_documents is not null and NEW.required_documents is distinct from OLD.required_documents then
    NEW.additional_docs_requested := NEW.required_documents;
  elsif NEW.additional_docs_requested is not null and NEW.additional_docs_requested is distinct from OLD.additional_docs_requested then
    NEW.required_documents := NEW.additional_docs_requested;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_coverage_amounts on coverage_requests;
create trigger trg_sync_coverage_amounts
  before insert or update on coverage_requests
  for each row execute function sync_coverage_amounts();

-- ─── 6. Vue coverage_policies (alias de coverage_plans) ──────────────────────
create or replace view coverage_policies as
  select
    id,
    coverage_org_id,
    name       as plan_name,
    description,
    is_active,
    created_at,
    updated_at
  from coverage_plans;
