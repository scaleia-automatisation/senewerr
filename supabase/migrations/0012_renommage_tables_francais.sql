-- ═══════════════════════════════════════════════════════════════════════════
-- SÉNÉ WÉRR — Renommage de toutes les tables en français
-- Directive : toutes les tables présentes et futures en français
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. RENOMMAGE DES TABLES ─────────────────────────────────────────────────
-- PostgreSQL met à jour automatiquement : index, triggers, FK contraintes

alter table if exists profiles rename to profils;
alter table if exists patient_beneficiaries rename to beneficiaires;
alter table if exists patient_consents rename to consentements;
alter table if exists professionals rename to professionnels;
alter table if exists professional_qualifications rename to qualifications_professionnelles;
alter table if exists establishments rename to etablissements;
alter table if exists establishment_services rename to services_etablissement;
alter table if exists professional_establishment_memberships rename to affiliations_etablissement;
alter table if exists pharmacy_products rename to produits_pharmacie;
alter table if exists pharmacy_stock_movements rename to mouvements_stock;
alter table if exists pharmacy_stock rename to stock_pharmacie;
alter table if exists coverage_orgs rename to organismes_couverture;
alter table if exists coverage_plans rename to formules_couverture;
alter table if exists coverage_rules rename to regles_couverture;
alter table if exists coverage_members rename to adherents_couverture;
alter table if exists schedules rename to plannings;
alter table if exists schedule_slots rename to creneaux_planning;
alter table if exists schedule_exceptions rename to exceptions_planning;
alter table if exists appointments rename to rendez_vous;
alter table if exists health_records rename to dossiers_medicaux;
alter table if exists prescriptions rename to ordonnances;
alter table if exists prescription_items rename to articles_ordonnance;
alter table if exists pharmacy_reservations rename to reservations_pharmacie;
alter table if exists pharmacy_reservation_items rename to articles_reservation;
alter table if exists coverage_requests rename to demandes_couverture;
alter table if exists coverage_decisions rename to decisions_couverture;
alter table if exists payments rename to paiements;
alter table if exists payment_events rename to evenements_paiement;
alter table if exists invoices rename to factures;
alter table if exists refunds rename to remboursements;
alter table if exists subscriptions rename to abonnements;
alter table if exists notification_preferences rename to preferences_notifications;
alter table if exists litige_messages rename to messages_litige;
alter table if exists audit_logs rename to journaux_audit;
alter table if exists event_logs rename to journaux_evenements;
alter table if exists reviews rename to avis;
alter table if exists review_replies rename to reponses_avis;
alter table if exists pricing_plans rename to grilles_tarifs;
alter table if exists verification_tokens rename to jetons_verification;
alter table if exists reservation_expiry_jobs rename to expirations_reservations;
alter table if exists health_record_entries rename to entrees_dossiers;
alter table if exists professional_specialties rename to specialites_professionnelles;
alter table if exists system_events rename to evenements_systeme;
alter table if exists platform_settings rename to parametres_plateforme;
alter table if exists feature_flags rename to drapeaux_fonctionnalites;
alter table if exists archived_profiles rename to profils_archives;
alter table if exists login_attempts rename to tentatives_connexion;
-- tables déjà en français (inchangées) :
-- patients, pharmacies, consultations, notifications, documents, litiges,
-- messages, teleconsultation_sessions, coverage_guarantees (future)

-- ─── 2. MISE À JOUR DES FONCTIONS HELPER RLS ─────────────────────────────────

create or replace function is_admin() returns boolean
  language sql stable as $$
    select exists (
      select 1 from profils
      where id = auth.uid() and actor_type in ('admin', 'super_admin')
    )
  $$;

create or replace function my_actor_type() returns actor_type
  language sql stable as $$
    select actor_type from profils where id = auth.uid()
  $$;

-- ─── 3. MISE À JOUR DES FONCTIONS DE TRIGGERS ────────────────────────────────

-- Trigger création de profil (auth.users → profils + patients + preferences_notifications)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  meta jsonb;
begin
  meta := new.raw_user_meta_data;
  insert into profils (
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
    coalesce(meta->>'first_name', split_part(new.email, '@', 1)),
    coalesce(meta->>'last_name', ''),
    nullif(coalesce(meta->>'phone', ''), ''),
    new.email,
    case
      when (meta->>'actor_type') = 'patient' then 'verified'::account_status
      else 'pending'::account_status
    end
  );

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
    insert into preferences_notifications (profile_id) values (new.id);
  end if;

  return new;
end $$;

