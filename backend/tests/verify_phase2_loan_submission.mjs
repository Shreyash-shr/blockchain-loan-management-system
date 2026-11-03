import http from 'http';
import fs from 'fs';
import path from 'path';

console.log('=== PHASE 2 VERIFICATION TEST: LOAN SUBMIT FOR ALL APPLICANTS ===\n');

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

const APPLICANTS = [
  {
    name: 'Shreyash Madgundi',
    email: 'shreemadgundi0111@gmail.com',
    password: 'Shreyash@123',
    phone: '9175331958',
    dob: '1998-05-14',
    income: 45000,
    cibil: 780,
    amount: 150000,
    purpose: 'Home renovation and electronics',
    tenure: 24,
  },
  {
    name: 'Sagar Kukadal',
    email: 'sagarkukadal@gmail.com',
    password: 'Sagar@123',
    phone: '9175331959',
    dob: '1995-08-20',
    income: 52000,
    cibil: 790,
    amount: 200000,
    purpose: 'Higher education course fee',
    tenure: 36,
  },
  {
    name: 'Rahul Kukadal',
    email: 'rahulkukadal@gmail.com',
    password: 'Rahul@123',
    phone: '9960040480',
    dob: '1992-12-10',
    income: 60000,
    cibil: 760,
    amount: 300000,
    purpose: 'Vehicle purchase',
    tenure: 48,
  },
  {
    name: 'Vikas Kalshetti',
    email: 'vikas123@gmail.com',
    password: 'Vikas@123',
    phone: '9503994885',
    dob: '1990-03-25',
    income: 80000,
    cibil: 810,
    amount: 500000,
    purpose: 'Small business expansion',
    tenure: 60,
  },
  {
    name: 'Iresh Patane',
    email: 'ireshpatane@gmail.com',
    password: 'Iresh@123',
    phone: '9373199449',
    dob: '1996-11-05',
    income: 38000,
    cibil: 755,
    amount: 100000,
    purpose: 'Medical emergency reserve',
    tenure: 12,
  },
];

async function run() {
  const dummyFile = Buffer.from('%PDF-1.4 dummy test document content for CredChain testing');

  const createdAppIds = {};

  for (const app of APPLICANTS) {
    console.log(`\n--- Testing Loan Submit for: ${app.name} (${app.email}) ---`);

    // 1. Login
    const loginRes = await requestJson({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: app.email, password: app.password },
    });
    assert(loginRes.statusCode === 200, `${app.name}: Login succeeded (200 OK)`);
    const token = loginRes.data?.token;
    assert(Boolean(token), `${app.name}: JWT token received`);

    // 2. Profile update (PATCH /api/applicants/me)
    const profileRes = await requestJson({
      method: 'PATCH',
      path: '/api/applicants/me',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        full_name: app.name,
        phone: app.phone,
        date_of_birth: app.dob,
        gender: 'Male',
        monthly_income: app.income,
        declared_credit_score: app.cibil,
      },
    });
    assert(profileRes.statusCode === 200, `${app.name}: Profile update succeeded (200 OK)`);

    // 3. Application submit (POST /api/applications)
    const submitRes = await requestJson({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        requested_amount: app.amount,
        purpose: app.purpose,
        tenure_months: app.tenure,
      },
    });
    assert(submitRes.statusCode === 201, `${app.name}: Loan application created (201 Created)`);
    const application = submitRes.data?.application;
    assert(Boolean(application?.id), `${app.name}: Application ID assigned (${application?.id})`);
    assert(application?.status === 'requested', `${app.name}: Status is 'requested'`);
    assert(application?.admin_status === 'pending', `${app.name}: Admin status is 'pending'`);
    assert(Boolean(application?.transaction_hash), `${app.name}: Blockchain transaction hash recorded`);

    createdAppIds[app.email] = application.id;

    // 4. Document upload (POST /api/documents)
    const docRes = await uploadMultipart({
      reqPath: '/api/documents',
      token,
      fieldName: 'file',
      filename: `${app.name.toLowerCase().replace(/\s+/g, '_')}_pan.pdf`,
      fileBuffer: dummyFile,
      mimeType: 'application/pdf',
      fields: {
        document_type: 'pan',
        application_id: application.id,
      },
    });
    if (docRes.statusCode !== 201) {
      console.log('Upload error response:', docRes);
    }
    assert(docRes.statusCode === 201, `${app.name}: Document uploaded successfully (201 Created)`);
  }

  // 5. Admin verification queue check
  console.log('\n--- Checking Admin Verification Queue ---');
  const adminLogin = await requestJson({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'nkocetadmin@gmail.com', password: 'AdminOrchid@123' },
  });
  assert(adminLogin.statusCode === 200, 'Admin login succeeded (200 OK)');
  const adminToken = adminLogin.data?.token;

  const queueRes = await requestJson({
    method: 'GET',
    path: '/api/admin/verification?limit=50',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(queueRes.statusCode === 200, 'Admin verification queue fetch succeeded (200 OK)');

  const queue = queueRes.data?.applications || [];
  console.log(`Applications currently in admin verification queue: ${queue.length}`);
  assert(queue.length >= 5, `Admin queue contains at least 5 pending applications (found: ${queue.length})`);

  for (const app of APPLICANTS) {
    const appId = createdAppIds[app.email];
    const found = queue.find((item) => item.id === appId);
    assert(Boolean(found), `Found application in admin queue for ${app.name} (ID: ${appId})`);
    if (found) {
      assert(found.admin_status === 'pending', `${app.name} admin_status is 'pending'`);
      assert(Number(found.requested_amount) === app.amount, `${app.name} requested_amount matches ₹${app.amount}`);
      assert(Number(found.doc_count) >= 1, `${app.name} has attached document (count: ${found.doc_count})`);
    }

    // Verify no repayments exist for this new application
    const repRes = await requestJson({
      method: 'GET',
      path: `/api/repayments/loan/${appId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const repayments = repRes.data?.repayments || [];
    assert(repayments.length === 0, `${app.name}: 0 repayments created for pending application`);
  }

  console.log(`\n========================================`);
  console.log(`Phase 2 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
