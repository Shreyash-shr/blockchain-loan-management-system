import { Router } from 'express';
import { query, getClient } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, loanApplicationSchema } from '../validators/schemas.js';
import { recordLoanCreationOnChain } from '../services/blockchain.js';

const router = Router();

// GET /api/applications/me - List all applications for the authenticated applicant with blockchain audit info
router.get('/me', authenticate, authorize('applicant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT la.*, u.full_name AS applicant_name,
              (SELECT COUNT(*) FROM documents d WHERE d.application_id = la.id) AS doc_count,
              bt.transaction_hash,
              bt.contract_address,
              bt.network,
              bt.tx_status AS blockchain_status,
              bt.confirmed_at AS blockchain_confirmed_at
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN LATERAL (
         SELECT transaction_hash, contract_address, network, tx_status, confirmed_at
         FROM blockchain_transactions
         WHERE application_id = la.id
         ORDER BY created_at DESC
         LIMIT 1
       ) bt ON true
       WHERE la.applicant_id = $1
       ORDER BY la.submitted_at DESC`,
      [req.user.id]
    );

    res.json({ applications: result.rows });
  } catch (err) {
    console.error('Applications fetch error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve applications.' });
  }
});

// POST /api/applications - Submit a new loan application (Steps 1, 2, 3, 4)
router.post('/', authenticate, authorize('applicant'), validate(loanApplicationSchema), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { requested_amount, purpose, tenure_months } = req.body;

    // Step 1: Store complete loan application details in PostgreSQL
    const result = await client.query(
      `INSERT INTO loan_applications (applicant_id, requested_amount, purpose, tenure_months)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.user.id,
        requested_amount,
        purpose,
        tenure_months,
      ]
    );

    const application = result.rows[0];

    // Create initial verification checks
    const checkTypes = ['cibil_score', 'age_limit', 'income_threshold', 'existing_loans', 'kyc_docs'];
    for (const checkType of checkTypes) {
      await client.query(
        `INSERT INTO verification_checks (application_id, check_type, status, result_summary)
         VALUES ($1, $2, 'pending', '{}')`,
        [application.id, checkType]
      );
    }

    // Step 2, 3 & 4: Relay essential loan info to smart contract & persist tx hash/contract address in PostgreSQL
    const blockchainTx = await recordLoanCreationOnChain(client, application.id, {
      requested_amount,
      purpose,
      tenure_months,
    });

    // Audit log linking the blockchain transaction hash
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'LOAN_APPLICATION_SUBMITTED', 'loan_application', $2, $3)`,
      [
        req.user.id,
        application.id,
        JSON.stringify({
          amount: requested_amount,
          purpose,
          tenure_months,
          transaction_hash: blockchainTx.transaction_hash,
          contract_address: blockchainTx.contract_address,
        }),
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Loan application submitted successfully and registered on blockchain.',
      application: {
        ...application,
        transaction_hash: blockchainTx.transaction_hash,
        contract_address: blockchainTx.contract_address,
        network: blockchainTx.network,
        blockchain_status: blockchainTx.tx_status,
      },
      blockchain_tx: blockchainTx,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Application submission error:', err.message);
    res.status(500).json({ error: 'Failed to submit application.' });
  } finally {
    client.release();
  }
});

// GET /api/applications/:id - Get a single application (with role checks)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT la.*, u.full_name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone,
              ap.date_of_birth, ap.gender, ap.address_line1, ap.city, ap.state, ap.pincode,
              ap.monthly_income AS profile_monthly_income, ap.declared_credit_score,
              ap.existing_loan_details, ap.existing_monthly_emi
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = la.applicant_id
       WHERE la.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = result.rows[0];

    // Applicants can only see their own applications
    if (req.user.role === 'applicant' && application.applicant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get documents
    const docsResult = await query(
      `SELECT id, document_type, original_filename, mime_type, file_size_bytes, 
              verification_status, reviewer_note, uploaded_at, reviewed_at
       FROM documents WHERE application_id = $1
       ORDER BY uploaded_at`,
      [req.params.id]
    );

    // Get verification checks
    const checksResult = await query(
      `SELECT * FROM verification_checks WHERE application_id = $1 ORDER BY created_at`,
      [req.params.id]
    );

    // Step 5: Read blockchain receipts quickly from PostgreSQL without slow blockchain RPC calls
    const blockchainResult = await query(
      `SELECT id, network, contract_address, transaction_hash, transaction_type, tx_status, confirmed_at, created_at
       FROM blockchain_transactions
       WHERE application_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      application,
      documents: docsResult.rows,
      verification_checks: checksResult.rows,
      blockchain_transactions: blockchainResult.rows,
    });
  } catch (err) {
    console.error('Application detail error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve application details.' });
  }
});

export default router;