-- Trigger expiry des réservations
create or replace function handle_reservation_expiry_job()
returns trigger language plpgsql as $$
begin
  insert into expirations_reservations (reservation_id, expires_at)
  values (new.id, new.expiry_at)
  on conflict (reservation_id) do update set expires_at = new.expiry_at, processed = false;
  return new;
end $$;

-- Trigger audit changement de statut de compte
create or replace function audit_account_status_change()
returns trigger language plpgsql as $$
begin
  if old.account_status is distinct from new.account_status then
    insert into journaux_audit (actor_id, action, table_name, record_id, old_values, new_values)
    values (
      auth.uid(),
      'account_status_change',
      'profils',
      new.id,
      jsonb_build_object('account_status', old.account_status),
      jsonb_build_object('account_status', new.account_status)
    );
  end if;
  return new;
end $$;

-- ─── 4. MISE À JOUR DE LA VUE coverage_policies ──────────────────────────────

create or replace view coverage_policies as
  select
    id,
    coverage_org_id,
    name       as plan_name,
    description,
    is_active,
    created_at,
    updated_at
  from formules_couverture;

-- ─── 5. RECREER LES POLITIQUES RLS AFFECTÉES ─────────────────────────────────
-- (celles dont le corps USING/WITH CHECK joint des tables renommées)

-- profils
drop policy if exists "profiles: voir son propre profil" on profils;
drop policy if exists "profiles: modifier son propre profil" on profils;
drop policy if exists "profiles: insertion par trigger auth uniquement" on profils;

create policy "profils: voir son propre profil"
  on profils for select using (id = auth.uid() or is_admin());
create policy "profils: modifier son propre profil"
  on profils for update using (id = auth.uid());
create policy "profils: insertion par trigger auth uniquement"
  on profils for insert with check (id = auth.uid());

-- patients (JOIN vers rendez_vous, professionnels, etablissements)
drop policy if exists "patients: accès propre dossier" on patients;
drop policy if exists "patients: visible par professionnels et pharmacies liés" on patients;

create policy "patients: accès propre dossier"
  on patients for all using (profile_id = auth.uid() or is_admin());
create policy "patients: visible par professionnels et pharmacies liés"
  on patients for select using (
    is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from rendez_vous a
      where a.patient_id = patients.id
        and (
          a.professional_id in (select id from professionnels where profile_id = auth.uid())
          or a.establishment_id in (select id from etablissements where profile_id = auth.uid())
        )
    )
  );

-- beneficiaires
drop policy if exists "beneficiaires: accès patient propriétaire" on beneficiaires;
create policy "beneficiaires: accès patient propriétaire"
  on beneficiaires for all using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );

-- professionnels
drop policy if exists "professionals: public peut voir les vérifiés" on professionnels;
drop policy if exists "professionals: modifier son propre profil" on professionnels;
drop policy if exists "professionals: insertion par owner" on professionnels;

create policy "professionnels: public peut voir les vérifiés"
  on professionnels for select using (
    profile_id in (select id from profils where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );
create policy "professionnels: modifier son propre profil"
  on professionnels for update using (profile_id = auth.uid());
create policy "professionnels: insertion par owner"
  on professionnels for insert with check (profile_id = auth.uid());

-- etablissements
drop policy if exists "establishments: public peut voir les vérifiés" on etablissements;
drop policy if exists "establishments: modifier son propre établissement" on etablissements;
drop policy if exists "establishments: insertion par owner" on etablissements;

create policy "etablissements: public peut voir les vérifiés"
  on etablissements for select using (
    profile_id in (select id from profils where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );
create policy "etablissements: modifier son propre établissement"
  on etablissements for update using (profile_id = auth.uid());
create policy "etablissements: insertion par owner"
  on etablissements for insert with check (profile_id = auth.uid());

-- services_etablissement
drop policy if exists "services: lecture publique" on services_etablissement;
drop policy if exists "services: gestion par établissement" on services_etablissement;

create policy "services: lecture publique"
  on services_etablissement for select using (true);
create policy "services: gestion par établissement"
  on services_etablissement for all using (
    establishment_id in (select id from etablissements where profile_id = auth.uid())
    or is_admin()
  );

-- pharmacies
drop policy if exists "pharmacies: public peut voir les vérifiées" on pharmacies;
drop policy if exists "pharmacies: modifier sa propre pharmacie" on pharmacies;
drop policy if exists "pharmacies: insertion par owner" on pharmacies;

create policy "pharmacies: public peut voir les vérifiées"
  on pharmacies for select using (
    profile_id in (select id from profils where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );
create policy "pharmacies: modifier sa propre pharmacie"
  on pharmacies for update using (profile_id = auth.uid());
create policy "pharmacies: insertion par owner"
  on pharmacies for insert with check (profile_id = auth.uid());

-- produits_pharmacie
drop policy if exists "products: lecture publique si pharmacie active" on produits_pharmacie;
drop policy if exists "products: gestion par pharmacie owner" on produits_pharmacie;

create policy "produits: lecture publique si pharmacie active"
  on produits_pharmacie for select using (
    pharmacy_id in (select id from pharmacies where profile_id in (
      select id from profils where account_status = 'verified'
    ))
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );
create policy "produits: gestion par pharmacie owner"
  on produits_pharmacie for all using (
    pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- stock_pharmacie
drop policy if exists "stock: visible par pharmacie owner" on stock_pharmacie;
create policy "stock: visible par pharmacie owner"
  on stock_pharmacie for all using (
    pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- rendez_vous
drop policy if exists "rdv: patient voit ses rendez-vous" on rendez_vous;
drop policy if exists "rdv: patient peut créer" on rendez_vous;
drop policy if exists "rdv: modification par parties concernées" on rendez_vous;

create policy "rdv: patient voit ses rendez-vous"
  on rendez_vous for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionnels where profile_id = auth.uid())
    or establishment_id in (select id from etablissements where profile_id = auth.uid())
    or is_admin()
  );
create policy "rdv: patient peut créer"
  on rendez_vous for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );
create policy "rdv: modification par parties concernées"
  on rendez_vous for update using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionnels where profile_id = auth.uid())
    or establishment_id in (select id from etablissements where profile_id = auth.uid())
    or is_admin()
  );

