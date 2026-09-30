-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — Séné Wérr
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles enable row level security;
alter table patients enable row level security;
alter table patient_beneficiaries enable row level security;
alter table patient_consents enable row level security;
alter table professionals enable row level security;
alter table professional_qualifications enable row level security;
alter table establishments enable row level security;
alter table establishment_services enable row level security;
alter table professional_establishment_memberships enable row level security;
alter table pharmacies enable row level security;
alter table pharmacy_products enable row level security;
alter table pharmacy_stock enable row level security;
alter table pharmacy_stock_movements enable row level security;
alter table coverage_orgs enable row level security;
alter table coverage_plans enable row level security;
alter table coverage_rules enable row level security;
alter table coverage_members enable row level security;
alter table schedules enable row level security;
alter table schedule_slots enable row level security;
alter table schedule_exceptions enable row level security;
alter table appointments enable row level security;
alter table consultations enable row level security;
alter table health_records enable row level security;
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
alter table pharmacy_reservations enable row level security;
alter table pharmacy_reservation_items enable row level security;
alter table coverage_requests enable row level security;
alter table coverage_decisions enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table invoices enable row level security;
alter table refunds enable row level security;
alter table subscriptions enable row level security;
alter table notifications enable row level security;
alter table notification_preferences enable row level security;
alter table documents enable row level security;
alter table litiges enable row level security;
alter table litige_messages enable row level security;
alter table audit_logs enable row level security;
alter table event_logs enable row level security;
alter table reviews enable row level security;
alter table review_replies enable row level security;
alter table messages enable row level security;
alter table pricing_plans enable row level security;
alter table verification_tokens enable row level security;
alter table teleconsultation_sessions enable row level security;

-- ─── Helper functions ─────────────────────────────────────────────────────
create or replace function auth_uid() returns uuid
  language sql stable as $$ select auth.uid() $$;

create or replace function is_admin() returns boolean
  language sql stable as $$
    select exists (
      select 1 from profiles
      where id = auth.uid() and actor_type in ('admin', 'super_admin')
    )
  $$;

create or replace function my_actor_type() returns actor_type
  language sql stable as $$
    select actor_type from profiles where id = auth.uid()
  $$;

-- ─── profiles ─────────────────────────────────────────────────────────────
create policy "profiles: voir son propre profil"
  on profiles for select using (id = auth.uid() or is_admin());

create policy "profiles: modifier son propre profil"
  on profiles for update using (id = auth.uid());

create policy "profiles: insertion par trigger auth uniquement"
  on profiles for insert with check (id = auth.uid());

-- ─── patients ─────────────────────────────────────────────────────────────
create policy "patients: accès propre dossier"
  on patients for all using (profile_id = auth.uid() or is_admin());

create policy "patients: visible par professionnels et pharmacies liés"
  on patients for select using (
    is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from appointments a
      where a.patient_id = patients.id
        and (
          a.professional_id in (select id from professionals where profile_id = auth.uid())
          or a.establishment_id in (select id from establishments where profile_id = auth.uid())
        )
    )
  );

-- ─── patient_beneficiaries ────────────────────────────────────────────────
create policy "beneficiaires: accès patient propriétaire"
  on patient_beneficiaries for all using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );

