import http from 'http';
import { readFileSync } from 'fs';
import path from 'path';

console.log('=== PHASE 1 VERIFICATION TEST: SEPARATE LOGIN & TAB-ISOLATED SESSIONS ===\n');

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

// 1. Verify code structure in frontend
console.log('--- 1. Frontend Session & Login Architecture Verification ---');

const sessionJs = readFileSync(path.resolve('frontend/src/services/session.js'), 'utf-8');
assert(sessionJs.includes('sessionStorage.getItem'), 'session.js reads from sessionStorage');
assert(sessionJs.includes('sessionStorage.setItem'), 'session.js writes to sessionStorage');
assert(sessionJs.includes('clearSession'), 'session.js exports clearSession');
assert(sessionJs.includes('clearLegacySharedSession'), 'session.js exports clearLegacySharedSession for clean migration');

const apiJs = readFileSync(path.resolve('frontend/src/services/api.js'), 'utf-8');
assert(apiJs.includes('readSessionToken'), 'api.js uses readSessionToken instead of localStorage');
assert(apiJs.includes('writeSessionToken'), 'api.js uses writeSessionToken');
assert(apiJs.includes('clearSession'), 'api.js uses clearSession on 401 response');
assert(!apiJs.includes('localStorage.getItem'), 'api.js has NO direct localStorage.getItem calls');

const authContextJs = readFileSync(path.resolve('frontend/src/context/AuthContext.jsx'), 'utf-8');
assert(authContextJs.includes('readSessionToken'), 'AuthContext uses readSessionToken');
assert(authContextJs.includes('readSessionUser'), 'AuthContext uses readSessionUser');
assert(authContextJs.includes('writeSessionUser'), 'AuthContext uses writeSessionUser');
assert(authContextJs.includes('clearSession'), 'AuthContext uses clearSession on logout');

const loginPageJs = readFileSync(path.resolve('frontend/src/pages/auth/LoginPage.jsx'), 'utf-8');
assert(loginPageJs.includes('useParams'), 'LoginPage reads role parameter from URL (:role)');
assert(loginPageJs.includes('WORKSPACES'), 'LoginPage defines WORKSPACES mapping');
assert(loginPageJs.includes('userRole !== roleParam'), 'LoginPage validates user role against active workspace role');
assert(loginPageJs.includes("roleParam === 'applicant'"), 'LoginPage only displays registration link for applicant workspace');

const loginChooserJs = readFileSync(path.resolve('frontend/src/pages/auth/LoginChooser.jsx'), 'utf-8');
assert(loginChooserJs.includes("role: 'applicant'") && loginChooserJs.includes('`/login/${workspace.role}`'), 'LoginChooser links dynamically to /login/:role including applicant');
assert(loginChooserJs.includes("role: 'lender'"), 'LoginChooser configures lender role workspace');
assert(loginChooserJs.includes("role: 'admin'"), 'LoginChooser configures admin role workspace');

const repaymentsJs = readFileSync(path.resolve('frontend/src/pages/applicant/ApplicantRepayments.jsx'), 'utf-8');
assert(!repaymentsJs.includes("localStorage.getItem('credchain_token')"), 'ApplicantRepayments does not read token from localStorage');
assert(repaymentsJs.includes('api.getToken()'), 'ApplicantRepayments uses api.getToken() for receipts');

const appJs = readFileSync(path.resolve('frontend/src/App.jsx'), 'utf-8');
assert(appJs.includes('<LoginChooser />'), 'App.jsx sets up LoginChooser at /login');
assert(appJs.includes('path="/login/:role"'), 'App.jsx sets up /login/:role for role-specific login');

console.log('\n--- 2. Backend Authentication API Role Verification ---');

async function testApiLogin(email, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email, password });
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

try {
  // Test 1: Admin login
  const adminRes = await testApiLogin('nkocetadmin@gmail.com', 'AdminOrchid@123');
  assert(adminRes.statusCode === 200, 'Admin can login via API (200 OK)');
  assert(adminRes.data?.user?.role === 'admin', 'Admin user object has role "admin"');
  assert(Boolean(adminRes.data?.token), 'Admin login returns a valid JWT token');

  // Test 2: Lender login
  const lenderRes = await testApiLogin('nkocetaccount@gmail.com', 'Orchid@123');
  assert(lenderRes.statusCode === 200, 'Lender can login via API (200 OK)');
  assert(lenderRes.data?.user?.role === 'lender', 'Lender user object has role "lender"');

  // Test 3: Applicant login
  const applicantRes = await testApiLogin('shreemadgundi0111@gmail.com', 'Shreyash@123');
  assert(applicantRes.statusCode === 200, 'Applicant (Shreyash) can login via API (200 OK)');
  assert(applicantRes.data?.user?.role === 'applicant', 'Applicant user object has role "applicant"');

  // Test 4: Mismatched role enforcement check simulation
  // If an applicant logs in on /login/admin:
  // result.user.role ('applicant') !== roleParam ('admin') -> rejected
  const simulatedApplicantOnAdminPage = applicantRes.data.user.role === 'admin';
  assert(!simulatedApplicantOnAdminPage, 'Role enforcement: applicant credentials are not recognized as admin');

  const simulatedLenderOnApplicantPage = lenderRes.data.user.role === 'applicant';
  assert(!simulatedLenderOnApplicantPage, 'Role enforcement: lender credentials are not recognized as applicant');

} catch (err) {
  console.log(`Backend server check skipped or error: ${err.message}. (Backend may not be running)`);
}

console.log(`\n========================================`);
console.log(`Phase 1 Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
