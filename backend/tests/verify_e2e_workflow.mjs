/**
 * Phase 9 End-to-End Comprehensive Lifecycle Verification Suite
 * 
 * Simulates complete lifecycle of a ₹5,00,000 loan:
 * Step 1: Applicant applies for loan -> Application stored in PostgreSQL
 * Step 2: Essential loan data sent to smart contract -> Blockchain records creation
 * Step 3: Tx hash and contract address stored in PostgreSQL
 * Step 4: Admin verifies compliance
 * Step 5: Lender approves loan -> Smart contract logs approval on-chain -> EMIs auto-generated
 * Step 6: Applicant repays EMIs -> Smart contract logs repayment on-chain
 * Step 7: Final payment completes loan -> Smart contract logs loan completion on-chain
 * Step 8: Dashboard retrieves all records from PostgreSQL in <50ms without blockchain RPC lag
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  recordLoanCreationOnChain,
  recordLoanDecisionOnChain,
  recordRepaymentOnChain,
  recordLoanCompletionOnChain,
} from '../src/services/blockchain.js';

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

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    results.push({ name, status: 'PASS', details });
  } else {
    console.error(`  ❌ FAIL: ${name} - ${details}`);
    results.push({ name, status: 'FAIL', details });
  }
}

async function runWorkflow() {
  console.log('\n======================================================');
  console.log('🚀 [CredChain] Phase 9: End-to-End Lifecycle Suite');
  console.log('======================================================\n');

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Get or create test applicant
    const userRes = await client.query(`SELECT id FROM users WHERE role = 'applicant' LIMIT 1`);
    const applicantId = userRes.rows[0]?.id || 'c0000000-0000-0000-0000-000000000003';

    // 2. Step 1: Submit ₹5,00,000 Loan Application
    console.log('📝 Step 1: Submitting ₹5,00,000 loan application into PostgreSQL...');
    const appRes = await client.query(
      `INSERT INTO loan_applications (applicant_id, requested_amount, purpose, tenure_months, status, admin_status)
       VALUES ($1, 500000.00, 'Commercial working capital', 12, 'requested', 'pending')
       RETURNING *`,
      [applicantId]
    );
    const application = appRes.rows[0];
    assert(application.id, 'Loan application created with unique UUID', application.id);
    assert(parseFloat(application.requested_amount) === 500000, 'Requested amount is ₹5,00,000');

    // 3. Step 2 & 3: Anchor creation on blockchain & persist tx hash in PostgreSQL
    console.log('🔗 Step 2 & 3: Recording loan application on smart contract & storing receipt in DB...');
    const creationTx = await recordLoanCreationOnChain(client, application.id, {
      requested_amount: 500000,
      tenure_months: 12,
      purpose: application.purpose,
    });
    assert(creationTx.transaction_hash.startsWith('0x'), 'Blockchain transaction hash created', creationTx.transaction_hash);
    assert(creationTx.contract_address.startsWith('0x'), 'Smart contract address linked', creationTx.contract_address);

    // 4. Admin compliance verification
    console.log('🛡️ Step 4: Admin verifies document compliance...');
    await client.query(
      `UPDATE loan_applications 
       SET admin_status = 'verified', admin_verified_at = NOW(), admin_remarks = 'All KYC and financial criteria satisfied.'
       WHERE id = $1`,
      [application.id]
    );

    // 5. Lender loan approval & auto-generating EMIs
    console.log('💼 Step 5: Lender reviews & approves ₹5,00,000 loan; auto-generating EMI schedule...');
    const P = 500000;
    const n = 12;
    const r = 0.10 / 12;
    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

    for (let i = 1; i <= n; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i * 30));
      await client.query(
        `INSERT INTO repayments (application_id, due_date, amount_due, amount_paid, status)
         VALUES ($1, $2, $3, 0, 'due')`,
        [application.id, dueDate.toISOString().split('T')[0], emi]
      );
    }

    // Record lender approval on blockchain
    const approvalTx = await recordLoanDecisionOnChain(client, application.id, 'approved', {
      lenderId: 'b0000000-0000-0000-0000-000000000002',
    });
    assert(approvalTx.transaction_type === 'loan_approved', 'Lender approval committed on blockchain');

    const emiCountRes = await client.query('SELECT COUNT(*) FROM repayments WHERE application_id = $1', [application.id]);
    assert(parseInt(emiCountRes.rows[0].count, 10) === 12, '12 monthly EMI installments auto-generated in schedule');

    // 6. Step 6: Make repayments and track on-chain
    console.log('💳 Step 6: Applicant pays first EMI installment...');
    const firstRepRes = await client.query(
      `SELECT id, amount_due FROM repayments WHERE application_id = $1 ORDER BY due_date ASC LIMIT 1`,
      [application.id]
    );
    const firstRep = firstRepRes.rows[0];

    const repTx = await recordRepaymentOnChain(client, application.id, {
      repaymentId: firstRep.id,
      amount: firstRep.amount_due,
      paymentReference: 'PAY-E2E-TEST-001',
    });
    assert(repTx.transaction_type === 'repayment', 'Repayment receipt recorded on blockchain');

    // 7. Step 7: Clear all remaining EMIs & complete loan
    console.log('🎉 Step 7: Clearing remaining balance to complete loan...');
    await client.query(
      `UPDATE repayments SET status = 'paid', amount_paid = amount_due, paid_at = NOW() WHERE application_id = $1`,
      [application.id]
    );
    await client.query(
      `UPDATE loan_applications SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [application.id]
    );

    const completionTx = await recordLoanCompletionOnChain(client, application.id);
    assert(completionTx.transaction_type === 'loan_completed', 'Final loan completion recorded on blockchain');

    // 8. Step 8: Dashboard performance audit
    console.log('⚡ Step 8: Testing dashboard read latency directly from PostgreSQL...');
    const t0 = Date.now();
    const dashboardQuery = await client.query(
      `SELECT la.*,
              bt.transaction_hash, bt.contract_address, bt.network, bt.tx_status,
              (SELECT COUNT(*) FROM repayments r WHERE r.application_id = la.id AND r.status = 'paid') AS paid_emis
       FROM loan_applications la
       LEFT JOIN LATERAL (
         SELECT transaction_hash, contract_address, network, tx_status
         FROM blockchain_transactions
         WHERE application_id = la.id
         ORDER BY created_at DESC
         LIMIT 1
       ) bt ON true
       WHERE la.id = $1`,
      [application.id]
    );
    const latencyMs = Date.now() - t0;

    assert(dashboardQuery.rows.length === 1, 'Dashboard successfully fetched single complete loan record');
    assert(parseInt(dashboardQuery.rows[0].paid_emis, 10) === 12, 'All 12 EMIs marked paid in dashboard record');
    assert(dashboardQuery.rows[0].transaction_hash.startsWith('0x'), 'Dashboard possesses verified on-chain tx hash');
    assert(latencyMs < 30, `PostgreSQL read latency was ${latencyMs}ms (Well below 30ms ceiling)`);

    await client.query('ROLLBACK');
    console.log('\n🧹 Test workflow rolled back cleanly.');
  } catch (err) {
    console.error('❌ E2E workflow error:', err.message);
    if (client) await client.query('ROLLBACK').catch(() => {});
  } finally {
    if (client) client.release();
    await pool.end();
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('\n------------------------------------------------------');
  console.log(`E2E Summary: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');
}

runWorkflow();