-- ─── professionals ────────────────────────────────────────────────────────
create policy "professionals: public peut voir les vérifiés"
  on professionals for select using (
    profile_id in (select id from profiles where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );

create policy "professionals: modifier son propre profil"
  on professionals for update using (profile_id = auth.uid());

create policy "professionals: insertion par owner"
  on professionals for insert with check (profile_id = auth.uid());

-- ─── establishments ───────────────────────────────────────────────────────
create policy "establishments: public peut voir les vérifiés"
  on establishments for select using (
    profile_id in (select id from profiles where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );

create policy "establishments: modifier son propre établissement"
  on establishments for update using (profile_id = auth.uid());

create policy "establishments: insertion par owner"
  on establishments for insert with check (profile_id = auth.uid());

-- ─── establishment_services ───────────────────────────────────────────────
create policy "services: lecture publique"
  on establishment_services for select using (true);

create policy "services: gestion par établissement"
  on establishment_services for all using (
    establishment_id in (select id from establishments where profile_id = auth.uid())
    or is_admin()
  );

-- ─── pharmacies ───────────────────────────────────────────────────────────
create policy "pharmacies: public peut voir les vérifiées"
  on pharmacies for select using (
    profile_id in (select id from profiles where account_status = 'verified')
    or profile_id = auth.uid()
    or is_admin()
  );

create policy "pharmacies: modifier sa propre pharmacie"
  on pharmacies for update using (profile_id = auth.uid());

create policy "pharmacies: insertion par owner"
  on pharmacies for insert with check (profile_id = auth.uid());

-- ─── pharmacy_products ────────────────────────────────────────────────────
create policy "products: lecture publique si pharmacie active"
  on pharmacy_products for select using (
    pharmacy_id in (select id from pharmacies where profile_id in (
      select id from profiles where account_status = 'verified'
    ))
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

create policy "products: gestion par pharmacie owner"
  on pharmacy_products for all using (
    pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- ─── pharmacy_stock ───────────────────────────────────────────────────────
create policy "stock: visible par pharmacie owner"
  on pharmacy_stock for all using (
    pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- ─── appointments ─────────────────────────────────────────────────────────
create policy "rdv: patient voit ses rendez-vous"
  on appointments for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionals where profile_id = auth.uid())
    or establishment_id in (select id from establishments where profile_id = auth.uid())
    or is_admin()
  );

create policy "rdv: patient peut créer"
  on appointments for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );

create policy "rdv: modification par parties concernées"
  on appointments for update using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionals where profile_id = auth.uid())
    or establishment_id in (select id from establishments where profile_id = auth.uid())
    or is_admin()
  );

-- ─── prescriptions ────────────────────────────────────────────────────────
create policy "ordonnances: patient voit les siennes"
  on prescriptions for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or professional_id in (select id from professionals where profile_id = auth.uid())
    or is_admin()
  );

create policy "ordonnances: professionnel peut créer"
  on prescriptions for insert with check (
    professional_id in (select id from professionals where profile_id = auth.uid())
    or is_admin()
  );

create policy "ordonnances: modification par créateur"
  on prescriptions for update using (
    professional_id in (select id from professionals where profile_id = auth.uid())
    or is_admin()
  );

-- ─── pharmacy_reservations ────────────────────────────────────────────────
create policy "reservations: patient voit les siennes"
  on pharmacy_reservations for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

create policy "reservations: patient peut créer"
  on pharmacy_reservations for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
    or is_admin()
  );

create policy "reservations: modification par parties"
  on pharmacy_reservations for update using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or pharmacy_id in (select id from pharmacies where profile_id = auth.uid())
    or is_admin()
  );

-- ─── coverage_requests ────────────────────────────────────────────────────
create policy "pec: visible par parties concernées"
  on coverage_requests for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or coverage_org_id in (select id from coverage_orgs where profile_id = auth.uid())
    or is_admin()
  );

-- ─── payments ─────────────────────────────────────────────────────────────
create policy "paiements: visible par payeur"
  on payments for select using (
    payer_id = auth.uid()
    or payee_id = auth.uid()
    or is_admin()
  );

-- ─── notifications ────────────────────────────────────────────────────────
create policy "notifs: destinataire uniquement"
  on notifications for all using (
    recipient_id = auth.uid() or is_admin()
  );

-- ─── documents ────────────────────────────────────────────────────────────
create policy "docs: owner et partagés"
  on documents for select using (
    owner_id = auth.uid()
    or auth.uid() = any(shared_with)
    or is_admin()
  );

