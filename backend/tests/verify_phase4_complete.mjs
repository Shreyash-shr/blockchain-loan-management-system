/**
 * ============================================================================
 * CREDCHAIN AUTOMATED TEST SUITE: PHASE 4 VERIFICATION
 * ============================================================================
 * Tests:
 * 1. Dynamic repayment tracking & outstanding balance reduction
 * 2. Cryptographic PDF receipt generation (PDFKit stream validation)
 * 3. Real-time lender portfolio analytics (/api/loans/stats)
 * 4. In-app notifications CRUD & lifecycle triggers
 * 5. Headless Chrome UI reflection and screenshot capture
 */

import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../src/config/database.js';
import { generateToken } from '../src/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const backendDir = path.resolve(rootDir, 'backend');
const screenshotDir = path.resolve(rootDir, 'test-results', 'screenshots');
const artifactDir = 'C:\\Users\\sk\\.gemini\\antigravity\\brain\\db12593f-72a2-4a8f-a21e-a8d5003ac717';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5000';

let backendProcess = null;
let frontendProcess = null;
let browser = null;

const results = [];
function recordResult(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✅ PASS:' : '❌ FAIL:';
  console.log(`  ${icon} ${name} ${detail ? '(' + detail + ')' : ''}`);
}

async function waitForUrl(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function startServers() {
  console.log('🚀 Starting Backend and Frontend servers for Phase 4 tests...');
  backendProcess = spawn('node', ['src/app.js'], {
    cwd: backendDir,
    env: { ...process.env, PORT: '5000', NODE_ENV: 'test' },
    stdio: 'ignore',
  });

  frontendProcess = spawn('npx.cmd', ['vite', '--port', '5173'], {
    cwd: frontendDir,
    shell: true,
    stdio: 'ignore',
  });

  await waitForUrl(`${BACKEND_URL}/api/health`, 15000);
  console.log('  ✓ Backend API listening on port 5000');
  await waitForUrl(FRONTEND_URL, 20000);
  console.log('  ✓ Frontend Vite server listening on port 5173');
}

async function stopServers() {
  console.log('🛑 Stopping test servers...');
  if (browser) {
    try { await browser.close(); } catch {}
  }
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
  }
  if (frontendProcess) {
    try {
      spawn('taskkill', ['/pid', frontendProcess.pid, '/f', '/t'], { stdio: 'ignore' });
    } catch {}
  }
}

async function setAuth(page, user) {
  const token = generateToken(user);
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('credchain_token', t);
      localStorage.setItem('credchain_user', JSON.stringify(u));
    },
    { t: token, u: user }
  );
}

