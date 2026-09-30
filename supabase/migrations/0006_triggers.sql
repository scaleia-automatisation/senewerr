-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS — Séné Wérr
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Auto updated_at ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_patients_updated_at before update on patients
  for each row execute function set_updated_at();
create trigger trg_professionals_updated_at before update on professionals
  for each row execute function set_updated_at();
create trigger trg_establishments_updated_at before update on establishments
  for each row execute function set_updated_at();
create trigger trg_pharmacies_updated_at before update on pharmacies
  for each row execute function set_updated_at();
create trigger trg_coverage_orgs_updated_at before update on coverage_orgs
  for each row execute function set_updated_at();
create trigger trg_schedules_updated_at before update on schedules
  for each row execute function set_updated_at();
create trigger trg_appointments_updated_at before update on appointments
  for each row execute function set_updated_at();
create trigger trg_consultations_updated_at before update on consultations
  for each row execute function set_updated_at();
create trigger trg_prescriptions_updated_at before update on prescriptions
  for each row execute function set_updated_at();
create trigger trg_pharmacy_reservations_updated_at before update on pharmacy_reservations
  for each row execute function set_updated_at();
create trigger trg_coverage_requests_updated_at before update on coverage_requests
  for each row execute function set_updated_at();
create trigger trg_payments_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();
create trigger trg_notification_prefs_updated_at before update on notification_preferences
  for each row execute function set_updated_at();
create trigger trg_documents_updated_at before update on documents
  for each row execute function set_updated_at();
create trigger trg_litiges_updated_at before update on litiges
  for each row execute function set_updated_at();
create trigger trg_pharmacy_stock_updated_at before update on pharmacy_stock
  for each row execute function set_updated_at();

-- ─── Création automatique du profil après signup ──────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  meta jsonb;
begin
  meta := new.raw_user_meta_data;
  insert into profiles (
    id,
    actor_type,
    first_name,
    last_name,
    phone,
    email,
    account_status
  ) values (
    new.id,
    (meta->>'actor_type')::actor_type,
    coalesce(meta->>'first_name', 'Utilisateur'),
    coalesce(meta->>'last_name', ''),
    coalesce(meta->>'phone', ''),
    new.email,
    case
      when (meta->>'actor_type') = 'patient' then 'verified'::account_status
      else 'pending'::account_status
    end
  );

  -- Créer automatiquement le dossier patient si actor_type = patient
  if (meta->>'actor_type') = 'patient' then
    insert into patients (profile_id, date_of_birth)
    values (
      new.id,
      case
        when meta->>'date_of_birth' is not null
        then (meta->>'date_of_birth')::date
        else null
      end
    );

    -- Préférences de notification par défaut
    insert into notification_preferences (profile_id) values (new.id);
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Expiry job à la création d'une réservation ───────────────────────────
create or replace function handle_reservation_expiry_job()
returns trigger language plpgsql as $$
begin
  insert into reservation_expiry_jobs (reservation_id, expires_at)
  values (new.id, new.expiry_at)
  on conflict (reservation_id) do update set expires_at = new.expiry_at, processed = false;
  return new;
end $$;

create trigger trg_reservation_expiry_job
  after insert or update of expiry_at on pharmacy_reservations
  for each row execute function handle_reservation_expiry_job();

-- ─── Invoice number auto-génération ──────────────────────────────────────
create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'FAC-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad((nextval('invoice_seq'))::text, 5, '0');
  end if;
  return new;
end $$;

create sequence if not exists invoice_seq start 1;

create trigger trg_invoice_number
  before insert on invoices
  for each row execute function generate_invoice_number();

-- ─── Audit: log des changements de statut de compte ─────────────────────
create or replace function audit_account_status_change()
returns trigger language plpgsql as $$
begin
  if old.account_status is distinct from new.account_status then
    insert into audit_logs (actor_id, action, table_name, record_id, old_values, new_values)
    values (
      auth.uid(),
      'account_status_change',
      'profiles',
      new.id,
      jsonb_build_object('account_status', old.account_status),
      jsonb_build_object('account_status', new.account_status)
    );
  end if;
  return new;
end $$;

create trigger trg_audit_profile_status
  after update on profiles
  for each row execute function audit_account_status_change();

-- ─── Calcul automatique net_amount_fcfa dans payments ────────────────────
create or replace function calc_payment_net()
returns trigger language plpgsql as $$
begin
  new.net_amount_fcfa := new.amount_fcfa - coalesce(new.fee_fcfa, 0);
  return new;
end $$;

create trigger trg_payment_net
  before insert or update of amount_fcfa, fee_fcfa on payments
  for each row execute function calc_payment_net();
