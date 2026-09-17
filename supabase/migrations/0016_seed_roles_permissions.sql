-- ============================================================
-- 0016_seed_roles_permissions.sql — Matrice des permissions
-- Source : BLOC 3 §3.3 + nomenclature domaine.action
-- ============================================================

INSERT INTO public.roles_permissions (role, permission, enabled) VALUES

-- ──────────────────────────────────────────────────────────
-- PATIENT
-- ──────────────────────────────────────────────────────────
('patient', 'patient.view_own_record',       true),
('patient', 'patient.manage_beneficiaries',  true),
('patient', 'patient.create_appointment',    true),
('patient', 'patient.cancel_appointment',    true),
('patient', 'patient.reschedule_appointment',true),
('patient', 'patient.confirm_arrival',       true),
('patient', 'patient.share_prescription',    true),
('patient', 'patient.revoke_prescription',   true),
('patient', 'patient.view_prescription',     true),
('patient', 'patient.pay',                   true),
('patient', 'patient.open_dispute',          true),
('patient', 'patient.request_account_deletion', true),

-- ──────────────────────────────────────────────────────────
-- PROFESSIONAL
-- ──────────────────────────────────────────────────────────
('professional', 'patient.view_own_record',       true),
('professional', 'professional.view_authorized_patient', true),
('professional', 'professional.manage_schedule',  true),
('professional', 'professional.create_appointment', true),
('professional', 'professional.cancel_appointment', true),
('professional', 'professional.start_consultation', true),
('professional', 'professional.end_consultation',  true),
('professional', 'professional.create_prescription',true),
('professional', 'professional.sign_prescription', true),
('professional', 'professional.share_prescription',true),
('professional', 'professional.confirm_arrival',   true),
('professional', 'professional.open_dispute',      true),
('professional', 'professional.search',            true),

-- ──────────────────────────────────────────────────────────
-- ESTABLISHMENT_ADMIN
-- ──────────────────────────────────────────────────────────
('establishment_admin', 'establishment.manage_team',         true),
('establishment_admin', 'establishment.invite_professional', true),
('establishment_admin', 'establishment.manage_appointments', true),
('establishment_admin', 'establishment.propose_schedule',    true),
('establishment_admin', 'establishment.confirm_arrival',     true),
('establishment_admin', 'establishment.open_dispute',        true),
('establishment_admin', 'establishment.search',              true),
('establishment_admin', 'patient.view_own_record',           true),

-- ──────────────────────────────────────────────────────────
-- ESTABLISHMENT_STAFF
-- ──────────────────────────────────────────────────────────
('establishment_staff', 'establishment.manage_appointments', true),
('establishment_staff', 'establishment.propose_schedule',    true),
('establishment_staff', 'establishment.confirm_arrival',     true),
('establishment_staff', 'establishment.search',              true),
('establishment_staff', 'patient.view_own_record',           true),

-- ──────────────────────────────────────────────────────────
-- PHARMACY_ADMIN
-- ──────────────────────────────────────────────────────────
('pharmacy_admin', 'pharmacy.manage_catalog',     true),
('pharmacy_admin', 'pharmacy.manage_prices',      true),
('pharmacy_admin', 'pharmacy.review_prescription',true),
('pharmacy_admin', 'pharmacy.confirm_reservation',true),
('pharmacy_admin', 'pharmacy.refuse_reservation', true),
('pharmacy_admin', 'pharmacy.prepare',            true),
('pharmacy_admin', 'pharmacy.confirm_withdrawal', true),
('pharmacy_admin', 'pharmacy.view_finances',      true),
('pharmacy_admin', 'pharmacy.manage_team',        true),
('pharmacy_admin', 'pharmacy.open_dispute',       true),
('pharmacy_admin', 'pharmacy.search',             true),
('pharmacy_admin', 'patient.view_own_record',     true),

-- ──────────────────────────────────────────────────────────
-- PHARMACY_STAFF
-- ──────────────────────────────────────────────────────────
('pharmacy_staff', 'pharmacy.manage_catalog',     true),
('pharmacy_staff', 'pharmacy.adjust_stock',       true),  -- stock only, not prices
('pharmacy_staff', 'pharmacy.review_prescription',true),
('pharmacy_staff', 'pharmacy.confirm_reservation',true),
('pharmacy_staff', 'pharmacy.refuse_reservation', true),
('pharmacy_staff', 'pharmacy.prepare',            true),
('pharmacy_staff', 'pharmacy.confirm_withdrawal', true),
('pharmacy_staff', 'pharmacy.search',             true),
('pharmacy_staff', 'patient.view_own_record',     true),

-- ──────────────────────────────────────────────────────────
-- MUTUAL_ADMIN
-- ──────────────────────────────────────────────────────────
('mutual_admin', 'mutual.manage_members',    true),
('mutual_admin', 'mutual.manage_rules',      true),
('mutual_admin', 'mutual.decide_coverage',   true),
('mutual_admin', 'mutual.pay',               true),
('mutual_admin', 'mutual.manage_team',       true),
('mutual_admin', 'mutual.open_dispute',      true),
('mutual_admin', 'mutual.search',            true),
('mutual_admin', 'patient.view_own_record',  true),

-- ──────────────────────────────────────────────────────────
-- MUTUAL_STAFF
-- ──────────────────────────────────────────────────────────
('mutual_staff', 'mutual.manage_members',   true),
('mutual_staff', 'mutual.decide_coverage',  true),  -- validation only, not rules
('mutual_staff', 'mutual.search',           true),
('mutual_staff', 'patient.view_own_record', true),

-- ──────────────────────────────────────────────────────────
-- PLATFORM_ADMIN
-- ──────────────────────────────────────────────────────────
('platform_admin', 'admin.verify_actors',         true),
('platform_admin', 'admin.suspend_actors',        true),
('platform_admin', 'admin.view_payments',         true),
('platform_admin', 'admin.send_reminder',         true),
('platform_admin', 'admin.refund',                true),  -- ≤ 50 000 FCFA
('platform_admin', 'admin.manage_disputes',       true),
('platform_admin', 'admin.manage_content',        true),
('platform_admin', 'admin.view_audit',            true),
('platform_admin', 'admin.manage_team',           true),
('platform_admin', 'admin.search',                true),
('platform_admin', 'admin.adjust_credits_small',  true),  -- ≤ 100 crédits
('platform_admin', 'patient.view_own_record',     true),

-- ──────────────────────────────────────────────────────────
-- SUPER_ADMIN
-- ──────────────────────────────────────────────────────────
('super_admin', 'admin.verify_actors',           true),
('super_admin', 'admin.suspend_actors',          true),
('super_admin', 'admin.view_payments',           true),
('super_admin', 'admin.send_reminder',           true),
('super_admin', 'admin.refund',                  true),
('super_admin', 'admin.manage_disputes',         true),
('super_admin', 'admin.manage_content',          true),
('super_admin', 'admin.view_audit',              true),
('super_admin', 'admin.manage_team',             true),
('super_admin', 'admin.search',                  true),
('super_admin', 'admin.adjust_credits_unlimited',true),
('super_admin', 'super.manage_settings',         true),
('super_admin', 'super.manage_plans',            true),
('super_admin', 'super.manage_promo_codes',      true),
('super_admin', 'super.manage_admins',           true),
('super_admin', 'super.view_all_data',           true),
('super_admin', 'patient.view_own_record',       true)

ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled;
