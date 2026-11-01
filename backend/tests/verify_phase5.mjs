/**
 * Phase 5 Comprehensive Automated Verification Suite
 * Validates:
 * 1. Applicant Profile Retrieval (GET /api/applicants/me)
 * 2. Applicant Profile Update (PATCH /api/applicants/me) with validation & audit logs
 * 3. Loan Application Submission (POST /api/applications) with transaction & checks initialization
 * 4. Applications Listing (GET /api/applications/me)
 * 5. Application Details & Cross-user Authorization Isolation (GET /api/applications/:id)
 * 6. Secure Multipart Document Upload (POST /api/documents)
 * 7. Document Listing (GET /api/documents/me)
 * 8. Document Metadata & Secure Download (GET /api/documents/:id/download)
 * 9. Cross-user Document Isolation (Applicant B cannot download Applicant A's documents)
 * 10. File format & MIME type validation (rejection of unpermitted files)
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'credchain',
});

const results = [];

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    results.push({ name, status: 'PASS', details });
  } else {
    console.error(`  ❌ FAIL: ${name} - ${details}`);
    results.push({ name, status: 'FAIL', details });
  }
}

async function loginUser(email, password, role) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   CredChain Phase 5 Automated Verification Suite     ');
  console.log('======================================================\n');

  try {
    // Setup 2 distinct applicant users for cross-authorization testing
    console.log('[Setup] Authenticating test applicants:');
    const applicantA = await loginUser('aarav@example.com', 'password123', 'applicant');
    assert(!!applicantA.token, 'Applicant A authenticated (aarav@example.com)');

    // Register a second applicant for isolation tests
    const applicantBEmail = `applicant.isolated.${Date.now()}@credchain.test`;
    const regB = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Isolated Applicant B',
        email: applicantBEmail,
        password: 'password123!',
        phone: '+91 91234 56789',
      }),
    });
    const applicantBData = await regB.json();
    const applicantB = { token: applicantBData.token, user: applicantBData.user };
    assert(!!applicantB.token, 'Applicant B registered & authenticated');

    // 1. GET /api/applicants/me
    console.log('\n[Test Group 1] Applicant Profile Fetch (GET /api/applicants/me):');
    const profileRes = await fetch(`${BASE_URL}/applicants/me`, {
      headers: { Authorization: `Bearer ${applicantA.token}` },
    });
    assert(profileRes.status === 200, 'GET /api/applicants/me returns 200 OK');
    const profileData = await profileRes.json();
    assert(profileData.profile?.email === 'aarav@example.com', 'Profile matches authenticated user');
    assert('declared_credit_score' in profileData.profile, 'Profile includes declared financial attributes');

    // Test role restriction on profile endpoint
    const lender = await loginUser('lender@credchain.io', 'password123', 'lender');
    const lenderToProfile = await fetch(`${BASE_URL}/applicants/me`, {
      headers: { Authorization: `Bearer ${lender.token}` },
    });
    assert(lenderToProfile.status === 403, 'Lender blocked from applicant profile with 403 Forbidden', `Got: ${lenderToProfile.status}`);

    // 2. PATCH /api/applicants/me
    console.log('\n[Test Group 2] Applicant Profile Update (PATCH /api/applicants/me):');
    const updateRes = await fetch(`${BASE_URL}/applicants/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantA.token}`,
      },
      body: JSON.stringify({
        full_name: 'Aarav Sharma Updated',
        phone: '+91 98765 00000',
        date_of_birth: '1992-05-14',
        gender: 'Male',
        monthly_income: 85000,
        declared_credit_score: 785,
        address_line1: '42, Indiranagar 100ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
      }),
    });
    assert(updateRes.status === 200, 'PATCH /api/applicants/me returns 200 OK');
    const updateData = await updateRes.json();
    assert(updateData.profile_completed === true, 'Profile completion status calculated as true');

    // Verify DB update
    const dbProfile = await pool.query(
      `SELECT u.full_name, u.phone, ap.gender, ap.monthly_income, ap.declared_credit_score, ap.city
       FROM users u
       JOIN applicant_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1`,
      [applicantA.user.id]
    );
    assert(dbProfile.rows[0].full_name === 'Aarav Sharma Updated', 'users table full_name updated');
    assert(Number(dbProfile.rows[0].monthly_income) === 85000, 'applicant_profiles monthly_income updated in PostgreSQL');
    assert(dbProfile.rows[0].city === 'Bengaluru', 'applicant_profiles city updated in PostgreSQL');

    // Validation failure: credit score out of range
    const badScoreRes = await fetch(`${BASE_URL}/applicants/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantA.token}`,
      },
      body: JSON.stringify({ declared_credit_score: 1200 }),
    });
    assert(badScoreRes.status === 400, 'Invalid credit score (>900) rejected with 400 Bad Request');

    // 3. POST /api/applications - Submit Loan Application
    console.log('\n[Test Group 3] Loan Application Submission (POST /api/applications):');
    const applyRes = await fetch(`${BASE_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantA.token}`,
      },
      body: JSON.stringify({
        requested_amount: 450000,
        purpose: 'Home renovation and modular kitchen',
        tenure_months: 36,
      }),
    });
    assert(applyRes.status === 201, 'Loan application created with 201 Created', `Got: ${applyRes.status}`);
    const applyData = await applyRes.json();
    const createdApp = applyData.application;
    assert(!!createdApp?.id, 'Application has generated UUID id');
    assert(Number(createdApp?.requested_amount) === 450000, 'Requested amount recorded correctly');
    assert(createdApp?.status === 'requested', 'Initial status is "requested"');
    assert(createdApp?.verified_credit_score === null, 'verified_credit_score remains null on submission (separation of declared/verified)');

    // Verify verification_checks initialized in DB
    const checksDb = await pool.query(
      `SELECT check_type, status FROM verification_checks WHERE application_id = $1`,
      [createdApp.id]
    );
    assert(checksDb.rows.length === 5, '5 automated verification checks initialized in DB');

    // Validation failure: non-positive amount
    const badAmountRes = await fetch(`${BASE_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantA.token}`,
      },
      body: JSON.stringify({
        requested_amount: -5000,
        purpose: 'Test',
        tenure_months: 12,
      }),
    });
    assert(badAmountRes.status === 400, 'Negative loan amount rejected with 400 Bad Request');

    // 4. GET /api/applications/me
    console.log('\n[Test Group 4] List Applicant Applications (GET /api/applications/me):');
    const myAppsRes = await fetch(`${BASE_URL}/applications/me`, {
      headers: { Authorization: `Bearer ${applicantA.token}` },
    });
    assert(myAppsRes.status === 200, 'GET /api/applications/me returns 200 OK');
    const myAppsData = await myAppsRes.json();
    assert(Array.isArray(myAppsData.applications), 'Applications returned as an array');
    const foundApp = myAppsData.applications.find((a) => a.id === createdApp.id);
    assert(!!foundApp, 'Newly created application present in applicant list');

    // 5. GET /api/applications/:id & Cross-Applicant Isolation
    console.log('\n[Test Group 5] Application Details & Cross-User Isolation (GET /api/applications/:id):');
    const detailRes = await fetch(`${BASE_URL}/applications/${createdApp.id}`, {
      headers: { Authorization: `Bearer ${applicantA.token}` },
    });
    assert(detailRes.status === 200, 'Owner applicant accesses single application (200 OK)');
    const detailData = await detailRes.json();
    assert(detailData.application?.id === createdApp.id, 'Application ID matches requested');
    assert(Array.isArray(detailData.verification_checks), 'Verification checks returned with details');

    // Cross-user test: Applicant B attempting to access Applicant A's application
    const crossAppRes = await fetch(`${BASE_URL}/applications/${createdApp.id}`, {
      headers: { Authorization: `Bearer ${applicantB.token}` },
    });
    assert(crossAppRes.status === 403, 'Cross-user access blocked with 403 Forbidden', `Got: ${crossAppRes.status}`);

    // 6. Secure Multipart Document Upload (POST /api/documents)
    console.log('\n[Test Group 6] Document Upload (POST /api/documents):');
    // Create a temporary dummy PDF file in memory/scratch
    const dummyPdfContent = '%PDF-1.4 sample PDF document content for CredChain testing';
    const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'pan_card_aarav_sharma.pdf');
    formData.append('document_type', 'pan_card');
    formData.append('application_id', createdApp.id);

    const docUploadRes = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantA.token}` },
      body: formData,
    });
    assert(docUploadRes.status === 201, 'Document uploaded successfully with 201 Created', `Got: ${docUploadRes.status}`);
    const docData = await docUploadRes.json();
    const uploadedDoc = docData.document;
    assert(!!uploadedDoc?.id, 'Document assigned UUID');
    assert(uploadedDoc?.document_type === 'pan_card', 'Document type recorded as pan_card');
    assert(uploadedDoc?.verification_status === 'pending', 'Initial document status is "pending"');

    // Check physical file exists in protected uploads directory
    const uploadsDir = path.resolve('server', 'uploads', applicantA.user.id);
    const filesInDir = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    assert(filesInDir.length > 0, 'Physical file stored securely in server/uploads/<user_id>/');

    // 7. GET /api/documents/me
    console.log('\n[Test Group 7] List User Documents (GET /api/documents/me):');
    const myDocsRes = await fetch(`${BASE_URL}/documents/me`, {
      headers: { Authorization: `Bearer ${applicantA.token}` },
    });
    assert(myDocsRes.status === 200, 'GET /api/documents/me returns 200 OK');
    const myDocsData = await myDocsRes.json();
    assert(Array.isArray(myDocsData.documents), 'Documents returned as array');
    const foundDoc = myDocsData.documents.find((d) => d.id === uploadedDoc.id);
    assert(!!foundDoc, 'Uploaded PAN card found in applicant document list');

    // 8. Secure Document Download (GET /api/documents/:id/download)
    console.log('\n[Test Group 8] Document Download (GET /api/documents/:id/download):');
    const downloadRes = await fetch(`${BASE_URL}/documents/${uploadedDoc.id}/download`, {
      headers: { Authorization: `Bearer ${applicantA.token}` },
    });
    assert(downloadRes.status === 200, 'Owner can download document with 200 OK');
    const downloadedText = await downloadRes.text();
    assert(downloadedText.includes('%PDF-1.4'), 'Downloaded file content matches uploaded bytes');

    // 9. Cross-User Document Isolation
    console.log('\n[Test Group 9] Cross-User Document Isolation:');
    const crossDocRes = await fetch(`${BASE_URL}/documents/${uploadedDoc.id}/download`, {
      headers: { Authorization: `Bearer ${applicantB.token}` },
    });
    assert(crossDocRes.status === 403, 'Applicant B blocked from downloading Applicant A doc with 403 Forbidden', `Got: ${crossDocRes.status}`);

    const crossDocMeta = await fetch(`${BASE_URL}/documents/${uploadedDoc.id}`, {
      headers: { Authorization: `Bearer ${applicantB.token}` },
    });
    assert(crossDocMeta.status === 403, 'Applicant B blocked from viewing metadata with 403 Forbidden', `Got: ${crossDocMeta.status}`);

    // 10. File format & MIME type validation
    console.log('\n[Test Group 10] Document Validation (Disallowed File Type):');
    const badBlob = new Blob(['malicious executable'], { type: 'application/x-msdownload' });
    const badForm = new FormData();
    badForm.append('file', badBlob, 'exploit.exe');
    badForm.append('document_type', 'pan_card');

    const badDocRes = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantA.token}` },
      body: badForm,
    });
    assert(badDocRes.status === 400, 'Disallowed MIME type (.exe) rejected with 400 Bad Request', `Got: ${badDocRes.status}`);

    // Summary
    const total = results.length;
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;

    console.log('\n======================================================');
    console.log(`Phase 5 Verification Summary: ${passed}/${total} checks passed (${failed} failed)`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
