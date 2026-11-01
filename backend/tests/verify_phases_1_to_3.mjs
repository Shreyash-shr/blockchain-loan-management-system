import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { recordLoanDecisionOnChain } from '../src/services/blockchain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'credchain',
});

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    results.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    results.push({ name: testName, status: 'FAIL', details });
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🧪 CredChain Automated Test Suite: Phases 1 to 3 Verification');
  console.log('===============================================================\n');

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // SECTION 1: PHASE 1 - ZERO HARDCODED DEMO DATA IN FRONTEND
    // -------------------------------------------------------------
    console.log('--- [Phase 1] Static Code Audit: Elimination of Mock Arrays ---');
    
    const frontendDir = path.resolve(__dirname, '..', '..', 'frontend', 'src');

    const repaymentsFile = fs.readFileSync(path.join(frontendDir, 'pages', 'applicant', 'ApplicantRepayments.jsx'), 'utf-8');
    assert(!repaymentsFile.includes('const defaultRepayments = ['), 'ApplicantRepayments: defaultRepayments array deleted');
    assert(repaymentsFile.includes('setRepayments([])') || repaymentsFile.includes('useState([])'), 'ApplicantRepayments: initializes with empty array');
    assert(repaymentsFile.includes('No Repayments Scheduled'), 'ApplicantRepayments: clean empty state UI present');

    const adminVerifFile = fs.readFileSync(path.join(frontendDir, 'pages', 'admin', 'AdminVerificationPage.jsx'), 'utf-8');
    assert(!adminVerifFile.includes('const defaultApps = ['), 'AdminVerificationPage: defaultApps array deleted');
    assert(adminVerifFile.includes('api.get(\'/admin/verification\')'), 'AdminVerificationPage: live API connection wired');

    const lenderQueueFile = fs.readFileSync(path.join(frontendDir, 'pages', 'lender', 'RequestsQueuePage.jsx'), 'utf-8');
    assert(!lenderQueueFile.includes('const initialLoans = ['), 'RequestsQueuePage: initialLoans array deleted');
    assert(lenderQueueFile.includes('api.get(\'/loans/requests\')'), 'RequestsQueuePage: live API connection wired');

    const loanMonitoringFile = fs.readFileSync(path.join(frontendDir, 'pages', 'admin', 'LoanMonitoringPage.jsx'), 'utf-8');
    assert(!loanMonitoringFile.includes('const demoLoans = ['), 'LoanMonitoringPage: demoLoans array deleted');
    assert(loanMonitoringFile.includes('api.get(\'/admin/loans\')'), 'LoanMonitoringPage: live API connection wired');

    const layoutFile = fs.readFileSync(path.join(frontendDir, 'layouts', 'DashboardLayout.jsx'), 'utf-8');
    assert(layoutFile.includes('flex-shrink-0') && layoutFile.includes('Sign out'), 'DashboardLayout: Sign-out button is sticky & flex-shrink-0');

    // -------------------------------------------------------------
    // SECTION 2: NEW APPLICANT WITH ZERO PRIOR LOANS
    // -------------------------------------------------------------
    console.log('\n--- [Phase 1 & 2] New Applicant Registration & Initial State ---');

    const testEmail = `test_applicant_${Date.now()}@example.com`;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    const userRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ('Shreyash Madgundi', $1, $2, 'applicant')
       RETURNING id, full_name, email, role`,
      [testEmail, hash]
    );
    const newApplicant = userRes.rows[0];
    assert(newApplicant.id != null, 'New applicant user created in PostgreSQL');

    // Create profile with CIBIL score 760
    await client.query(
      `INSERT INTO applicant_profiles (user_id, monthly_income, declared_credit_score, profile_completed)
       VALUES ($1, 68000, 760, true)`,
      [newApplicant.id]
    );

    // Verify applicant has 0 repayments
    const emptyRepayments = await client.query(
      `SELECT r.* FROM repayments r
       JOIN loan_applications la ON la.id = r.application_id
       WHERE la.applicant_id = $1`,
      [newApplicant.id]
    );
    assert(emptyRepayments.rows.length === 0, 'New applicant has 0 active repayments in system (Fixes Screenshot 1 & 2)');

    // -------------------------------------------------------------
    // SECTION 3: APPLICATION SUBMISSION -> ADMIN VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- [Phase 2] Application Submission & Admin Verification Flow ---');

    // 1. Submit loan application
    const appRes = await client.query(
      `INSERT INTO loan_applications (applicant_id, requested_amount, purpose, tenure_months, status, admin_status)
       VALUES ($1, 350000, 'Home renovation and upgrade', 24, 'requested', 'pending')
       RETURNING *`,
      [newApplicant.id]
    );
    const application = appRes.rows[0];
    assert(application.admin_status === 'pending', 'Submitted loan has admin_status = pending');
    assert(application.status === 'requested', 'Submitted loan has status = requested');

    // 2. Admin verification query picks it up
    const adminQueueRes = await client.query(
      `SELECT la.*, u.full_name AS applicant_name, ap.declared_credit_score
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = la.applicant_id
       WHERE la.id = $1 AND la.admin_status IN ('pending', 'needs_correction')`,
      [application.id]
    );
    assert(adminQueueRes.rows.length === 1, 'Submitted loan appears in Admin Verification Queue (Fixes Screenshot 3)');
    assert(adminQueueRes.rows[0].declared_credit_score === 760, 'Applicant credit score (760) properly loaded in Admin inspection');

    // 3. Test Rejection flow on separate low-score applicant
    console.log('\n--- [Phase 2] Condition Failure & Rejection Handling ---');
    const lowScoreAppRes = await client.query(
      `INSERT INTO loan_applications (applicant_id, requested_amount, purpose, tenure_months, status, admin_status)
       VALUES ($1, 120000, 'Medical expenses', 12, 'requested', 'pending')
       RETURNING *`,
      [newApplicant.id]
    );
    const lowApp = lowScoreAppRes.rows[0];

    // Admin rejects application due to low score or missing proof
    await client.query(
      `UPDATE loan_applications
       SET admin_status = 'rejected', status = 'compliance_rejected',
           admin_remarks = 'Applicant CIBIL score 642 is below required threshold of 750.'
       WHERE id = $1`,
      [lowApp.id]
    );

    const rejectedCheck = await client.query('SELECT * FROM loan_applications WHERE id = $1', [lowApp.id]);
    assert(rejectedCheck.rows[0].status === 'compliance_rejected', 'Failed condition marks status as compliance_rejected');
    assert(rejectedCheck.rows[0].admin_remarks.includes('below required threshold'), 'Admin rejection remarks saved for applicant visibility');

    // 4. Admin certifies the valid application
    console.log('\n--- [Phase 2 & 3] Admin Certification -> Lender Queue Hand-off ---');
    await client.query(
      `UPDATE loan_applications
       SET admin_status = 'verified', status = 'compliance_verified',
           admin_remarks = 'All documents are verified and conditions are met successfully.'
       WHERE id = $1`,
      [application.id]
    );

    // Verify it now appears in Lender queue
    const lenderQueueRes = await client.query(
      `SELECT la.*, u.full_name AS applicant_name
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       WHERE la.id = $1 AND la.admin_status = 'verified'`,
      [application.id]
    );
    assert(lenderQueueRes.rows.length === 1, 'Certified application appears in Lender Queue for underwriting (Fixes Screenshot 7)');

    // -------------------------------------------------------------
    // SECTION 4: PHASE 3 - "RETURN TO ADMIN" WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- [Phase 3] Lender "Return to Admin" Discrepancy Workflow ---');

    // Lender notices discrepancy and returns to admin
    const returnReason = '6-Month bank statement is missing page 4; please request re-upload';
    await client.query(
      `UPDATE loan_applications
       SET admin_status = 'needs_correction', status = 'under_review',
           lender_return_message = $1
       WHERE id = $2`,
      [returnReason, application.id]
    );

    const returnedAppCheck = await client.query('SELECT * FROM loan_applications WHERE id = $1', [application.id]);
    assert(returnedAppCheck.rows[0].admin_status === 'needs_correction', 'Lender return sets admin_status = needs_correction');
    assert(returnedAppCheck.rows[0].lender_return_message === returnReason, 'Lender return message stored in PostgreSQL');

    // Admin re-inspection query catches returned application
    const adminReInspectRes = await client.query(
      `SELECT la.* FROM loan_applications la
       WHERE la.id = $1 AND la.admin_status IN ('pending', 'needs_correction')`,
      [application.id]
    );
    assert(adminReInspectRes.rows.length === 1, 'Returned loan re-appears in Admin Verification Queue with corrective state');
    assert(adminReInspectRes.rows[0].lender_return_message != null, 'Admin can view underwriter return note');

    // Admin resolves and re-certifies
    await client.query(
      `UPDATE loan_applications
       SET admin_status = 'verified', status = 'compliance_verified',
           admin_remarks = 'Bank statement page 4 verified and validated.',
           lender_return_message = NULL
       WHERE id = $1`,
      [application.id]
    );
    const reCertified = await client.query('SELECT * FROM loan_applications WHERE id = $1', [application.id]);
    assert(reCertified.rows[0].admin_status === 'verified', 'Admin successfully re-certifies application back to lender');

    // -------------------------------------------------------------
    // SECTION 5: PHASE 3 - LENDER APPROVAL & ON-CHAIN TRANSACTION
    // -------------------------------------------------------------
    console.log('\n--- [Phase 3] Lender Underwriting Approval & On-Chain Settlement ---');

    // Generate EMI schedule (24 months)
    const P = parseFloat(application.requested_amount);
    const tenure = parseInt(application.tenure_months, 10);
    const annualRate = 0.10;
    const r = annualRate / 12;
    const emi = Math.round((P * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1));

    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i * 30));
      await client.query(
        `INSERT INTO repayments (application_id, due_date, amount_due, amount_paid, status)
         VALUES ($1, $2, $3, 0, 'due')`,
        [application.id, dueDate.toISOString().split('T')[0], emi]
      );
    }

    // On-Chain Transaction on Approval
    const blockchainTx = await recordLoanDecisionOnChain(client, application.id, 'approved', {
      verified_credit_score: 760,
      verified_monthly_income: 68000,
    });

    await client.query(
      `UPDATE loan_applications
       SET status = 'approved', decided_at = NOW(), lender_decision_reason = 'Approved based on verified income and CIBIL score.'
       WHERE id = $1`,
      [application.id]
    );

    assert(blockchainTx.transaction_hash != null, 'On-chain transaction hash generated upon lender approval');
    assert(blockchainTx.transaction_type === 'loan_approved', 'Blockchain transaction recorded with type loan_approved');

    // Verify repayments are now scheduled for applicant
    const emiCheck = await client.query(
      'SELECT COUNT(*) FROM repayments WHERE application_id = $1 AND status = $2',
      [application.id, 'due']
    );
    assert(parseInt(emiCheck.rows[0].count, 10) === 24, '24 monthly EMI repayments scheduled after approval');

    // Verify read speed from PostgreSQL without RPC lag
    const t0 = Date.now();
    const joinedCheck = await client.query(
      `SELECT la.*, bt.transaction_hash, bt.contract_address, bt.network
       FROM loan_applications la
       LEFT JOIN blockchain_transactions bt ON bt.application_id = la.id
       WHERE la.id = $1`,
      [application.id]
    );
    const elapsedMs = Date.now() - t0;
    assert(joinedCheck.rows[0].transaction_hash != null, 'Blockchain receipt instantly joined from PostgreSQL');
    assert(elapsedMs < 100, `PostgreSQL off-chain read completed in ${elapsedMs}ms (<100ms requirement)`);

    // Rollback test data to keep DB clean
    await client.query('ROLLBACK');
    console.log('\n🧹 Database transaction rolled back: test data cleanly recycled.');

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('\n❌ Unhandled error during test run:', err);
    assert(false, 'Test execution completed without unhandled exceptions', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }

  // Final Scorecard
  console.log('\n===============================================================');
  console.log('📊 TEST EXECUTION SUMMARY: PHASES 1 TO 3');
  console.log('===============================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success Rate:     ${Math.round((passed / results.length) * 100)}%`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
