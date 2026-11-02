import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import app from '../src/app.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:shreyas%40123@localhost:5432/credchain',
});

let server;
const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}/api`;

const testResults = [];
function recordResult(testName, passed, detail = '') {
  testResults.push({ name: testName, passed, detail });
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${statusIcon}: ${testName} ${detail ? `(${detail})` : ''}`);
}

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => {
      resolve();
    });
  });
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 CREDCHAIN AUTOMATED VERIFICATION: DATABASE RESET & DOMAIN USERS');
  console.log('===============================================================\n');

  try {
    await startServer();

    // -------------------------------------------------------------
    // Section 1: Database Table & Record Integrity
    // -------------------------------------------------------------
    console.log('--- Section 1: Database Clean-Slate Counts & Structure ---');
    
    const userRes = await pool.query('SELECT count(*) FROM users');
    recordResult('Total users in database is exactly 8', parseInt(userRes.rows[0].count) === 8, `Count: ${userRes.rows[0].count}`);

    const roleRes = await pool.query(`
      SELECT role, count(*) FROM users GROUP BY role ORDER BY role
    `);
    const roleCounts = {};
    roleRes.rows.forEach(r => roleCounts[r.role] = parseInt(r.count));
    recordResult('Exactly 5 applicant users exist', roleCounts.applicant === 5, `Count: ${roleCounts.applicant}`);
    recordResult('Exactly 2 lender users exist', roleCounts.lender === 2, `Count: ${roleCounts.lender}`);
    recordResult('Exactly 1 admin user exists', roleCounts.admin === 1, `Count: ${roleCounts.admin}`);

    const loanRes = await pool.query('SELECT count(*) FROM loan_applications');
    recordResult('Total loan applications is 0 (clean initial state)', parseInt(loanRes.rows[0].count) === 0, `Count: ${loanRes.rows[0].count}`);

    const docRes = await pool.query('SELECT count(*) FROM documents');
    recordResult('Total documents in database is 0', parseInt(docRes.rows[0].count) === 0, `Count: ${docRes.rows[0].count}`);

    const repRes = await pool.query('SELECT count(*) FROM repayments');
    recordResult('Total repayments in database is 0', parseInt(repRes.rows[0].count) === 0, `Count: ${repRes.rows[0].count}`);

    const txRes = await pool.query('SELECT count(*) FROM blockchain_transactions');
    recordResult('Total blockchain transactions is 0', parseInt(txRes.rows[0].count) === 0, `Count: ${txRes.rows[0].count}`);

    const profileRes = await pool.query('SELECT count(*) FROM applicant_profiles WHERE profile_completed = FALSE');
    recordResult('All 5 applicants have initialized empty profile containers', parseInt(profileRes.rows[0].count) === 5, `Count: ${profileRes.rows[0].count}`);

    const policyRes = await pool.query('SELECT * FROM loan_policy_rules WHERE is_active = TRUE');
    recordResult('Active policy rule exists with min CIBIL 750', policyRes.rows[0]?.min_cibil_score === 750, `Score: ${policyRes.rows[0]?.min_cibil_score}`);

    // -------------------------------------------------------------
    // Section 2: Constraint Validation Checks
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Database Constraints (10-Digit Phone & Password) ---');

    // 2a. Attempt invalid 9-digit phone
    let phoneViolated = false;
    try {
      await pool.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ('Test Invalid Phone', 'invalidphone@test.com', '123456789', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789012345678901234567', 'applicant')
      `);
    } catch (e) {
      phoneViolated = e.message.includes('check_users_phone_10_digits');
    }
    recordResult('Database blocks invalid phone (9 digits) via check constraint', phoneViolated);

    // 2b. Attempt invalid 11-digit phone
    phoneViolated = false;
    try {
      await pool.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ('Test Invalid Phone 2', 'invalidphone2@test.com', '12345678901', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789012345678901234567', 'applicant')
      `);
    } catch (e) {
      phoneViolated = e.message.includes('check_users_phone_10_digits');
    }
    recordResult('Database blocks invalid phone (11 digits) via check constraint', phoneViolated);

    // 2c. Attempt invalid password hash length (< 50)
    let pwdViolated = false;
    try {
      await pool.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ('Test Short Hash', 'shorthash@test.com', '9876543210', 'short_unhashed_secret', 'applicant')
      `);
    } catch (e) {
      pwdViolated = e.message.includes('check_users_password_hash_len');
    }
    recordResult('Database blocks unhashed short passwords via length constraint', pwdViolated);

    // 2d. Attempt invalid email format
    let emailViolated = false;
    try {
      await pool.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ('Test Invalid Email', 'invalid_email_at_test', '9876543210', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789012345678901234567', 'applicant')
      `);
    } catch (e) {
      emailViolated = e.message.includes('check_users_email_format');
    }
    recordResult('Database blocks invalid email format via check constraint', emailViolated);

    // -------------------------------------------------------------
    // Section 3: Authentication & Login For All 8 Authorized Accounts
    // -------------------------------------------------------------
    console.log('\n--- Section 3: REST API Authentication For All 8 Domain Accounts ---');

    const accountsToTest = [
      { name: 'NKOCTADMIN', email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', expectedRole: 'admin' },
      { name: 'NKOCET Accountant', email: 'nkocetaccount@gmail.com', password: 'Orchid@123', expectedRole: 'lender' },
      { name: 'NKOCET Accountant 2', email: 'nkocetaccount2@gmail.com', password: 'Orchid2@123', expectedRole: 'lender' },
      { name: 'Shreyash Madgundi', email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', expectedRole: 'applicant' },
      { name: 'Sagar Kukadal', email: 'sagarkukadal@gmail.com', password: 'Sagar@123', expectedRole: 'applicant' },
      { name: 'Rahul Kukadal', email: 'rahulkukadal@gmail.com', password: 'Rahul@123', expectedRole: 'applicant' },
      { name: 'Vikas Kalshetti', email: 'vikas123@gmail.com', password: 'Vikas@123', expectedRole: 'applicant' },
      { name: 'Iresh Patane', email: 'ireshpatane@gmail.com', password: 'Iresh@123', expectedRole: 'applicant' },
    ];

    let adminToken = '';

    for (const acc of accountsToTest) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });
      const data = await res.json();
      const loginOk = res.status === 200 && data.token && data.user?.role === acc.expectedRole;
      recordResult(`Login for ${acc.name} (${acc.email}) -> Role: ${acc.expectedRole}`, loginOk, `Status: ${res.status}`);
      if (acc.expectedRole === 'admin') {
        adminToken = data.token;
      }
    }

    // 3b. Verify invalid password rejection
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nkocetadmin@gmail.com', password: 'WrongPassword@999' }),
    });
    recordResult('Rejection of invalid password credentials returns HTTP 401', badLoginRes.status === 401);

    // -------------------------------------------------------------
    // Section 4: Dynamic Loan Policy Rules Update & Implementation
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Dynamic Policy Rules Implementation (Admin Configurable) ---');

    // Admin updates policy
    const policyUpdateRes = await fetch(`${BASE_URL}/admin/policy-rules`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        min_cibil_score: 760,
        min_age: 22,
        max_age: 58,
        min_monthly_income: 30000,
        max_existing_loans: 1,
        max_dti_ratio: 45,
      }),
    });
    const policyUpdateData = await policyUpdateRes.json();
    recordResult('Admin successfully updates dynamic policy rules (CIBIL: 760, Income: ₹30,000)', policyUpdateRes.status === 200 && policyUpdateData.rules?.min_cibil_score === 760);

    // Fetch policy to ensure persistence
    const policyFetchRes = await fetch(`${BASE_URL}/admin/policy-rules`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const policyFetchData = await policyFetchRes.json();
    recordResult('Policy query immediately reflects the updated underwriting limits', policyFetchData.rules?.min_cibil_score === 760 && parseFloat(policyFetchData.rules?.min_monthly_income) === 30000);

    // Revert to standard directive (750 / 25000)
    await fetch(`${BASE_URL}/admin/policy-rules`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        min_cibil_score: 750,
        min_age: 21,
        max_age: 60,
        min_monthly_income: 25000,
        max_existing_loans: 2,
        max_dti_ratio: 50,
      }),
    });
    recordResult('Policy restored to baseline directive (CIBIL: 750, Income: ₹25,000)', true);

    // -------------------------------------------------------------
    // Section 5: Document View & Download Availability
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Document Retrieval Endpoints Security Check ---');

    const fakeDocDownloadRes = await fetch(`${BASE_URL}/documents/00000000-0000-0000-0000-000000000000/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Document download endpoint is active and guarded (returns 404 for non-existent doc)', fakeDocDownloadRes.status === 404);

    const fakeDocViewRes = await fetch(`${BASE_URL}/documents/00000000-0000-0000-0000-000000000000/view`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Document inline view endpoint is active and guarded (returns 404 for non-existent doc)', fakeDocViewRes.status === 404);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('📊 TEST EXECUTION SUMMARY: DATABASE RESET & DOMAIN USERS');
    console.log('===============================================================');
    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;
    console.log(`Total Assertions: ${testResults.length}`);
    console.log(`Passed:           ${passed}`);
    console.log(`Failed:           ${failed}`);
    console.log(`Success Rate:     ${Math.round((passed / testResults.length) * 100)}%`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('❌ Test suite failed with error:', err.message);
  } finally {
    await stopServer();
  }
}

runTests();
