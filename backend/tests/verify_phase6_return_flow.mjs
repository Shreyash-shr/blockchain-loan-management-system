import http from 'http';
import fs from 'fs';
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

console.log('=== PHASE 6 VERIFICATION TEST: SEND BACK TO APPLICANT & RESUBMIT FLOW ===\n');

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

function uploadMultipart({ reqPath, token, fieldName, filename, fileBuffer, mimeType, fields = {} }) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let postData = '';

    for (const [key, value] of Object.entries(fields)) {
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      postData += `${value}\r\n`;
    }

    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`;
    postData += `Content-Type: ${mimeType}\r\n\r\n`;

    const header = Buffer.from(postData, 'utf-8');
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullBody = Buffer.concat([header, fileBuffer, footer]);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: reqPath,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length,
        },
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
    req.write(fullBody);
    req.end();
  });
}

async function run() {
  const createdAppIds = [];
  const createdDocIds = [];

  try {
    // 1. Authenticate Shreyash & Admin
    console.log('--- 1. Authenticating Roles ---');
    const shreyashLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', role: 'applicant' },
    });
    assert(shreyashLogin.statusCode === 200, 'Shreyash logged in (200 OK)');
    const applicantToken = shreyashLogin.data?.token;

    const adminLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', role: 'admin' },
    });
    assert(adminLogin.statusCode === 200, 'Admin logged in (200 OK)');
    const adminToken = adminLogin.data?.token;

    // 2. Submit initial application
    console.log('\n--- 2. Submitting Application for Shreyash ---');
    const submitRes = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: { requested_amount: 175000, purpose: 'Return flow test loan', tenure_months: 24 },
    });
    assert(submitRes.statusCode === 201, 'Application submitted (201 Created)');
    const app = submitRes.data?.application;
    createdAppIds.push(app.id);

    // Initial document upload
    const dummyFile = Buffer.from('%PDF-1.4 Initial blurred ID document');
    const docRes = await uploadMultipart({
      reqPath: '/api/documents',
      token: applicantToken,
      fieldName: 'file',
      filename: 'pan_initial.pdf',
      fileBuffer: dummyFile,
      mimeType: 'application/pdf',
      fields: { document_type: 'pan', application_id: app.id },
    });
    assert(docRes.statusCode === 201, 'Initial document uploaded (201 Created)');
    createdDocIds.push(docRes.data?.document?.id);

    // 3. Admin sends back application to applicant
    console.log('\n--- 3. Admin Sends Application Back for Correction ---');
    const returnRemarks = '[Document KYC needed] The uploaded PAN document is blurred. Please upload a clear scanned copy.';
    const sendBackRes = await requestJson({
      method: 'PATCH',
      path: `/api/admin/verification/${app.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        admin_status: 'needs_correction',
        admin_remarks: returnRemarks,
      },
    });
    assert(sendBackRes.statusCode === 200, 'Admin successfully sent application back (200 OK)');
    assert(sendBackRes.data?.admin_status === 'needs_correction', 'admin_status is now "needs_correction"');

    // 4. Verify Applicant receives notification
    console.log('\n--- 4. Checking Applicant Notification ---');
    const notifsRes = await requestJson({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert(notifsRes.statusCode === 200, 'Applicant fetched notifications (200 OK)');
    const returnNotif = (notifsRes.data?.notifications || []).find((n) => n.title === 'Application Returned for Correction');
    assert(Boolean(returnNotif), 'Applicant received "Application Returned for Correction" notification');
    if (returnNotif) {
      assert(returnNotif.message.includes('Document KYC needed'), 'Notification message mentions "Document KYC needed"');
    }

    // 5. Verify Applicant sees application details with admin message
    console.log('\n--- 5. Checking Applicant Application Details ---');
    const appDetailRes = await requestJson({
      method: 'GET',
      path: `/api/applications/${app.id}`,
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert(appDetailRes.statusCode === 200, 'Applicant fetched application detail (200 OK)');
    assert(appDetailRes.data?.application?.admin_status === 'needs_correction', 'Detail shows admin_status "needs_correction"');
    assert(appDetailRes.data?.application?.admin_remarks === returnRemarks, 'Detail shows exact admin return instructions');

    // 6. Applicant uploads replacement / corrected document
    console.log('\n--- 6. Applicant Uploads Corrected Document ---');
    const clearFile = Buffer.from('%PDF-1.4 Clear high-resolution PAN document');
    const doc2Res = await uploadMultipart({
      reqPath: '/api/documents',
      token: applicantToken,
      fieldName: 'file',
      filename: 'pan_corrected_clear.pdf',
      fileBuffer: clearFile,
      mimeType: 'application/pdf',
      fields: { document_type: 'pan', application_id: app.id },
    });
    assert(doc2Res.statusCode === 201, 'Replacement document uploaded (201 Created)');
    createdDocIds.push(doc2Res.data?.document?.id);

    // 7. Applicant resubmits the application
    console.log('\n--- 7. Applicant Resubmits Application ---');
    const resubmitRes = await requestJson({
      method: 'PATCH',
      path: `/api/applications/${app.id}/resubmit`,
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert(resubmitRes.statusCode === 200, 'Application resubmitted successfully (200 OK)');
    assert(resubmitRes.data?.application?.admin_status === 'pending', 'admin_status updated back to "pending"');
    assert(resubmitRes.data?.application?.status === 'requested', 'loan status is "requested"');

    // 8. Verify No Duplicate Loan Was Created
    console.log('\n--- 8. Verifying No Duplicate Loans Created ---');
    const client = await pool.connect();
    try {
      const loanCountRes = await client.query('SELECT count(*) FROM loan_applications WHERE applicant_id = $1', [shreyashLogin.data?.user?.id]);
      assert(parseInt(loanCountRes.rows[0].count) === 1, `Applicant has exactly 1 application in DB (no duplicates created: ${loanCountRes.rows[0].count})`);
    } finally {
      client.release();
    }

    // 9. Verify Admin Verification Queue shows application back in queue
    console.log('\n--- 9. Checking Admin Verification Queue for Resubmission ---');
    const queueRes = await requestJson({
      method: 'GET',
      path: '/api/admin/verification',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(queueRes.statusCode === 200, 'Admin verification queue fetch succeeded (200 OK)');
    const queueApp = (queueRes.data?.applications || []).find((a) => a.id === app.id);
    assert(Boolean(queueApp), 'Resubmitted application is present in Admin verification queue');
    if (queueApp) {
      assert(queueApp.admin_status === 'pending', 'Resubmitted application admin_status is "pending"');
      assert(Number(queueApp.doc_count) === 2, `Resubmitted application reflects updated doc count (${queueApp.doc_count})`);
    }

  } finally {
    // 10. Teardown: Clean up test records to guarantee 0 loan applications
    console.log('\n--- 10. Teardown: Guaranteeing Clean 0-Loan State ---');
    const client = await pool.connect();
    try {
      if (createdDocIds.length > 0) {
        const docs = await client.query('SELECT storage_key FROM documents WHERE id = ANY($1::uuid[])', [createdDocIds]);
        const uploadDir = path.resolve('backend/uploads');
        for (const row of docs.rows) {
          const filePath = path.join(uploadDir, row.storage_key);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
        await client.query('DELETE FROM documents WHERE id = ANY($1::uuid[])', [createdDocIds]);
      }
      if (createdAppIds.length > 0) {
        await client.query('DELETE FROM verification_checks WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM blockchain_transactions WHERE application_id = ANY($1::uuid[])', [createdAppIds]);
        await client.query('DELETE FROM loan_applications WHERE id = ANY($1::uuid[])', [createdAppIds]);
      }
      await client.query("DELETE FROM notifications WHERE title IN ('Application Returned for Correction', 'Application Resubmitted', 'New Loan Application')");
      const countRes = await client.query('SELECT count(*) FROM loan_applications');
      assert(parseInt(countRes.rows[0].count) === 0, `Database has exactly 0 loan applications (verified: ${countRes.rows[0].count})`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 6 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
