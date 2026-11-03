import http from 'http';
import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:shreyas%40123@localhost:5432/credchain';
const pool = new Pool({ connectionString });

console.log('=== PHASE 2 VERIFICATION TEST: SUBMISSION TEST WITH 0-LOAN TEARDOWN ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

function requestJson({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(resBody) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  const createdAppIds = [];

  try {
    console.log('--- 1. Testing Applicant Login: shreemadgundi0111@gmail.com ---');
    const loginRes = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', role: 'applicant' },
    });
    assert(loginRes.statusCode === 200, 'Shreyash login succeeded (200 OK)');
    const token = loginRes.data?.token;
    assert(Boolean(token), 'JWT token received');

    console.log('\n--- 2. Testing Profile Update (PATCH /api/applicants/me) ---');
    const profileRes = await requestJson({
      method: 'PATCH',
      path: '/api/applicants/me',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        full_name: 'Shreyash Madgundi',
        phone: '9175331958',
        date_of_birth: '1998-05-14',
        gender: 'Male',
        monthly_income: 45000,
        declared_credit_score: 780,
      },
    });
    assert(profileRes.statusCode === 200, 'Profile update succeeded without Access Denied (200 OK)');

    console.log('\n--- 3. Testing Loan Application Submission (POST /api/applications) ---');
    const submitRes = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        requested_amount: 150000,
        purpose: 'Personal loan for home renovation',
        tenure_months: 24,
      },
    });
    assert(submitRes.statusCode === 201, 'Loan application submitted successfully (201 Created)');
    const application = submitRes.data?.application;
    assert(Boolean(application?.id), `Application ID assigned: ${application?.id}`);
    assert(application?.status === 'requested', `Status is 'requested'`);
    assert(application?.admin_status === 'pending', `Admin status is 'pending'`);
    assert(Boolean(application?.transaction_hash), 'Blockchain transaction hash created');

    if (application?.id) {
      createdAppIds.push(application.id);
    }

    console.log('\n--- 4. Checking Admin Verification Queue ---');
    const adminLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', role: 'admin' },
    });
    const adminToken = adminLogin.data?.token;

    const queueRes = await requestJson({
      method: 'GET',
      path: '/api/admin/verification',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(queueRes.statusCode === 200, 'Admin can view verification queue (200 OK)');
    const queue = queueRes.data?.applications || [];
    const found = queue.find((a) => a.id === application.id);
    assert(Boolean(found), 'Newly submitted application is visible in Admin queue');
    if (found) {
      assert(found.applicant_email === 'shreemadgundi0111@gmail.com', 'Applicant email matches');
      assert(Number(found.requested_amount) === 150000, 'Requested amount matches ₹150,000');
    }

  } finally {
    // Teardown: Clean up test loan application so database remains with exactly 0 loan applications!
    console.log('\n--- 5. Teardown: Removing test applications to guarantee 0 loan requests ---');
    const client = await pool.connect();
    try {
      if (createdAppIds.length > 0) {
        await client.query('DELETE FROM verification_checks WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM blockchain_transactions WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM documents WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM loan_applications WHERE id = ANY($1::uuid[])', [createdAppIds]);
      }
      const countRes = await client.query('SELECT count(*) FROM loan_applications');
      assert(parseInt(countRes.rows[0].count) === 0, `Database has exactly 0 loan applications (verified: ${countRes.rows[0].count})`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 2 Clean Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
