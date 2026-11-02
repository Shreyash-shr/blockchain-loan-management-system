-- ============================================================================
-- CREDCHAIN DATABASE SEED SCRIPT (PostgreSQL)
-- Generates default policy rules and authorized domain accounts (clean slate)
-- ============================================================================

-- 1. SEED DEFAULT LOAN POLICY RULES
INSERT INTO loan_policy_rules (
  id,
  min_cibil_score,
  min_age,
  max_age,
  min_monthly_income,
  max_existing_loans,
  max_dti_ratio,
  is_active,
  authority_memo_ref
) VALUES (
  1,
  750,
  21,
  60,
  25000.00,
  2,
  50.00,
  TRUE,
  'DIRECTIVE-NKOCET-2026/01'
)
ON CONFLICT (id) DO UPDATE SET
  min_cibil_score = EXCLUDED.min_cibil_score,
  min_age = EXCLUDED.min_age,
  max_age = EXCLUDED.max_age,
  min_monthly_income = EXCLUDED.min_monthly_income,
  is_active = TRUE;

SELECT setval('loan_policy_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM loan_policy_rules));

-- 2. SEED AUTHORIZED DOMAIN ACCOUNTS
-- Password hashes generated with pgcrypto / bcrypt (cost: 10)

-- 2a. Admin Account: NKOCTADMIN (AdminOrchid@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'NKOCTADMIN',
  'nkocetadmin@gmail.com',
  NULL,
  crypt('AdminOrchid@123', gen_salt('bf', 10)),
  'admin',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash;

-- 2b. Lender Accounts
-- NKOCET Accountant (Orchid@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'NKOCET Accountant',
  'nkocetaccount@gmail.com',
  NULL,
  crypt('Orchid@123', gen_salt('bf', 10)),
  'lender',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash;

-- NKOCET Accountant 2 (Orchid2@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'NKOCET Accountant 2',
  'nkocetaccount2@gmail.com',
  NULL,
  crypt('Orchid2@123', gen_salt('bf', 10)),
  'lender',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash;

-- 2c. Applicant Accounts (No loan applications attached)
-- Shreyash Madgundi (Shreyash@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'Shreyash Madgundi',
  'shreemadgundi0111@gmail.com',
  '9175331958',
  crypt('Shreyash@123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

INSERT INTO applicant_profiles (user_id, profile_completed)
VALUES ('c0000000-0000-0000-0000-000000000001', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Sagar Kukadal (Sagar@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000002',
  'Sagar Kukadal',
  'sagarkukadal@gmail.com',
  '9175331959',
  crypt('Sagar@123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

INSERT INTO applicant_profiles (user_id, profile_completed)
VALUES ('c0000000-0000-0000-0000-000000000002', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Rahul Kukadal (Rahul@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'Rahul Kukadal',
  'rahulkukadal@gmail.com',
  '9960040480',
  crypt('Rahul@123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

INSERT INTO applicant_profiles (user_id, profile_completed)
VALUES ('c0000000-0000-0000-0000-000000000003', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Vikas Kalshetti (Vikas@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000004',
  'Vikas Kalshetti',
  'vikas123@gmail.com',
  '9503994885',
  crypt('Vikas@123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

INSERT INTO applicant_profiles (user_id, profile_completed)
VALUES ('c0000000-0000-0000-0000-000000000004', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Iresh Patane (Iresh@123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000005',
  'Iresh Patane',
  'ireshpatane@gmail.com',
  '9373199449',
  crypt('Iresh@123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

INSERT INTO applicant_profiles (user_id, profile_completed)
VALUES ('c0000000-0000-0000-0000-000000000005', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- 3. SEED INITIAL SYSTEM AUDIT LOG
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'SYSTEM_INITIALIZATION',
  'database',
  NULL,
  '{"note": "CredChain database initialized with clean domain accounts (5 Applicants, 2 Lenders, 1 Admin) and 0 initial loans."}'::jsonb
);