-- ordonnances
drop policy if exists "ordonnances: patient voit les siennes" on ordonnances;
drop policy if exists "ordonnances: professionnel peut créer" on ordonnances;
drop policy if exists "ordonnances: modification par créateur" on ordonnances;

create policy "ordonnances: patient voit les siennes"
  on ordonnances for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionnels where profile_id = auth.uid())
    or is_admin()
  );
create policy "ordonnances: professionnel peut créer"
  on ordonnances for insert with check (
    professional_id in (select id from professionnels where profile_id = auth.uid())
    or is_admin()
  );
create policy "ordonnances: modification par créateur"
  on ordonnances for update using (
    professional_id in (select id from professionnels where profile_id = auth.uid())
    or is_admin()
  );

-- reservations_pharmacie
drop policy if exists "reservations: patient voit les siennes" on reservations_pharmacie;
drop policy if exists "reservations: patient peut créer" on reservations_pharmacie;
drop policy if exists "reservations: modification par parties" on reservations_pharmacie;

create policy "reservations: patient voit les siennes"
  on reservations_pharmacie for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );
create policy "reservations: patient peut créer"
  on reservations_pharmacie for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );
create policy "reservations: modification par parties"
  on reservations_pharmacie for update using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- demandes_couverture
drop policy if exists "pec: visible par parties concernées" on demandes_couverture;
create policy "pec: visible par parties concernées"
  on demandes_couverture for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or coverage_org_id in (select id from organismes_couverture where profile_id = auth.uid())
    or is_admin()
  );

-- formules_couverture
drop policy if exists "formules: lecture publique si org active" on formules_couverture;
drop policy if exists "formules: gestion par org" on formules_couverture;

create policy "formules: lecture publique si org active"
  on formules_couverture for select using (
    coverage_org_id in (
      select id from organismes_couverture where profile_id in (
        select id from profils where account_status = 'verified'
      )
    )
    or coverage_org_id in (select id from organismes_couverture where profile_id = auth.uid())
    or is_admin()
  );
create policy "formules: gestion par org"
  on formules_couverture for all using (
    coverage_org_id in (select id from organismes_couverture where profile_id = auth.uid())
    or is_admin()
  );

-- adherents_couverture
drop policy if exists "adherents: patient voit ses adhésions" on adherents_couverture;
create policy "adherents: patient voit ses adhésions"
  on adherents_couverture for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or coverage_org_id in (select id from organismes_couverture where profile_id = auth.uid())
    or is_admin()
  );

-- plannings
drop policy if exists "agendas: lecture publique" on plannings;
drop policy if exists "agendas: gestion par owner" on plannings;

create policy "plannings: lecture publique"
  on plannings for select using (is_active = true);
create policy "plannings: gestion par owner"
  on plannings for all using (
    professional_id in (select id from professionnels where profile_id = auth.uid())
    or establishment_id in (select id from etablissements where profile_id = auth.uid())
    or is_admin()
  );

