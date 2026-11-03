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

console.log('=== PHASE 4 VERIFICATION TEST: CERTIFY & REJECT WORKFLOW ===\n');

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
            resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(resBody) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, headers: res.headers, body: resBody });
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
    // 1. Authenticate users
    console.log('--- 1. Authenticating Roles ---');
    const shreyashLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', role: 'applicant' },
    });
    assert(shreyashLogin.statusCode === 200, 'Shreyash logged in (200 OK)');
    const shreyashToken = shreyashLogin.data?.token;

    const rahulLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'rahulkukadal@gmail.com', password: 'Rahul@123', role: 'applicant' },
    });
    assert(rahulLogin.statusCode === 200, 'Rahul logged in (200 OK)');
    const rahulToken = rahulLogin.data?.token;

    const adminLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', role: 'admin' },
    });
    assert(adminLogin.statusCode === 200, 'Admin logged in (200 OK)');
    const adminToken = adminLogin.data?.token;

    const lenderLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetaccount@gmail.com', password: 'Orchid@123', role: 'lender' },
    });
    assert(lenderLogin.statusCode === 200, 'Lender logged in (200 OK)');
    const lenderToken = lenderLogin.data?.token;

    // 2. Test Certify & Send to Lender
    console.log('\n--- 2. Testing Certify & Send to Lender ---');
    const app1Res = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${shreyashToken}` },
      body: { requested_amount: 150000, purpose: 'Certification Test', tenure_months: 24 },
    });
    assert(app1Res.statusCode === 201, 'Application 1 created for Shreyash (201 Created)');
    const app1 = app1Res.data?.application;
    createdAppIds.push(app1.id);

    const certifyRes = await requestJson({
      method: 'PATCH',
      path: `/api/admin/verification/${app1.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        admin_status: 'verified',
        admin_remarks: 'Verified applicant KYC and income documentation against policy thresholds (CIBIL: >=750, Age: 21-60, Min Income: ₹25,000).',
      },
    });
    assert(certifyRes.statusCode === 200, 'Certify succeeds with 200 OK (no 500 "Failed to process verification")');
    assert(certifyRes.data?.admin_status === 'verified', 'admin_status updated to "verified"');
    assert(certifyRes.data?.new_loan_status === 'compliance_verified', 'loan status transitioned to "compliance_verified"');

    // Test idempotency / cannot re-decide already verified application
    const reCertifyRes = await requestJson({
      method: 'PATCH',
      path: `/api/admin/verification/${app1.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { admin_status: 'verified', admin_remarks: 'Attempt re-certify' },
    });
    assert(reCertifyRes.statusCode === 400, 'Already decided application cannot be verified again (400 Bad Request)');

    // 3. Test Compliance Reject
    console.log('\n--- 3. Testing Compliance Reject ---');
    const app2Res = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${rahulToken}` },
      body: { requested_amount: 300000, purpose: 'Rejection Test', tenure_months: 36 },
    });
    assert(app2Res.statusCode === 201, 'Application 2 created for Rahul (201 Created)');
    const app2 = app2Res.data?.application;
    createdAppIds.push(app2.id);

    const rejectRes = await requestJson({
      method: 'PATCH',
      path: `/api/admin/verification/${app2.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        admin_status: 'rejected',
        admin_remarks: 'Salary slip documentation does not verify required income threshold.',
      },
    });
    assert(rejectRes.statusCode === 200, 'Compliance Reject succeeds with 200 OK (no 500)');
    assert(rejectRes.data?.admin_status === 'rejected', 'admin_status updated to "rejected"');
    assert(rejectRes.data?.new_loan_status === 'compliance_rejected', 'loan status transitioned to "compliance_rejected"');

    // 4. Verify Applicant notifications & messages
    console.log('\n--- 4. Checking Applicant Notifications ---');
    const shreyashNotifs = await requestJson({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(shreyashNotifs.statusCode === 200, 'Shreyash fetched notifications (200 OK)');
    const certNotif = (shreyashNotifs.data?.notifications || []).find((n) => n.title === 'Compliance Verified');
    assert(Boolean(certNotif), 'Applicant received "Compliance Verified" notification');

    const rahulNotifs = await requestJson({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${rahulToken}` },
    });
    const rejNotif = (rahulNotifs.data?.notifications || []).find((n) => n.title === 'Verification Rejected');
    assert(Boolean(rejNotif), 'Applicant received "Verification Rejected" notification');
    if (rejNotif) {
      assert(rejNotif.message.includes('Salary slip documentation'), 'Notification contains admin remark message');
    }

    // 5. Verify Lender Queue contains ONLY certified application
    console.log('\n--- 5. Checking Lender Queue Filter ---');
    const lenderQueueRes = await requestJson({
      method: 'GET',
      path: '/api/loans/requests',
      headers: { Authorization: `Bearer ${lenderToken}` },
    });
    assert(lenderQueueRes.statusCode === 200, 'Lender fetched loan requests (200 OK)');
    const lenderLoans = lenderQueueRes.data?.loans || lenderQueueRes.data?.applications || [];
    const foundCertified = lenderLoans.some((l) => l.id === app1.id);
    const foundRejected = lenderLoans.some((l) => l.id === app2.id);
    assert(foundCertified, 'Certified application (app1) is present in Lender queue');
    assert(!foundRejected, 'Compliance rejected application (app2) is NOT present in Lender queue');

  } finally {
    // 6. Teardown: purge all test data so database remains with exactly 0 loan applications
    console.log('\n--- 6. Teardown: Ensuring 0 Loan Applications in DB ---');
    const client = await pool.connect();
    try {
      if (createdAppIds.length > 0) {
        await client.query('DELETE FROM verification_checks WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM blockchain_transactions WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM documents WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM loan_applications WHERE id = ANY($1::uuid[])', [createdAppIds]);
      }
      // Also clean test notifications
      await client.query("DELETE FROM notifications WHERE title IN ('Compliance Verified', 'Verification Rejected', 'Verified Loan for Review', 'New Loan Application')");
      const countRes = await client.query('SELECT count(*) FROM loan_applications');
      assert(parseInt(countRes.rows[0].count) === 0, `Database has exactly 0 loan applications (verified: ${countRes.rows[0].count})`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 4 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