async function capture(page, filename, description) {
  const localPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  if (fs.existsSync(artifactDir)) {
    const artPath = path.join(artifactDir, filename);
    fs.copyFileSync(localPath, artPath);
  }
  console.log(`  📸 Screenshot saved: ${filename} - ${description}`);
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('💳 CREDCHAIN AUTOMATED TEST SUITE: PHASE 4 VERIFICATION');
  console.log('===============================================================\n');

  try {
    await startServers();

    // -------------------------------------------------------------
    // DB SETUP: Test Applicant with Approved Loan & Repayment Schedule
    // -------------------------------------------------------------
    console.log('\n--- Setting up DB fixtures for Phase 4 ---');
    const applicantEmail = `phase4.applicant.${Date.now()}@credchain.test`;
    const appUserRes = await query(
      `INSERT INTO users (full_name, email, role, password_hash)
       VALUES ('Karan Singhania', $1, 'applicant', 'test_hash')
       RETURNING id, full_name, email, role`,
      [applicantEmail]
    );
    const applicantUser = appUserRes.rows[0];
    await query(
      `INSERT INTO applicant_profiles (user_id, monthly_income, declared_credit_score)
       VALUES ($1, 95000, 790)`,
      [applicantUser.id]
    );

    // Create approved loan of ₹3,00,000 with 12 months tenure
    const loanRes = await query(
      `INSERT INTO loan_applications (
        applicant_id, requested_amount, tenure_months, purpose,
        status, admin_status
       ) VALUES ($1, 300000.00, 12, 'Commercial Equipment Expansion', 'approved', 'verified')
       RETURNING id`,
      [applicantUser.id]
    );
    const loanId = loanRes.rows[0].id;

    // Insert 12 EMI instalments of ₹26,375 each
    const emiAmount = 26375.00;
    const repaymentIds = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date();
      d.setDate(d.getDate() + (i * 30));
      const repRes = await query(
        `INSERT INTO repayments (application_id, due_date, amount_due, amount_paid, status)
         VALUES ($1, $2, $3, 0, 'due')
         RETURNING id`,
        [loanId, d.toISOString().split('T')[0], emiAmount]
      );
      repaymentIds.push(repRes.rows[0].id);
    }
    console.log(`  ✓ Created approved loan of ₹3,00,000 with 12 instalments for ${applicantUser.full_name}`);

    const applicantToken = generateToken(applicantUser);
    const lenderUser = {
      id: 'b0000000-0000-0000-0000-000000000002',
      full_name: 'Apex Capital Underwriters',
      email: 'lender@credchain.io',
      role: 'lender',
    };
    const lenderToken = generateToken(lenderUser);

    // -------------------------------------------------------------
    // SECTION 1: Dynamic Repayment Checkout & Balance Reduction (4.1 & 4.2)
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Dynamic Repayment Processing & Amortization ---');

    // 1. Initial repayment state
    const initRepRes = await query(
      `SELECT SUM(amount_due) AS total_due, SUM(amount_paid) AS total_paid
       FROM repayments WHERE application_id = $1`,
      [loanId]
    );
    const initialDue = parseFloat(initRepRes.rows[0].total_due);
    const initialPaid = parseFloat(initRepRes.rows[0].total_paid);
    recordResult('Initial total due is exactly 12x EMI (₹3,16,500)', initialDue === 12 * emiAmount);
    recordResult('Initial total paid is ₹0', initialPaid === 0);

    // 2. Pay 1st instalment via API checkout
    const checkoutRes = await fetch(`${BACKEND_URL}/api/repayments/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({ repayment_id: repaymentIds[0] }),
    });
    const checkoutData = await checkoutRes.json();

    recordResult('Repayment checkout returned HTTP 200', checkoutRes.status === 200);
    recordResult('Payment reference generated', !!checkoutData.payment_reference, checkoutData.payment_reference);
    recordResult('Repayment recorded on smart contract with transaction hash', !!checkoutData.blockchain_tx?.transaction_hash);

    // 3. Verify DB state after payment
    const afterRepRes = await query(
      `SELECT * FROM repayments WHERE id = $1`,
      [repaymentIds[0]]
    );
    const paidRepayment = afterRepRes.rows[0];
    recordResult('Repayment status updated to "paid"', paidRepayment.status === 'paid');
    recordResult('Repayment amount_paid matches amount_due', parseFloat(paidRepayment.amount_paid) === emiAmount);

    const afterTotals = await query(
      `SELECT SUM(amount_paid) AS total_paid FROM repayments WHERE application_id = $1`,
      [loanId]
    );
    const newPaid = parseFloat(afterTotals.rows[0].total_paid);
    const outstanding = initialDue - newPaid;
    recordResult('Outstanding principal properly reduced by paid instalment', outstanding === 11 * emiAmount, `New balance: ₹${outstanding}`);

    // -------------------------------------------------------------
    // SECTION 2: Cryptographic PDF Receipt Generation (4.3)
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Cryptographic PDF Receipt Generation ---');

    // 1. Download receipt for paid instalment
    const receiptRes = await fetch(`${BACKEND_URL}/api/repayments/${repaymentIds[0]}/receipt`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const receiptContentType = receiptRes.headers.get('content-type');
    const receiptContentDisp = receiptRes.headers.get('content-disposition');
    const receiptBuffer = await receiptRes.arrayBuffer();

    recordResult('Receipt endpoint returns HTTP 200', receiptRes.status === 200);
    recordResult('Receipt Content-Type is application/pdf', receiptContentType?.includes('application/pdf'));
    recordResult('Receipt header includes attachment filename', receiptContentDisp?.includes('CredChain-Receipt-'));
    
    // Verify PDF Magic Bytes (%PDF-)
    const pdfMagicBytes = Buffer.from(receiptBuffer).slice(0, 5).toString('ascii');
    recordResult('PDF binary stream is valid (%PDF header)', pdfMagicBytes === '%PDF-', `Magic: ${pdfMagicBytes}`);
    recordResult('PDF size is substantial (> 4KB)', receiptBuffer.byteLength > 4000, `${receiptBuffer.byteLength} bytes`);

    // 2. Reject receipt for unpaid instalment
    const unpaidReceiptRes = await fetch(`${BACKEND_URL}/api/repayments/${repaymentIds[1]}/receipt`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    recordResult('Unpaid instalment rejects receipt generation with HTTP 400', unpaidReceiptRes.status === 400);

    // -------------------------------------------------------------
    // SECTION 3: Live Lender Portfolio Statistics (4.4 & 4.5)
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Live Lender Portfolio Statistics ---');

    const statsRes = await fetch(`${BACKEND_URL}/api/loans/stats`, {
      headers: { Authorization: `Bearer ${lenderToken}` },
    });
    const statsData = await statsRes.json();

    recordResult('Lender stats endpoint returns HTTP 200', statsRes.status === 200);
    recordResult('Lender stats contains pending_underwriting count', statsData?.stats?.pending_underwriting !== undefined);
    recordResult('Lender stats contains approved_loans count', parseInt(statsData?.stats?.approved_loans) >= 1);
    recordResult('Lender stats contains active_capital and total_disbursed', parseFloat(statsData?.stats?.total_disbursed) >= 300000);

    // -------------------------------------------------------------
    // SECTION 4: In-App Notifications API & Flow (4.6)
    // -------------------------------------------------------------
    console.log('\n--- Section 4: In-App Notifications API & Lifecycle ---');

    // Fetch notifications for applicant (triggered by loan checkout)
    const notifsRes = await fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const notifsData = await notifsRes.json();

    recordResult('Notifications endpoint returns HTTP 200', notifsRes.status === 200);
    recordResult('Repayment triggered an in-app notification for applicant', notifsData?.notifications?.length > 0);
    const firstNotif = notifsData.notifications[0];
    recordResult('Notification contains title & payment details', firstNotif.title.includes('Repayment'), firstNotif.title);
    recordResult('Unread count is greater than 0', notifsData.unread_count > 0, `Unread: ${notifsData.unread_count}`);

    // Mark single notification as read
    const readRes = await fetch(`${BACKEND_URL}/api/notifications/${firstNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const readData = await readRes.json();
    recordResult('Mark as read returned HTTP 200 and is_read = true', readData?.notification?.is_read === true);

    // Mark all as read
    const readAllRes = await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    recordResult('Mark all read returned HTTP 200', readAllRes.status === 200);

    // -------------------------------------------------------------
    // SECTION 5: Headless Chrome UI Automated Verification & Screenshots
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Headless Chrome UI Reflection & Screenshots ---');

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });
    const page = await browser.newPage();

    // 1. Applicant Repayments Page with Paid Instalment & Receipt Download Button
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await setAuth(page, applicantUser);
    await page.goto(`${FRONTEND_URL}/applicant/repayments`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('table, tr, td');
    await new Promise((r) => setTimeout(r, 1500));

    const applicantRepaymentsText = await page.evaluate(() => document.body.innerText);
    const hasPaidBadge = applicantRepaymentsText.includes('paid') || applicantRepaymentsText.includes('Paid');
    const hasReceiptButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.innerText.includes('Receipt'));
    });

    recordResult('UI: Repayments schedule displays "paid" status for cleared instalment', hasPaidBadge);
    recordResult('UI: Download "Receipt" button rendered for paid instalments', hasReceiptButton);
    await capture(page, 'phase4_applicant_repayments_with_receipt.png', 'Applicant Repayments with Receipt Download button');

    // 2. Interactive Notifications Bell Popover in DashboardLayout
    // Click the notification bell to open popover
    const bellClicked = await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title="Notifications"]');
      if (bellBtn) {
        bellBtn.click();
        return true;
      }
      return false;
    });

    if (bellClicked) {
      await new Promise((r) => setTimeout(r, 600));
      const popoverText = await page.evaluate(() => document.body.innerText);
      const hasNotifsHeader = popoverText.includes('Notifications');
      recordResult('UI: Notification bell dropdown popover opens interactively', hasNotifsHeader);
      await capture(page, 'phase4_notifications_dropdown.png', 'Interactive Notifications dropdown popover');
    } else {
      recordResult('UI: Notification bell button found', false);
    }

    // 3. Lender Overview with Real-Time Portfolio Analytics
    await setAuth(page, lenderUser);
    await page.goto(`${FRONTEND_URL}/lender`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h2, div');
    await new Promise((r) => setTimeout(r, 1500));

    const lenderOverviewText = await page.evaluate(() => document.body.innerText);
    const hasApprovedStat = lenderOverviewText.includes('Approved Loans');
    recordResult('UI: Lender Overview displays live portfolio statistics', hasApprovedStat);
    await capture(page, 'phase4_lender_overview_stats.png', 'Lender Overview with live portfolio stats');

    // -------------------------------------------------------------
    // CLEANUP FIXTURES
    // -------------------------------------------------------------
    await query(`DELETE FROM repayments WHERE application_id = $1`, [loanId]);
    await query(`DELETE FROM notifications WHERE user_id = $1`, [applicantUser.id]);
    await query(`DELETE FROM audit_logs WHERE actor_user_id = $1`, [applicantUser.id]);
    await query(`DELETE FROM blockchain_transactions WHERE application_id = $1`, [loanId]);
    await query(`DELETE FROM loan_applications WHERE id = $1`, [loanId]);
    await query(`DELETE FROM applicant_profiles WHERE user_id = $1`, [applicantUser.id]);
    await query(`DELETE FROM users WHERE id = $1`, [applicantUser.id]);
    console.log('\n  ✓ Phase 4 test fixtures cleaned up from PostgreSQL.');

  } catch (err) {
    console.error('❌ Test suite execution error:', err);
    recordResult('Suite Execution Exception', false, err.message);
  } finally {
    await stopServers();
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('📊 TEST EXECUTION SUMMARY: PHASE 4');
  console.log('===============================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success Rate:     ${Math.round((passed / results.length) * 100)}%`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