-- creneaux_planning
drop policy if exists "slots: lecture publique" on creneaux_planning;
drop policy if exists "slots: gestion via agenda owner" on creneaux_planning;

create policy "creneaux: lecture publique"
  on creneaux_planning for select using (true);
create policy "creneaux: gestion via agenda owner"
  on creneaux_planning for all using (
    schedule_id in (
      select s.id from plannings s
      where s.professional_id in (select id from professionnels where profile_id = auth.uid())
         or s.establishment_id in (select id from etablissements where profile_id = auth.uid())
    )
    or is_admin()
  );

-- dossiers_medicaux
drop policy if exists "dossiers: patient et professionnel créateur" on dossiers_medicaux;
create policy "dossiers: patient et professionnel créateur"
  on dossiers_medicaux for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or recorded_by in (select id from professionnels where profile_id = auth.uid())
    or is_admin()
  );

-- journaux_audit / journaux_evenements
drop policy if exists "audit: super admin seulement" on journaux_audit;
drop policy if exists "event_logs: super admin seulement" on journaux_evenements;

create policy "audit: super admin seulement"
  on journaux_audit for select using (
    exists (select 1 from profils where id = auth.uid() and actor_type = 'super_admin')
  );
create policy "evenements: super admin seulement"
  on journaux_evenements for select using (
    exists (select 1 from profils where id = auth.uid() and actor_type = 'super_admin')
  );

-- avis
drop policy if exists "avis: lecture publique" on avis;
drop policy if exists "avis: patient peut créer" on avis;
drop policy if exists "avis: patient peut modifier les siens" on avis;

create policy "avis: lecture publique"
  on avis for select using (
    is_visible = true
    or patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );
create policy "avis: patient peut créer"
  on avis for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
  );
create policy "avis: patient peut modifier les siens"
  on avis for update using (
    patient_id in (select id from patients where profile_id = auth.uid()) or is_admin()
  );

-- grilles_tarifs (inchangé structurellement)
drop policy if exists "tarifs: lecture publique" on grilles_tarifs;
create policy "tarifs: lecture publique"
  on grilles_tarifs for select using (is_active = true);

-- notifications (inchangé)
drop policy if exists "notifs: destinataire uniquement" on notifications;
create policy "notifs: destinataire uniquement"
  on notifications for all using (recipient_id = auth.uid() or is_admin());

-- documents (inchangé)
drop policy if exists "docs: owner et partagés" on documents;
drop policy if exists "docs: modification par owner" on documents;
create policy "docs: owner et partagés"
  on documents for select using (
    owner_id = auth.uid()
    or auth.uid() = any(shared_with)
    or is_admin()
  );
create policy "docs: modification par owner"
  on documents for all using (owner_id = auth.uid() or is_admin());

-- paiements
drop policy if exists "paiements: visible par payeur" on paiements;
create policy "paiements: visible par payeur"
  on paiements for select using (
    payer_id = auth.uid() or payee_id = auth.uid() or is_admin()
  );

-- litiges (inchangé)
drop policy if exists "litiges: parties concernées" on litiges;
drop policy if exists "litiges: reporter peut créer" on litiges;
create policy "litiges: parties concernées"
  on litiges for select using (
    reporter_id = auth.uid() or reported_id = auth.uid() or is_admin()
  );
create policy "litiges: reporter peut créer"
  on litiges for insert with check (reporter_id = auth.uid());

-- messages (inchangé)
drop policy if exists "messages: envoyeur ou destinataire" on messages;
drop policy if exists "messages: envoyeur peut créer" on messages;
create policy "messages: envoyeur ou destinataire"
  on messages for select using (
    sender_id = auth.uid() or recipient_id = auth.uid() or is_admin()
  );
create policy "messages: envoyeur peut créer"
  on messages for insert with check (sender_id = auth.uid());

-- jetons_verification
drop policy if exists "tokens: owner uniquement" on jetons_verification;
create policy "jetons: owner uniquement"
  on jetons_verification for all using (profile_id = auth.uid() or is_admin());

-- preferences_notifications
drop policy if exists "notification_prefs_owner" on preferences_notifications;
create policy "preferences notifications: owner uniquement"
  on preferences_notifications for all using (profile_id = auth.uid() or is_admin());

-- ─── 6. MISE À JOUR DU TRIGGER trg_sync_coverage_amounts ─────────────────────
-- Le trigger est sur demandes_couverture (anciennement coverage_requests).
-- PostgreSQL a automatiquement mis à jour le trigger lors du RENAME.
-- La fonction sync_coverage_amounts() ne joint pas d'autres tables, pas de changement.
