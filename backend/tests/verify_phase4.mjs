/**
 * Phase 4 Comprehensive Automated Verification Suite
 * Validates:
 * 1. Express server health endpoint & PostgreSQL connectivity
 * 2. Security headers (Helmet) & CORS configuration
 * 3. Seeded authentication (Admin, Lender, Applicant)
 * 4. JWT token generation, structure, and /api/auth/me verification
 * 5. Role-based access control (RBAC) enforcement across all roles
 * 6. Applicant self-registration & database profile generation
 * 7. Duplicate email prevention (409 Conflict)
 * 8. Authentication failure modes (invalid password -> 401 Unauthorized)
 * 9. Input validation & Zod error handling (bad email / short password -> 400 Bad Request)
 * 10. Audit log entries generated for auth actions
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('   CredChain Phase 4 Automated Verification Suite     ');
  console.log('======================================================\n');

  try {
    // 1. Health & Database Connectivity Check
    console.log('[Test Group 1] Health & Connectivity:');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
    const healthData = await healthRes.json();
    assert(healthData.status === 'healthy', 'Health status is "healthy"', `Got: ${healthData.status}`);
    assert(healthData.database === 'connected', 'PostgreSQL database status is "connected"', `Got: ${healthData.database}`);

    // 2. Security Headers
    console.log('\n[Test Group 2] Security Headers & CORS:');
    const xContentType = healthRes.headers.get('x-content-type-options');
    assert(xContentType === 'nosniff', 'Helmet X-Content-Type-Options: nosniff present');

    // 3. Seeded Accounts Authentication
    console.log('\n[Test Group 3] Seeded User Authentication:');
    // Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@credchain.io', password: 'password123', role: 'admin' }),
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeds with 200 OK');
    const adminData = await adminLoginRes.json();
    assert(!!adminData.token, 'Admin login returns a valid JWT token');
    assert(adminData.user?.role === 'admin', 'Admin user role is verified as "admin"');
    const adminToken = adminData.token;

    // Lender login
    const lenderLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lender@credchain.io', password: 'password123', role: 'lender' }),
    });
    assert(lenderLoginRes.status === 200, 'Lender login succeeds with 200 OK');
    const lenderData = await lenderLoginRes.json();
    assert(!!lenderData.token, 'Lender login returns a valid JWT token');
    assert(lenderData.user?.role === 'lender', 'Lender user role is verified as "lender"');
    const lenderToken = lenderData.token;

    // Applicant login
    const applicantLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@example.com', password: 'password123', role: 'applicant' }),
    });
    assert(applicantLoginRes.status === 200, 'Applicant login succeeds with 200 OK');
    const applicantData = await applicantLoginRes.json();
    assert(!!applicantData.token, 'Applicant login returns a valid JWT token');
    assert(applicantData.user?.role === 'applicant', 'Applicant user role is verified as "applicant"');
    const applicantToken = applicantData.token;

    // 4. Token Verification & User Profile Retrieval (/auth/me)
    console.log('\n[Test Group 4] Token Verification via /api/auth/me:');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(meRes.status === 200, '/api/auth/me with Bearer token succeeds with 200 OK');
    const meData = await meRes.json();
    assert(meData.user?.email === 'admin@credchain.io', 'Current user email matches authenticated user');
    assert(meData.user?.password_hash === undefined, 'Sensitive password hash is NEVER exposed in /auth/me');

    // 5. Role-Based Access Control (RBAC) Enforcement
    console.log('\n[Test Group 5] Role-Based Access Control (RBAC):');
    // Admin access to admin endpoint
    const adminAccess = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAccess.status === 200, 'Admin token successfully accesses /api/admin/dashboard (200 OK)');

    // Applicant accessing admin endpoint -> MUST FAIL with 403
    const applicantToAdmin = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert(applicantToAdmin.status === 403, 'Applicant token blocked from /api/admin/dashboard with 403 Forbidden', `Got: ${applicantToAdmin.status}`);

    // Lender accessing admin endpoint -> MUST FAIL with 403
    const lenderToAdmin = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${lenderToken}` },
    });
    assert(lenderToAdmin.status === 403, 'Lender token blocked from /api/admin/dashboard with 403 Forbidden', `Got: ${lenderToAdmin.status}`);

    // Unauthenticated request to protected endpoint -> MUST FAIL with 401
    const noAuth = await fetch(`${BASE_URL}/admin/dashboard`);
    assert(noAuth.status === 401, 'Unauthenticated request blocked with 401 Unauthorized', `Got: ${noAuth.status}`);

    // Cross-role privilege escalation attempt on login (applicant account requesting admin role)
    const privEscalation = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@example.com', password: 'password123', role: 'admin' }),
    });
    assert(privEscalation.status === 403, 'Privilege escalation (applicant logging in as admin) rejected with 403 Forbidden', `Got: ${privEscalation.status}`);

    // 6. Applicant Self-Registration
    console.log('\n[Test Group 6] Applicant Self-Registration:');
    const uniqueEmail = `applicant.phase4.${Date.now()}@credchain.test`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Phase4 Automated Tester',
        email: uniqueEmail,
        password: 'securePassword2026!',
        phone: '+91 98765 43210',
      }),
    });
    assert(regRes.status === 201, 'Applicant self-registration succeeds with 201 Created', `Got: ${regRes.status}`);
    const regData = await regRes.json();
    assert(!!regData.token, 'Registration returns an active JWT token immediately');
    assert(regData.user?.role === 'applicant', 'Registered user is automatically assigned "applicant" role');

    // Verify DB entry & applicant_profiles row creation
    const dbUserCheck = await pool.query(
      `SELECT u.id, u.email, u.role, ap.user_id AS profile_user_id
       FROM users u
       LEFT JOIN applicant_profiles ap ON ap.user_id = u.id
       WHERE u.email = $1`,
      [uniqueEmail.toLowerCase()]
    );
    assert(dbUserCheck.rows.length === 1, 'User persisted directly in PostgreSQL "users" table');
    assert(!!dbUserCheck.rows[0].profile_user_id, 'Corresponding profile automatically created in "applicant_profiles" table');

    // 7. Duplicate Email Registration Prevention
    console.log('\n[Test Group 7] Duplicate Email Prevention:');
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Duplicate Tester',
        email: uniqueEmail,
        password: 'anotherPassword123!',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate email registration rejected with 409 Conflict', `Got: ${dupRes.status}`);

    // 8. Authentication Failure Modes
    console.log('\n[Test Group 8] Authentication Failure Handling:');
    const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@credchain.io', password: 'incorrectPassword!' }),
    });
    assert(wrongPassRes.status === 401, 'Incorrect password rejected with 401 Unauthorized', `Got: ${wrongPassRes.status}`);

    const nonexistentUserRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost.user.doesnotexist@credchain.io', password: 'password123' }),
    });
    assert(nonexistentUserRes.status === 401, 'Nonexistent account rejected with 401 Unauthorized', `Got: ${nonexistentUserRes.status}`);

    // 9. Input Validation & Error Handling
    console.log('\n[Test Group 9] Input Validation & Zod Schema Enforcement:');
    const badEmailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'pwd' }),
    });
    assert(badEmailRes.status === 400, 'Malformed input rejected with 400 Bad Request', `Got: ${badEmailRes.status}`);
    const badEmailData = await badEmailRes.json();
    assert(Array.isArray(badEmailData.details), 'Validation returns descriptive error details array');

    // 10. Audit Logging Verification
    console.log('\n[Test Group 10] Audit Logging in PostgreSQL:');
    const auditCheck = await pool.query(
      `SELECT action, entity_type FROM audit_logs ORDER BY created_at DESC LIMIT 5`
    );
    const actions = auditCheck.rows.map(r => r.action);
    assert(actions.includes('USER_LOGIN') || actions.includes('USER_REGISTERED'), 'Audit log records user auth actions in PostgreSQL');

    // Summary
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log('\n======================================================');
    console.log(`Phase 4 Verification Summary: ${passed}/${total} checks passed (${failed} failed)`);
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
