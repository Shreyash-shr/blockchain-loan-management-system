import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:shreyas%40123@localhost:5432/credchain';
const pool = new Pool({ connectionString });

const APPLICANTS = [
  { name: 'Shreyash Madgundi', email: 'shreemadgundi0111@gmail.com', phone: '9175331958', password: 'Shreyash@123' },
  { name: 'Sagar Kukadal', email: 'sagarkukadal@gmail.com', phone: '9175331959', password: 'Sagar@123' },
  { name: 'Rahul Kukadal', email: 'rahulkukadal@gmail.com', phone: '9960040480', password: 'Rahul@123' },
  { name: 'Vikas Kalshetti', email: 'vikas123@gmail.com', phone: '9503994885', password: 'Vikas@123' },
  { name: 'Iresh Patane', email: 'ireshpatane@gmail.com', phone: '9373199449', password: 'Iresh@123' },
];

const LENDERS = [
  { name: 'NKOCET Accountant', email: 'nkocetaccount@gmail.com', password: 'Orchid@123' },
  { name: 'NKOCET Accountant 2', email: 'nkocetaccount2@gmail.com', password: 'Orchid2@123' },
];

const ADMINS = [
  { name: 'NKOCTADMIN', email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123' },
];

async function resetAndSeed() {
  console.log('🔄 =========================================================');
  console.log('🔄 [CredChain] Starting Clean-Slate Database Reset & Seeding');
  console.log('🔄 =========================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // Step 1: Clean Deletion of All Records (No DROP TABLE)
    // -------------------------------------------------------------
    console.log('🧹 Step 1: Deleting all existing data (preserving tables & schema)...');
    
    await client.query('DELETE FROM notifications;');
    await client.query('DELETE FROM audit_logs;');
    await client.query('DELETE FROM repayments;');
    await client.query('DELETE FROM blockchain_transactions;');
    await client.query('DELETE FROM verification_checks;');
    await client.query('DELETE FROM documents;');
    await client.query('DELETE FROM loan_applications;');
    await client.query('DELETE FROM applicant_profiles;');
    await client.query('DELETE FROM users;');

    // Reset sequences
    await client.query('ALTER SEQUENCE IF EXISTS loan_applications_application_number_seq RESTART WITH 1;');
    await client.query('ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1;');
    console.log('  ✅ All previous demo records, loans, documents, and test users deleted.');
    console.log('  ✅ Application numbers and audit log sequences reset to 1.');

    // -------------------------------------------------------------
    // Step 2: Ensure Strict Constraints on 'users' Table
    // -------------------------------------------------------------
    console.log('\n🛠️  Step 2: Applying strict check constraints...');
    
    // Phone check constraint (exactly 10 digits)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_users_phone_10_digits'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT check_users_phone_10_digits 
            CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$');
        END IF;
      END $$;
    `);

    // Password hash length constraint
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_users_password_hash_len'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT check_users_password_hash_len 
            CHECK (length(password_hash) >= 50);
        END IF;
      END $$;
    `);

    // Email format constraint
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_users_email_format'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT check_users_email_format 
            CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
        END IF;
      END $$;
    `);
    console.log('  ✅ Check constraints verified: 10-digit phone, min 50-char hash, valid email regex.');

    // -------------------------------------------------------------
    // Step 3: Seed Active Underwriting Policy Rules
    // -------------------------------------------------------------
    console.log('\n📜 Step 3: Ensuring active default policy rules in loan_policy_rules...');
    await client.query(`
      INSERT INTO loan_policy_rules (
        id, min_cibil_score, min_age, max_age, min_monthly_income, 
        max_existing_loans, max_dti_ratio, is_active, authority_memo_ref
      ) VALUES (
        1, 750, 21, 60, 25000.00, 2, 50.00, TRUE, 'DIRECTIVE-NKOCET-2026/01'
      )
      ON CONFLICT (id) DO UPDATE SET
        min_cibil_score = EXCLUDED.min_cibil_score,
        min_age = EXCLUDED.min_age,
        max_age = EXCLUDED.max_age,
        min_monthly_income = EXCLUDED.min_monthly_income,
        is_active = TRUE;
    `);
    await client.query(`SELECT setval('loan_policy_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM loan_policy_rules));`);
    console.log('  ✅ Default policy active: CIBIL >= 750, Age 21-60, Min Income ₹25,000/mo.');

    // -------------------------------------------------------------
    // Step 4: Seed Authorized Domain Accounts
    // -------------------------------------------------------------
    console.log('\n👥 Step 4: Seeding authorized domain accounts with bcrypt hashing...');

    // 4a. Seed Admin
    for (const a of ADMINS) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(a.password, salt);
      const res = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
         VALUES ($1, $2, NULL, $3, 'admin', TRUE)
         RETURNING id, full_name, email, role`,
        [a.name, a.email.toLowerCase(), hash]
      );
      console.log(`  👑 Admin:     ${res.rows[0].full_name} (${res.rows[0].email})`);
    }

    // 4b. Seed Lenders
    for (const l of LENDERS) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(l.password, salt);
      const res = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
         VALUES ($1, $2, NULL, $3, 'lender', TRUE)
         RETURNING id, full_name, email, role`,
        [l.name, l.email.toLowerCase(), hash]
      );
      console.log(`  💼 Lender:    ${res.rows[0].full_name} (${res.rows[0].email})`);
    }

    // 4c. Seed Applicants
    for (const ap of APPLICANTS) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(ap.password, salt);
      const res = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, 'applicant', TRUE)
         RETURNING id, full_name, email, phone, role`,
        [ap.name, ap.email.toLowerCase(), ap.phone, hash]
      );
      // Create empty profile container (no loan applications)
      await client.query(
        `INSERT INTO applicant_profiles (user_id, profile_completed) VALUES ($1, FALSE)`,
        [res.rows[0].id]
      );
      console.log(`  👤 Applicant: ${res.rows[0].full_name} (${res.rows[0].email}) - Phone: ${res.rows[0].phone}`);
    }

    // 4d. Seed System Initialization Audit Log
    const adminUser = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'SYSTEM_DATABASE_RESET', 'database', $1, $2)`,
      [
        adminUser.rows[0].id,
        JSON.stringify({
          note: 'Database reset to clean state with 5 applicants, 2 lenders, 1 admin',
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    await client.query('COMMIT');
    console.log('\n✅ Database transaction committed successfully!');

    // -------------------------------------------------------------
    // Step 5: Clean Up Legacy Upload Files
    // -------------------------------------------------------------
    console.log('\n🗑️  Step 5: Purging legacy test files in backend/uploads/...');
    const uploadsDir = path.resolve(__dirname, '..', 'backend', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const entries = fs.readdirSync(uploadsDir);
      let purgedCount = 0;
      for (const entry of entries) {
        if (entry === '.gitkeep') continue;
        const fullPath = path.join(uploadsDir, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          purgedCount++;
        } catch (e) {
          console.warn(`  ⚠️ Could not remove ${entry}: ${e.message}`);
        }
      }
      console.log(`  ✅ Removed ${purgedCount} legacy upload folder(s) / file(s). Kept .gitkeep.`);
    }

    // -------------------------------------------------------------
    // Step 6: Verification Summary
    // -------------------------------------------------------------
    console.log('\n📊 ---------------------------------------------------------');
    console.log('📊 DATABASE RESET VERIFICATION SUMMARY');
    console.log('📊 ---------------------------------------------------------');
    const userCount = await client.query('SELECT count(*) FROM users');
    const loanCount = await client.query('SELECT count(*) FROM loan_applications');
    const docCount = await client.query('SELECT count(*) FROM documents');
    const repCount = await client.query('SELECT count(*) FROM repayments');
    const txCount = await client.query('SELECT count(*) FROM blockchain_transactions');

    console.log(`  Total Users in DB:             ${userCount.rows[0].count} (Expected: 8)`);
    console.log(`  Total Loan Applications in DB: ${loanCount.rows[0].count} (Expected: 0)`);
    console.log(`  Total Documents in DB:         ${docCount.rows[0].count} (Expected: 0)`);
    console.log(`  Total Repayments in DB:        ${repCount.rows[0].count} (Expected: 0)`);
    console.log(`  Total Blockchain Tx in DB:     ${txCount.rows[0].count} (Expected: 0)`);
    console.log('📊 ---------------------------------------------------------\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error executing database reset:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndSeed();
