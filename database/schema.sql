-- ============================================================================
-- CREDCHAIN DATABASE SCHEMA (PostgreSQL 15 / 16)
-- Full-stack Blockchain-Audited Loan Management System
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('applicant', 'lender', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM (
    'requested',
    'under_review',
    'compliance_verified',
    'compliance_rejected',
    'approved',
    'rejected',
    'ongoing',
    'repaid',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_verification_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'needs_correction'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'pan_card',
    'aadhaar_card',
    'address_proof',
    'bank_statement',
    'photograph',
    'signature',
    'salary_slip',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_validity AS ENUM (
    'pending',
    'valid',
    'invalid',
    'needs_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE repayment_status AS ENUM (
    'due',
    'paid',
    'late',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tx_status AS ENUM (
    'pending',
    'confirmed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'applicant',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. APPLICANT PROFILES TABLE
CREATE TABLE IF NOT EXISTS applicant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(40),
  address_line1 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  monthly_income NUMERIC(14,2) CHECK (monthly_income >= 0),
  declared_credit_score SMALLINT CHECK (declared_credit_score BETWEEN 300 AND 900),
  existing_loan_details TEXT,
  existing_monthly_emi NUMERIC(14,2) DEFAULT 0 CHECK (existing_monthly_emi >= 0),
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DYNAMIC LOAN POLICY RULES TABLE (Configured by Admin / Higher Authority)
CREATE TABLE IF NOT EXISTS loan_policy_rules (
  id SERIAL PRIMARY KEY,
  min_cibil_score SMALLINT NOT NULL DEFAULT 750 CHECK (min_cibil_score BETWEEN 300 AND 900),
  min_age SMALLINT NOT NULL DEFAULT 21 CHECK (min_age >= 18),
  max_age SMALLINT NOT NULL DEFAULT 60 CHECK (max_age <= 100 AND max_age > min_age),
  min_monthly_income NUMERIC(14,2) NOT NULL DEFAULT 25000.00 CHECK (min_monthly_income >= 0),
  max_existing_loans SMALLINT NOT NULL DEFAULT 2 CHECK (max_existing_loans >= 0),
  max_dti_ratio NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (max_dti_ratio BETWEEN 10 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  authority_memo_ref VARCHAR(255),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LOAN APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number BIGSERIAL UNIQUE,
  applicant_id UUID NOT NULL REFERENCES users(id),
  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),
  purpose VARCHAR(120) NOT NULL,
  tenure_months SMALLINT NOT NULL CHECK (tenure_months > 0),
  status loan_status NOT NULL DEFAULT 'requested',

  -- Admin Document & Condition Compliance Verification
  admin_status admin_verification_status NOT NULL DEFAULT 'pending',
  admin_verified_at TIMESTAMPTZ,
  admin_verifier_id UUID REFERENCES users(id),
  admin_remarks TEXT,

  -- Lender Underwriting
  assigned_lender_id UUID REFERENCES users(id),
  lender_decision_reason TEXT,
  lender_return_message TEXT,
  verified_credit_score SMALLINT CHECK (verified_credit_score BETWEEN 300 AND 900),
  verified_monthly_income NUMERIC(14,2),

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_admin_status ON loan_applications(admin_status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_applicant ON loan_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_submitted ON loan_applications(submitted_at DESC);

-- 6. DOCUMENTS TABLE (Granular Verification: Valid / Invalid)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  storage_key TEXT NOT NULL,
  verification_status doc_validity NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewer_note TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_applicant ON documents(applicant_id);
CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(verification_status);

-- 7. VERIFICATION CHECKS (Automated & Manual KYC / CIBIL Logs)
CREATE TABLE IF NOT EXISTS verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  check_type VARCHAR(60) NOT NULL CHECK (check_type IN ('cibil_score','age_limit','income_threshold','existing_loans','kyc_docs','fraud_check')),
  status doc_validity NOT NULL DEFAULT 'pending',
  provider VARCHAR(120),
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_by UUID REFERENCES users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verification_checks_app ON verification_checks(application_id);

-- 8. REPAYMENTS & AMORTISATION SCHEDULE
CREATE TABLE IF NOT EXISTS repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_due NUMERIC(14,2) NOT NULL CHECK (amount_due > 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  paid_at TIMESTAMPTZ,
  payment_reference VARCHAR(255),
  status repayment_status NOT NULL DEFAULT 'due',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_repayments_application ON repayments(application_id);

-- 9. BLOCKCHAIN TRANSACTIONS
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  network VARCHAR(80) NOT NULL,
  contract_address VARCHAR(255),
  transaction_hash VARCHAR(255) UNIQUE,
  transaction_type VARCHAR(40) NOT NULL CHECK (
    transaction_type IN ('loan_created','compliance_certified','loan_approved','repayment','loan_completed')
  ),
  tx_status tx_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_app ON blockchain_transactions(application_id);

-- 10. SYSTEM AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);

-- 11. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- 12. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_applicant_profiles_updated_at ON applicant_profiles;
CREATE TRIGGER trigger_applicant_profiles_updated_at
BEFORE UPDATE ON applicant_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_loan_policy_rules_updated_at ON loan_policy_rules;
CREATE TRIGGER trigger_loan_policy_rules_updated_at
BEFORE UPDATE ON loan_policy_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_loan_applications_updated_at ON loan_applications;
CREATE TRIGGER trigger_loan_applications_updated_at
BEFORE UPDATE ON loan_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
