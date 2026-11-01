/**
 * Phase 8 Comprehensive Blockchain & PostgreSQL Integration Test Suite
 * Validates:
 * 1. Blockchain service initialization & configuration
 * 2. Loan creation generates on-chain transaction hash stored in PostgreSQL
 * 3. Lender decision generates on-chain transaction hash stored in PostgreSQL
 * 4. Repayment generates on-chain transaction hash stored in PostgreSQL
 * 5. Full loan repayment marks loan completed on-chain
 * 6. Quick retrieval from PostgreSQL without high-latency blockchain queries
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

async function runTests() {
  console.log('\n======================================================');
  console.log('🔗 [CredChain] Phase 8: Blockchain + PostgreSQL Suite');
  console.log('======================================================\n');

  let client;
  try {
    client = await pool.connect();
    console.log('📡 Connected to PostgreSQL database.\n');

    // Test 1: Verify blockchain_transactions table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'blockchain_transactions'
    `);
    assert(tableCheck.rows.length === 1, 'Table blockchain_transactions exists in PostgreSQL');

    // Test 2: Seeded application has on-chain record
    const seededTx = await client.query(`
      SELECT * FROM blockchain_transactions 
      WHERE application_id = 'd0000000-0000-0000-0000-000000000004'
    `);
    if (seededTx.rows.length > 0) {
      assert(seededTx.rows[0].transaction_hash.startsWith('0x'), 'Seeded application has valid hex transaction hash');
      assert(seededTx.rows[0].contract_address.startsWith('0x'), 'Seeded application has valid smart contract address');
    } else {
      console.log('  ℹ️ Seed record not yet populated, testing dynamic creation...');
    }

    // Test 3: Transactional loan creation on blockchain
    await client.query('BEGIN');
    const fakeAppId = 'd0000000-0000-0000-0000-000000000004';
    const tx1 = await recordLoanCreationOnChain(client, fakeAppId, {
      requested_amount: 500000,
      tenure_months: 24,
      purpose: 'Business Equipment',
    });

    assert(tx1.transaction_hash && tx1.transaction_hash.startsWith('0x'), 'recordLoanCreationOnChain generates 0x transaction hash');
    assert(tx1.contract_address && tx1.contract_address.startsWith('0x'), 'recordLoanCreationOnChain records contract address');
    assert(tx1.tx_status === 'confirmed', 'Transaction status is confirmed');

    // Test 4: Lender approval decision recorded on blockchain
    const tx2 = await recordLoanDecisionOnChain(client, fakeAppId, 'approved', {
      lenderId: 'b0000000-0000-0000-0000-000000000002',
    });
    assert(tx2.transaction_type === 'loan_approved', 'recordLoanDecisionOnChain records loan_approved transaction');
    assert(tx2.transaction_hash !== tx1.transaction_hash, 'Approval produces unique transaction hash');

    // Test 5: Repayment recorded on blockchain
    const tx3 = await recordRepaymentOnChain(client, fakeAppId, {
      repaymentId: 'rep-test-01',
      amount: 25000,
      paymentReference: 'PAY-TEST-998877',
    });
    assert(tx3.transaction_type === 'repayment', 'recordRepaymentOnChain records repayment transaction');

    // Test 6: Final loan completion recorded on blockchain
    const tx4 = await recordLoanCompletionOnChain(client, fakeAppId);
    assert(tx4.transaction_type === 'loan_completed', 'recordLoanCompletionOnChain records loan_completed transaction');

    // Test 7: Performance & Fast Retrieval from PostgreSQL
    const start = Date.now();
    const allTxs = await client.query(
      'SELECT * FROM blockchain_transactions WHERE application_id = $1 ORDER BY created_at DESC',
      [fakeAppId]
    );
    const duration = Date.now() - start;
    assert(allTxs.rows.length >= 4, 'All 4 blockchain lifecycle transactions persisted in PostgreSQL');
    assert(duration < 50, `PostgreSQL reads blockchain records in ${duration}ms (target: < 50ms)`);

    await client.query('ROLLBACK'); // Roll back test transactions
    console.log('\n🧹 Test transactions rolled back cleanly.');

  } catch (err) {
    console.error('❌ Test execution error:', err.message);
    if (client) await client.query('ROLLBACK').catch(() => {});
  } finally {
    if (client) client.release();
    await pool.end();
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');
}

runTests();

