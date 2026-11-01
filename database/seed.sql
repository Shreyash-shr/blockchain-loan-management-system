-- ============================================================================
-- CREDCHAIN DATABASE SEED SCRIPT (PostgreSQL)
-- Generates default policy rules, system users, and initial test data
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
  'BOARD-DIRECTIVE-2026/01'
)
ON CONFLICT (id) DO UPDATE SET
  min_cibil_score = EXCLUDED.min_cibil_score,
  min_age = EXCLUDED.min_age,
  max_age = EXCLUDED.max_age,
  min_monthly_income = EXCLUDED.min_monthly_income;

-- 2. SEED DEFAULT SYSTEM ACCOUNTS (Password for all accounts: 'password123')
-- Uses PostgreSQL pgcrypto crypt('password123', gen_salt('bf')) for secure bcrypt hashing

-- Admin Account
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'CredChain SuperAdmin',
  'admin@credchain.io',
  '+91 99999 00001',
  crypt('password123', gen_salt('bf', 10)),
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Loan Lender Account
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Apex Capital Underwriters',
  'lender@credchain.io',
  '+91 88888 00002',
  crypt('password123', gen_salt('bf', 10)),
  'lender',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Sample Applicant Account
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'Aarav Sharma',
  'aarav@example.com',
  '+91 98765 43210',
  crypt('password123', gen_salt('bf', 10)),
  'applicant',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- 3. SEED APPLICANT PROFILE
INSERT INTO applicant_profiles (
  user_id,
  date_of_birth,
  gender,
  address_line1,
  city,
  state,
  pincode,
  monthly_income,
  declared_credit_score,
  existing_loan_details,
  existing_monthly_emi,
  profile_completed
) VALUES (
  'c0000000-0000-0000-0000-000000000003',
  '1995-04-12',
  'Male',
  '42 Indiranagar 100ft Road',
  'Bengaluru',
  'Karnataka',
  '560038',
  68000.00,
  764,
  'None',
  0.00,
  TRUE
)
ON CONFLICT (user_id) DO NOTHING;

-- 4. SEED SAMPLE LOAN APPLICATION
INSERT INTO loan_applications (
  id,
  application_number,
  applicant_id,
  requested_amount,
  purpose,
  tenure_months,
  status,
  admin_status,
  admin_remarks,
  verified_credit_score,
  verified_monthly_income,
  submitted_at
) VALUES (
  'd0000000-0000-0000-0000-000000000004',
  148,
  'c0000000-0000-0000-0000-000000000003',
  350000.00,
  'Home renovation',
  24,
  'requested',
  'pending',
  'Awaiting initial compliance inspection by Admin',
  764,
  68000.00,
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED REQUIRED VERIFICATION DOCUMENTS
INSERT INTO documents (
  id,
  applicant_id,
  application_id,
  document_type,
  original_filename,
  mime_type,
  file_size_bytes,
  storage_key,
  verification_status
) VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'pan_card', 'pan_aarav_sharma.pdf', 'application/pdf', 124500, 'docs/c0003/pan_card.pdf', 'valid'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'aadhaar_card', 'aadhaar_aarav_sharma.pdf', 'application/pdf', 245000, 'docs/c0003/aadhaar_card.pdf', 'valid'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'address_proof', 'bescom_bill_oct2026.pdf', 'application/pdf', 189000, 'docs/c0003/address_proof.pdf', 'valid'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'bank_statement', 'hdfc_bank_statement_6m.pdf', 'application/pdf', 840000, 'docs/c0003/bank_statement.pdf', 'pending'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'salary_slip', 'salary_slips_q3.pdf', 'application/pdf', 310000, 'docs/c0003/salary_slip.pdf', 'pending'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'photograph', 'passport_photo.jpg', 'image/jpeg', 95000, 'docs/c0003/photo.jpg', 'valid'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'signature', 'signature_aarav.png', 'image/png', 52000, 'docs/c0003/signature.png', 'valid');

-- 6. SEED SYSTEM AUDIT ENTRY
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'SYSTEM_INITIALIZATION',
  'database',
  NULL,
  '{"note": "CredChain database initialized with standard compliance rules and baseline seed users"}'::jsonb
);

-- 7. SEED INITIAL BLOCKCHAIN TRANSACTION AUDIT RECORD
INSERT INTO blockchain_transactions (
  application_id,
  network,
  contract_address,
  transaction_hash,
  transaction_type,
  tx_status,
  confirmed_at
) VALUES (
  'd0000000-0000-0000-0000-000000000004',
  'Polygon Amoy Testnet (ChainID: 80002)',
  '0x3A2cE7495B5B84Ac544A30B48007C38B13dB5725',
  '0x7c4f39b1a20d436ef482fa816913e2bb978453ef671d182283ad56c703b44b82',
  'loan_created',
  'confirmed',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (transaction_hash) DO NOTHING;
