-- ─── Index de performance ───────────────────────────────────────────────

-- profiles
create index idx_profiles_phone on profiles(phone);
create index idx_profiles_actor_type on profiles(actor_type);
create index idx_profiles_account_status on profiles(account_status);

-- patients
create index idx_patients_profile on patients(profile_id);

-- beneficiaries
create index idx_beneficiaries_patient on patient_beneficiaries(patient_id);

-- professionals
create index idx_professionals_profile on professionals(profile_id);
create index idx_professionals_type on professionals(professional_type);
create index idx_professionals_plan on professionals(plan);

-- establishments
create index idx_establishments_profile on establishments(profile_id);
create index idx_establishments_type on establishments(establishment_type);
create index idx_establishments_region on establishments(address_region);

-- pharmacies
create index idx_pharmacies_profile on pharmacies(profile_id);
create index idx_pharmacies_plan on pharmacies(plan);
create index idx_pharmacies_region on pharmacies(address_region);

-- pharmacy_products
create index idx_products_pharmacy on pharmacy_products(pharmacy_id);
create index idx_products_available on pharmacy_products(pharmacy_id, is_available);
create index idx_products_name_trgm on pharmacy_products using gin(name gin_trgm_ops);
create index idx_products_generic_trgm on pharmacy_products using gin(generic_name gin_trgm_ops);

-- pharmacy_stock
create index idx_stock_pharmacy on pharmacy_stock(pharmacy_id);
create index idx_stock_product on pharmacy_stock(product_id);

-- coverage_orgs
create index idx_coverage_orgs_profile on coverage_orgs(profile_id);
create index idx_coverage_orgs_type on coverage_orgs(org_type);

-- coverage_members
create index idx_coverage_members_org on coverage_members(coverage_org_id);
create index idx_coverage_members_patient on coverage_members(patient_id);
create index idx_coverage_members_active on coverage_members(coverage_org_id, is_active);

-- schedules
create index idx_schedules_professional on schedules(professional_id);
create index idx_schedules_establishment on schedules(establishment_id);

-- appointments
create index idx_appointments_patient on appointments(patient_id);
create index idx_appointments_professional on appointments(professional_id);
create index idx_appointments_establishment on appointments(establishment_id);
create index idx_appointments_date on appointments(appointment_date, start_time);
create index idx_appointments_status on appointments(status);
create index idx_appointments_schedule on appointments(schedule_id, appointment_date);

-- consultations
create index idx_consultations_patient on consultations(patient_id);
create index idx_consultations_professional on consultations(professional_id);

-- prescriptions
create index idx_prescriptions_patient on prescriptions(patient_id);
create index idx_prescriptions_professional on prescriptions(professional_id);
create index idx_prescriptions_status on prescriptions(status);
create index idx_prescriptions_share_token on prescriptions(share_token);
create index idx_prescriptions_qr_code on prescriptions(qr_code);

-- pharmacy_reservations
create index idx_reservations_pharmacy on pharmacy_reservations(pharmacy_id);
create index idx_reservations_patient on pharmacy_reservations(patient_id);
create index idx_reservations_status on pharmacy_reservations(status);
create index idx_reservations_pickup_code on pharmacy_reservations(pickup_code);
create index idx_reservations_expiry on pharmacy_reservations(expiry_at) where status not in ('collected','cancelled','expired','refused');

-- coverage_requests
create index idx_coverage_requests_org on coverage_requests(coverage_org_id);
create index idx_coverage_requests_member on coverage_requests(coverage_member_id);
create index idx_coverage_requests_status on coverage_requests(status);

-- payments
create index idx_payments_payer on payments(payer_id);
create index idx_payments_status on payments(status);
create index idx_payments_reservation on payments(reservation_id);
create index idx_payments_reference on payments(reference);

-- notifications
create index idx_notifications_recipient on notifications(recipient_id);
create index idx_notifications_unread on notifications(recipient_id, is_read) where is_read = false;

-- documents
create index idx_documents_owner on documents(owner_id);
create index idx_documents_patient on documents(patient_id);
create index idx_documents_type on documents(document_type);

-- audit_logs
create index idx_audit_actor on audit_logs(actor_id);
create index idx_audit_table on audit_logs(table_name, record_id);
create index idx_audit_created on audit_logs(created_at desc);

-- event_logs
create index idx_event_logs_type on event_logs(event_type);
create index idx_event_logs_actor on event_logs(actor_id);
create index idx_event_logs_created on event_logs(created_at desc);

-- reviews
create index idx_reviews_professional on reviews(professional_id);
create index idx_reviews_establishment on reviews(establishment_id);
create index idx_reviews_pharmacy on reviews(pharmacy_id);

-- expiry jobs
create index idx_expiry_jobs_expires on reservation_expiry_jobs(expires_at) where processed = false;
