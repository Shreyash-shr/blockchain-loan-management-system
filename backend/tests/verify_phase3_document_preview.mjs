import http from 'http';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:shreyas%40123@localhost:5432/credchain';
const pool = new Pool({ connectionString });

console.log('=== PHASE 3 VERIFICATION TEST: DOCUMENT VIEW & PERMISSIONS ===\n');

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

function requestBinary({ method, path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode, headers: res.headers, buffer });
        });
      }
    );
    req.on('error', reject);
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
    // 1. Authenticate users
    console.log('--- 1. Authenticating Roles ---');
    const shreyashLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', role: 'applicant' },
    });
    assert(shreyashLogin.statusCode === 200, 'Shreyash logged in (200 OK)');
    const shreyashToken = shreyashLogin.data?.token;

    const sagarLogin = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sagarkukadal@gmail.com', password: 'Sagar@123', role: 'applicant' },
    });
    assert(sagarLogin.statusCode === 200, 'Sagar logged in (200 OK)');
    const sagarToken = sagarLogin.data?.token;

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

    // 2. Submit loan application for Shreyash
    console.log('\n--- 2. Submitting Application & Documents for Shreyash ---');
    const appRes = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${shreyashToken}` },
      body: {
        requested_amount: 150000,
        purpose: 'Document inspection verification test',
        tenure_months: 12,
      },
    });
    assert(appRes.statusCode === 201, 'Loan application created (201 Created)');
    const app = appRes.data?.application;
    createdAppIds.push(app.id);

    // Upload JPEG document
    // Minimal valid JPEG header (FF D8 FF E0 ...)
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]);
    const jpegUpload = await uploadMultipart({
      reqPath: '/api/documents',
      token: shreyashToken,
      fieldName: 'file',
      filename: 'pan_card.jpg',
      fileBuffer: jpegBuffer,
      mimeType: 'image/jpeg',
      fields: {
        document_type: 'pan',
        application_id: app.id,
      },
    });
    assert(jpegUpload.statusCode === 201, 'JPEG (pan_card.jpg) uploaded (201 Created)');
    const jpegDoc = jpegUpload.data?.document;
    createdDocIds.push(jpegDoc.id);

    // Upload PDF document
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n167\n%%EOF');
    const pdfUpload = await uploadMultipart({
      reqPath: '/api/documents',
      token: shreyashToken,
      fieldName: 'file',
      filename: 'aadhaar_card.pdf',
      fileBuffer: pdfBuffer,
      mimeType: 'application/pdf',
      fields: {
        document_type: 'aadhaar',
        application_id: app.id,
      },
    });
    assert(pdfUpload.statusCode === 201, 'PDF (aadhaar_card.pdf) uploaded (201 Created)');
    const pdfDoc = pdfUpload.data?.document;
    createdDocIds.push(pdfDoc.id);

    // 3. Test Admin inline viewing
    console.log('\n--- 3. Testing Admin Document Inline Viewing ---');
    const adminViewJpeg = await requestBinary({
      method: 'GET',
      path: `/api/documents/${jpegDoc.id}/view`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminViewJpeg.statusCode === 200, 'Admin can view JPEG document (200 OK)');
    assert(adminViewJpeg.headers['content-type'] === 'image/jpeg', 'Content-Type is image/jpeg');
    assert(adminViewJpeg.headers['content-disposition'].includes('inline'), 'Content-Disposition is inline');
    assert(adminViewJpeg.buffer.length === jpegBuffer.length, `Received binary stream length matches (${adminViewJpeg.buffer.length} bytes)`);

    const adminViewPdf = await requestBinary({
      method: 'GET',
      path: `/api/documents/${pdfDoc.id}/view`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminViewPdf.statusCode === 200, 'Admin can view PDF document (200 OK)');
    assert(adminViewPdf.headers['content-type'] === 'application/pdf', 'Content-Type is application/pdf');
    assert(adminViewPdf.headers['content-disposition'].includes('inline'), 'Content-Disposition is inline');

    // 4. Test Lender inline viewing
    console.log('\n--- 4. Testing Lender Document Inline Viewing ---');
    const lenderView = await requestBinary({
      method: 'GET',
      path: `/api/documents/${jpegDoc.id}/view`,
      headers: { Authorization: `Bearer ${lenderToken}` },
    });
    assert(lenderView.statusCode === 200, 'Lender can view verified document (200 OK)');

    // 5. Test Access Control: Unrelated applicant cannot view Shreyash's document
    console.log('\n--- 5. Testing Access Control (Other Applicant Forbidden) ---');
    const otherApplicantView = await requestBinary({
      method: 'GET',
      path: `/api/documents/${jpegDoc.id}/view`,
      headers: { Authorization: `Bearer ${sagarToken}` },
    });
    assert(otherApplicantView.statusCode === 403, 'Other applicant (Sagar) is rejected with 403 Forbidden');

    // 6. Test Admin download endpoint
    console.log('\n--- 6. Testing Document Download Endpoint ---');
    const downloadRes = await requestBinary({
      method: 'GET',
      path: `/api/documents/${jpegDoc.id}/download`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(downloadRes.statusCode === 200, 'Download endpoint returns 200 OK');
    assert(downloadRes.headers['content-disposition'].includes('attachment'), 'Content-Disposition is attachment');

  } finally {
    // 7. Teardown: purge test files and database records to guarantee 0 loan applications!
    console.log('\n--- 7. Teardown: Guaranteeing Clean 0-Loan State ---');
    const client = await pool.connect();
    try {
      if (createdDocIds.length > 0) {
        // Query storage keys to remove files from disk
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
      const countRes = await client.query('SELECT count(*) FROM loan_applications');
      assert(parseInt(countRes.rows[0].count) === 0, `Database has exactly 0 loan applications (verified: ${countRes.rows[0].count})`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 3 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
