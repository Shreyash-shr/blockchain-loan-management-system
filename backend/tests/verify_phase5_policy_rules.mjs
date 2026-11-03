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

console.log('=== PHASE 5 VERIFICATION TEST: POLICY RULES SAVE & LIVE USAGE ===\n');

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
  try {
    // 1. Authenticate Admin
    console.log('--- 1. Authenticating Admin ---');
    const adminLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', role: 'admin' },
    });
    assert(adminLogin.statusCode === 200, 'Admin login succeeded (200 OK)');
    const adminToken = adminLogin.data?.token;

    // 2. Fetch current policy rules
    console.log('\n--- 2. Fetching Active Policy Rules ---');
    const getPolicyRes = await requestJson({
      method: 'GET',
      path: '/api/admin/policy-rules',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getPolicyRes.statusCode === 200, 'GET /api/admin/policy-rules returns 200 OK');
    const activeRules = getPolicyRes.data?.rules;
    assert(Boolean(activeRules), 'Server response contains rules object');
    console.log(`  Current active CIBIL threshold: ${activeRules.min_cibil_score}, Income: ₹${activeRules.min_monthly_income}`);

    // 3. Update Policy Rules via PUT /api/admin/policy-rules
    console.log('\n--- 3. Testing Policy Rules Update via PUT ---');
    const updateRes = await requestJson({
      method: 'PUT',
      path: '/api/admin/policy-rules',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        min_cibil_score: 720,
        min_age: 23,
        max_age: 58,
        min_monthly_income: 30000,
        max_existing_loans: 3,
        max_dti_ratio: 45,
        authority_memo_ref: 'TEST-RELAXATION-2026',
      },
    });
    assert(updateRes.statusCode === 200, 'PUT /api/admin/policy-rules succeeded (200 OK)');
    assert(updateRes.data?.rules?.min_cibil_score === 720, 'min_cibil_score updated to 720');
    assert(Number(updateRes.data?.rules?.min_monthly_income) === 30000, 'min_monthly_income updated to 30000');
    assert(updateRes.data?.rules?.authority_memo_ref === 'TEST-RELAXATION-2026', 'authority_memo_ref persisted');

    // 4. Verify Admin Verification Queue returns the updated policy
    console.log('\n--- 4. Checking Verification Queue Policy Synchronization ---');
    const queueRes = await requestJson({
      method: 'GET',
      path: '/api/admin/verification',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(queueRes.statusCode === 200, 'GET /api/admin/verification returns 200 OK');
    const queuePolicy = queueRes.data?.policy;
    assert(Boolean(queuePolicy), 'Verification queue response contains updated active policy');
    assert(queuePolicy.min_cibil_score === 720, 'Verification queue policy reflects CIBIL 720');
    assert(Number(queuePolicy.min_monthly_income) === 30000, 'Verification queue policy reflects Income ₹30,000');

    // 5. Restore baseline default policy
    console.log('\n--- 5. Restoring Baseline Default Policy (750 / 21–60 / ₹25,000) ---');
    const resetRes = await requestJson({
      method: 'PUT',
      path: '/api/admin/policy-rules',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        min_cibil_score: 750,
        min_age: 21,
        max_age: 60,
        min_monthly_income: 25000,
        max_existing_loans: 2,
        max_dti_ratio: 50,
        authority_memo_ref: 'DEFAULT_POLICY_BASELINE',
      },
    });
    assert(resetRes.statusCode === 200, 'Default policy restored via PUT (200 OK)');
    assert(resetRes.data?.rules?.min_cibil_score === 750, 'Baseline CIBIL is 750');
    assert(Number(resetRes.data?.rules?.min_monthly_income) === 25000, 'Baseline Income is ₹25,000');

    // 6. Verify Database Integrity & Clean Slate
    console.log('\n--- 6. Verifying Database State ---');
    const client = await pool.connect();
    try {
      const loanCount = await client.query('SELECT count(*) FROM loan_applications');
      assert(parseInt(loanCount.rows[0].count) === 0, `Database has exactly 0 loan applications (verified: ${loanCount.rows[0].count})`);
    } finally {
      client.release();
      await pool.end();
    }

  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`Phase 5 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
