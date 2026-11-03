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

console.log('=== PHASE 7 VERIFICATION TEST: APPLICANT DOCUMENT PREVIEW & ACCESS CONTROL ===\n');

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

function requestHttp({ method, path, headers = {}, body = null }) {
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
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const rawText = buffer.toString('utf-8');
          let parsedData = null;
          try {
            parsedData = JSON.parse(rawText);
          } catch (e) {
            // Not JSON
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData,
            body: rawText,
            buffer,
          });
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
            resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(resBody) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, headers: res.headers, body: resBody });
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
  const createdDocIds = [];
  const createdAppIds = [];

  try {
    // 1. Authenticate Roles using actual seed accounts
    console.log('--- 1. Authenticating Roles ---');
    const shreyashLogin = await requestHttp({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'shreemadgundi0111@gmail.com', password: 'Shreyash@123', role: 'applicant' },
    });
    assert(shreyashLogin.statusCode === 200, 'Shreyash logged in (200 OK)');
    const shreyashToken = shreyashLogin.data?.token;

    const sagarLogin = await requestHttp({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sagarkukadal@gmail.com', password: 'Sagar@123', role: 'applicant' },
    });
    assert(sagarLogin.statusCode === 200, 'Second applicant (Sagar) logged in (200 OK)');
    const sagarToken = sagarLogin.data?.token;

    const adminLogin = await requestHttp({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123', role: 'admin' },
    });
    assert(adminLogin.statusCode === 200, 'Admin logged in (200 OK)');
    const adminToken = adminLogin.data?.token;

    const lenderLogin = await requestHttp({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nkocetaccount@gmail.com', password: 'Orchid@123', role: 'lender' },
    });
    assert(lenderLogin.statusCode === 200, 'Lender (Accountant) logged in (200 OK)');
    const lenderToken = lenderLogin.data?.token;

    // 2. Upload JPEG & PDF as Shreyash
    console.log('\n--- 2. Uploading JPEG and PDF as Shreyash ---');
    const jpegContent = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda,
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
    ]);
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF');

    const photoRes = await uploadMultipart({
      reqPath: '/api/documents',
      token: shreyashToken,
      fieldName: 'file',
      filename: 'shreyash_photo.jpg',
      fileBuffer: jpegContent,
      mimeType: 'image/jpeg',
      fields: { document_type: 'photograph' },
    });
    assert(photoRes.statusCode === 201, 'Shreyash uploaded JPEG photograph (201 Created)');
    const photoDocId = photoRes.data?.document?.id;
    if (photoDocId) createdDocIds.push(photoDocId);

    const panRes = await uploadMultipart({
      reqPath: '/api/documents',
      token: shreyashToken,
      fieldName: 'file',
      filename: 'shreyash_pan.pdf',
      fileBuffer: pdfContent,
      mimeType: 'application/pdf',
      fields: { document_type: 'pan_card' },
    });
    assert(panRes.statusCode === 201, 'Shreyash uploaded PDF pan_card (201 Created)');
    const panDocId = panRes.data?.document?.id;
    if (panDocId) createdDocIds.push(panDocId);

    // 3. Shreyash lists documents via GET /api/documents/me
    console.log('\n--- 3. Shreyash Lists Documents via GET /api/documents/me ---');
    const myDocsRes = await requestHttp({
      method: 'GET',
      path: '/api/documents/me',
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(myDocsRes.statusCode === 200, 'Shreyash fetched /api/documents/me (200 OK)');
    const docs = myDocsRes.data?.documents || [];
    assert(docs.some((d) => d.id === photoDocId), 'JPEG photograph found in Shreyash documents list');
    assert(docs.some((d) => d.id === panDocId), 'PDF pan_card found in Shreyash documents list');

    // 4. Shreyash Previews Uploaded Documents via GET /api/documents/:id/view
    console.log('\n--- 4. Shreyash Views/Previews Documents ---');
    const viewPhotoRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${photoDocId}/view`,
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(viewPhotoRes.statusCode === 200, 'Shreyash previewed JPEG (200 OK)');
    assert(viewPhotoRes.headers['content-type']?.includes('image/jpeg'), `Content-Type is image/jpeg (${viewPhotoRes.headers['content-type']})`);
    assert(viewPhotoRes.headers['content-disposition']?.includes('inline'), 'Content-Disposition is inline for modal preview');

    const viewPdfRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${panDocId}/view`,
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(viewPdfRes.statusCode === 200, 'Shreyash previewed PDF (200 OK)');
    assert(viewPdfRes.headers['content-type']?.includes('application/pdf'), `Content-Type is application/pdf (${viewPdfRes.headers['content-type']})`);
    assert(viewPdfRes.headers['content-disposition']?.includes('inline'), 'Content-Disposition is inline for PDF iframe viewer');

    // 5. Shreyash Downloads Uploaded Documents via GET /api/documents/:id/download
    console.log('\n--- 5. Shreyash Downloads Documents ---');
    const dlPhotoRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${photoDocId}/download`,
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(dlPhotoRes.statusCode === 200, 'Shreyash downloaded JPEG (200 OK)');
    assert(dlPhotoRes.headers['content-disposition']?.includes('attachment'), 'Content-Disposition is attachment for download');

    // 6. Security Check: Second Applicant (Sagar) cannot view or download Shreyash's documents
    console.log('\n--- 6. Security Isolation Check: Second Applicant Blocked ---');
    const sagarViewRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${photoDocId}/view`,
      headers: { Authorization: `Bearer ${sagarToken}` },
    });
    assert(sagarViewRes.statusCode === 403, `Sagar blocked from viewing Shreyash's document (403 Forbidden: ${sagarViewRes.statusCode})`);

    const sagarDlRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${panDocId}/download`,
      headers: { Authorization: `Bearer ${sagarToken}` },
    });
    assert(sagarDlRes.statusCode === 403, `Sagar blocked from downloading Shreyash's document (403 Forbidden: ${sagarDlRes.statusCode})`);

    // 7. Admin & Lender Can View Documents
    console.log('\n--- 7. Admin and Lender Authorized Document Access ---');
    const adminViewRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${photoDocId}/view`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminViewRes.statusCode === 200, 'Admin can view document for compliance inspection (200 OK)');

    const lenderViewRes = await requestHttp({
      method: 'GET',
      path: `/api/documents/${panDocId}/view`,
      headers: { Authorization: `Bearer ${lenderToken}` },
    });
    assert(lenderViewRes.statusCode === 200, 'Lender can view document for risk underwriting (200 OK)');

    // 8. Test Loan Application Attached Documents Integration
    console.log('\n--- 8. Loan Application Attached Documents Integration ---');
    const appRes = await requestHttp({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${shreyashToken}` },
      body: {
        requested_amount: 150000,
        purpose: 'Medical emergency and treatment',
        tenure_months: 18,
        monthly_income: 65000,
        cibil_score: 780,
        employment_type: 'salaried',
      },
    });
    assert(appRes.statusCode === 201, 'Loan application created (201 Created)');
    const appId = appRes.data?.application?.id;
    if (appId) createdAppIds.push(appId);

    // Link pan document to this application
    const client = await pool.connect();
    try {
      await client.query('UPDATE documents SET application_id = $1 WHERE id = $2', [appId, panDocId]);
    } finally {
      client.release();
    }

    const appDetailRes = await requestHttp({
      method: 'GET',
      path: `/api/applications/${appId}`,
      headers: { Authorization: `Bearer ${shreyashToken}` },
    });
    assert(appDetailRes.statusCode === 200, 'Applicant fetched application detail (200 OK)');
    const attachedDocs = appDetailRes.data?.documents || [];
    assert(attachedDocs.length >= 1, `Application includes attached documents (${attachedDocs.length})`);
    assert(attachedDocs.some((d) => d.id === panDocId), 'Attached PAN document present with id and metadata for modal view');

  } finally {
    // 9. Teardown: Clean up all test files and records to guarantee 0 loan applications
    console.log('\n--- 9. Teardown: Guaranteeing Clean 0-Loan State ---');
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
  console.log(`Phase 7 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