create policy "docs: modification par owner"
  on documents for all using (
    owner_id = auth.uid() or is_admin()
  );

-- ─── pricing_plans ────────────────────────────────────────────────────────
create policy "tarifs: lecture publique"
  on pricing_plans for select using (is_active = true);

-- ─── coverage_plans ───────────────────────────────────────────────────────
create policy "formules: lecture publique si org active"
  on coverage_plans for select using (
    coverage_org_id in (
      select id from coverage_orgs where profile_id in (
        select id from profiles where account_status = 'verified'
      )
    )
    or coverage_org_id in (select id from coverage_orgs where profile_id = auth.uid())
    or is_admin()
  );

create policy "formules: gestion par org"
  on coverage_plans for all using (
    coverage_org_id in (select id from coverage_orgs where profile_id = auth.uid())
    or is_admin()
  );

-- ─── coverage_members ─────────────────────────────────────────────────────
create policy "adherents: patient voit ses adhésions"
  on coverage_members for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or coverage_org_id in (select id from coverage_orgs where profile_id = auth.uid())
    or is_admin()
  );

-- ─── schedules + slots ────────────────────────────────────────────────────
create policy "agendas: lecture publique"
  on schedules for select using (is_active = true);

create policy "agendas: gestion par owner"
  on schedules for all using (
    professional_id in (select id from professionals where profile_id = auth.uid())
    or establishment_id in (select id from establishments where profile_id = auth.uid())
    or is_admin()
  );

create policy "slots: lecture publique"
  on schedule_slots for select using (true);

create policy "slots: gestion via agenda owner"
  on schedule_slots for all using (
    schedule_id in (
      select s.id from schedules s
      where s.professional_id in (select id from professionals where profile_id = auth.uid())
         or s.establishment_id in (select id from establishments where profile_id = auth.uid())
    )
    or is_admin()
  );

-- ─── litiges ──────────────────────────────────────────────────────────────
create policy "litiges: parties concernées"
  on litiges for select using (
    reporter_id = auth.uid()
    or reported_id = auth.uid()
    or is_admin()
  );

create policy "litiges: reporter peut créer"
  on litiges for insert with check (reporter_id = auth.uid());

-- ─── messages ─────────────────────────────────────────────────────────────
create policy "messages: envoyeur ou destinataire"
  on messages for select using (
    sender_id = auth.uid() or recipient_id = auth.uid() or is_admin()
  );

create policy "messages: envoyeur peut créer"
  on messages for insert with check (sender_id = auth.uid());

-- ─── health_records ───────────────────────────────────────────────────────
create policy "dossiers: patient et professionnel créateur"
  on health_records for select using (
    patient_id in (select id from patients where profile_id = auth.uid())
    or recorded_by in (select id from professionals where profile_id = auth.uid())
    or is_admin()
  );

-- ─── audit_logs: super admin uniquement ──────────────────────────────────
create policy "audit: super admin seulement"
  on audit_logs for select using (
    exists (select 1 from profiles where id = auth.uid() and actor_type = 'super_admin')
  );

create policy "event_logs: super admin seulement"
  on event_logs for select using (
    exists (select 1 from profiles where id = auth.uid() and actor_type = 'super_admin')
  );

-- ─── verification_tokens ──────────────────────────────────────────────────
create policy "tokens: owner uniquement"
  on verification_tokens for all using (
    profile_id = auth.uid() or is_admin()
  );

-- ─── reviews ──────────────────────────────────────────────────────────────
create policy "avis: lecture publique"
  on reviews for select using (is_visible = true or patient_id in (select id from patients where profile_id = auth.uid()) or is_admin());

create policy "avis: patient peut créer"
  on reviews for insert with check (
    patient_id in (select id from patients where profile_id = auth.uid())
  );

create policy "avis: patient peut modifier les siens"
  on reviews for update using (
    patient_id in (select id from patients where profile_id = auth.uid()) or is_admin()
  );
