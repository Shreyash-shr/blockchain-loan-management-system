import { Router } from 'express';
import { query, getClient } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { recordRepaymentOnChain, recordLoanCompletionOnChain } from '../services/blockchain.js';

const router = Router();

// GET /api/repayments/me - List repayments for the authenticated applicant
router.get('/me', authenticate, authorize('applicant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, la.application_number, la.purpose, la.requested_amount
       FROM repayments r
       JOIN loan_applications la ON la.id = r.application_id
       WHERE la.applicant_id = $1
       ORDER BY r.due_date ASC`,
      [req.user.id]
    );

    res.json({ repayments: result.rows });
  } catch (err) {
    console.error('Repayments fetch error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve repayments.' });
  }
});

// POST /api/repayments/checkout - Mark a repayment as paid (with on-chain audit receipt)
router.post('/checkout', authenticate, authorize('applicant'), async (req, res) => {
  const client = await getClient();
  try {
    const repayment_id = req.body.repayment_id || req.body.repaymentId;

    if (!repayment_id) {
      return res.status(400).json({ error: 'Repayment ID is required.' });
    }

    await client.query('BEGIN');

    // Verify repayment belongs to this applicant
    const repResult = await client.query(
      `SELECT r.*, la.applicant_id 
       FROM repayments r 
       JOIN loan_applications la ON la.id = r.application_id
       WHERE r.id = $1 FOR UPDATE`,
      [repayment_id]
    );

    if (repResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Repayment not found.' });
    }

    const repayment = repResult.rows[0];
    if (repayment.applicant_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (repayment.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This repayment has already been paid.' });
    }

    // Mark repayment as paid in PostgreSQL
    const paymentRef = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `UPDATE repayments 
       SET status = 'paid', amount_paid = amount_due, paid_at = NOW(), payment_reference = $1
       WHERE id = $2`,
      [paymentRef, repayment_id]
    );

    // Record repayment transaction on blockchain & store hash in PostgreSQL
    const blockchainTx = await recordRepaymentOnChain(client, repayment.application_id, {
      repaymentId: repayment_id,
      amount: repayment.amount_due,
      paymentReference: paymentRef,
    });

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'REPAYMENT_MADE', 'repayment', $2, $3)`,
      [
        req.user.id,
        repayment_id,
        JSON.stringify({
          payment_reference: paymentRef,
          amount: repayment.amount_due,
          transaction_hash: blockchainTx?.transaction_hash,
          contract_address: blockchainTx?.contract_address,
        }),
      ]
    );

    // Check if all repayments for this loan are paid
    const allPaid = await client.query(
      `SELECT COUNT(*) AS remaining 
       FROM repayments 
       WHERE application_id = $1 AND status != 'paid'`,
      [repayment.application_id]
    );

    let completionTx = null;
    if (parseInt(allPaid.rows[0].remaining, 10) === 0) {
      await client.query(
        `UPDATE loan_applications SET status = 'repaid', completed_at = NOW() WHERE id = $1`,
        [repayment.application_id]
      );

      // Record final loan completion on blockchain
      completionTx = await recordLoanCompletionOnChain(client, repayment.application_id);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Payment processed successfully and recorded on blockchain.',
      payment_reference: paymentRef,
      blockchain_tx: blockchainTx,
      completion_tx: completionTx,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Repayment checkout error:', err.message);
    res.status(500).json({ error: 'Payment processing failed.' });
  } finally {
    client.release();
  }
});

// GET /api/repayments/:id - Get single repayment detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, la.applicant_id, la.application_number
       FROM repayments r 
       JOIN loan_applications la ON la.id = r.application_id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repayment not found.' });
    }

    const repayment = result.rows[0];

    if (req.user.role === 'applicant' && repayment.applicant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ repayment });
  } catch (err) {
    console.error('Repayment detail error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve repayment details.' });
  }
});

export default router;
