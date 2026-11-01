import { Router } from 'express';
import { query, getClient } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, loanDecisionSchema } from '../validators/schemas.js';
import { recordLoanDecisionOnChain } from '../services/blockchain.js';
import { createNotification, notifyRole } from '../services/notifications.js';

const router = Router();

// GET /api/loans/stats - Live lender underwriting dashboard metrics
router.get('/stats', authenticate, authorize('lender'), async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(CASE WHEN admin_status = 'verified' AND status IN ('compliance_verified', 'requested', 'under_review') THEN 1 END) AS pending_underwriting,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_loans,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_loans,
        COUNT(CASE WHEN status IN ('completed', 'repaid') THEN 1 END) AS completed_loans,
        COALESCE(SUM(CASE WHEN status IN ('approved', 'repaid', 'completed') THEN requested_amount ELSE 0 END), 0) AS total_disbursed,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN requested_amount ELSE 0 END), 0) AS active_capital
      FROM loan_applications
    `);

    res.json({ stats: statsResult.rows[0] });
  } catch (err) {
    console.error('Lender stats error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve lender statistics.' });
  }
});

// GET /api/loans/requests - Loan request queue for lender
router.get('/requests', authenticate, authorize('lender'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE la.admin_status = 'verified'";
    const params = [];
    let paramIdx = 1;

    if (status) {
      whereClause += ` AND la.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (u.full_name ILIKE $${paramIdx} OR CAST(la.application_number AS TEXT) LIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM loan_applications la JOIN users u ON u.id = la.applicant_id ${whereClause}`,
      params
    );

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT la.*, u.full_name AS applicant_name, u.email AS applicant_email,
              ap.declared_credit_score, ap.monthly_income AS profile_income,
              (SELECT COUNT(*) FROM documents d WHERE d.application_id = la.id) AS doc_count,
              (SELECT COUNT(*) FROM documents d WHERE d.application_id = la.id AND d.verification_status = 'valid') AS valid_doc_count,
              bt.transaction_hash, bt.contract_address, bt.network, bt.tx_status AS blockchain_status
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = la.applicant_id
       LEFT JOIN LATERAL (
         SELECT transaction_hash, contract_address, network, tx_status
         FROM blockchain_transactions
         WHERE application_id = la.id
         ORDER BY created_at DESC
         LIMIT 1
       ) bt ON true
       ${whereClause}
       ORDER BY la.submitted_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    // Map to frontend-expected format
    const loans = result.rows.map((row) => ({
      id: row.id,
      application_number: row.application_number,
      name: row.applicant_name,
      email: row.applicant_email,
      amount: parseFloat(row.requested_amount),
      purpose: row.purpose,
      tenure_months: row.tenure_months,
      date: new Date(row.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: row.status,
      admin_status: row.admin_status,
      admin_remarks: row.admin_remarks,
      score: row.verified_credit_score || row.declared_credit_score,
      income: parseFloat(row.profile_income || row.verified_monthly_income || 0),
      docs: parseInt(row.doc_count),
      valid_docs: parseInt(row.valid_doc_count),
      lender_decision_reason: row.lender_decision_reason,
      transaction_hash: row.transaction_hash,
      contract_address: row.contract_address,
      network: row.network,
      blockchain_status: row.blockchain_status,
    }));

    res.json({
      loans,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Loan requests fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch loan requests.' });
  }
});

// GET /api/loans/completed - Completed loans for lender
router.get('/completed', authenticate, authorize('lender'), async (req, res) => {
  try {
    const result = await query(
      `SELECT la.*, u.full_name AS applicant_name
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       WHERE la.status IN ('completed', 'repaid')
       ORDER BY la.completed_at DESC NULLS LAST
       LIMIT 50`
    );

    res.json({ loans: result.rows });
  } catch (err) {
    console.error('Completed loans fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch completed loans.' });
  }
});

// GET /api/loans/:id - Get loan details (for lender/admin)
router.get('/:id', authenticate, authorize('lender', 'admin'), async (req, res) => {
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
      return res.status(404).json({ error: 'Loan application not found.' });
    }

    const docsResult = await query(
      `SELECT * FROM documents WHERE application_id = $1 ORDER BY uploaded_at`,
      [req.params.id]
    );

    const checksResult = await query(
      `SELECT * FROM verification_checks WHERE application_id = $1 ORDER BY created_at`,
      [req.params.id]
    );

    // Read blockchain transaction records from PostgreSQL
    const txResult = await query(
      `SELECT * FROM blockchain_transactions WHERE application_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      loan: result.rows[0],
      documents: docsResult.rows,
      verification_checks: checksResult.rows,
      blockchain_transactions: txResult.rows,
    });
  } catch (err) {
    console.error('Loan detail error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve loan details.' });
  }
});

// PATCH /api/loans/:id/decision - Lender approves or rejects a loan
router.patch('/:id/decision', authenticate, authorize('lender'), validate(loanDecisionSchema), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { status, reason, verified_credit_score, verified_monthly_income } = req.body;

    // Check current state
    const loanResult = await client.query(
      'SELECT * FROM loan_applications WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Loan application not found.' });
    }

    const loan = loanResult.rows[0];

    // Validate state transition
    const validTransitions = {
      requested: ['approved', 'rejected'],
      under_review: ['approved', 'rejected'],
      compliance_verified: ['approved', 'rejected'],
    };

    const allowed = validTransitions[loan.status];
    if (!allowed || !allowed.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot transition from "${loan.status}" to "${status}".`,
      });
    }

    // Update the loan
    const newStatus = status === 'approved' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE loan_applications 
       SET status = $1, lender_decision_reason = $2, assigned_lender_id = $3, 
           decided_at = NOW(), verified_credit_score = COALESCE($4, verified_credit_score),
           verified_monthly_income = COALESCE($5, verified_monthly_income)
       WHERE id = $6`,
      [newStatus, reason || null, req.user.id, verified_credit_score || null, verified_monthly_income || null, req.params.id]
    );

    // Auto-generate EMI repayment schedule on approval
    if (newStatus === 'approved') {
      const P = parseFloat(loan.requested_amount);
      const tenureMonths = parseInt(loan.tenure_months, 10) || 12;
      const annualRate = 0.10; // 10% standard annual interest
      const r = annualRate / 12;
      const emi = Math.round((P * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1));

      // Remove any prior incomplete schedule if re-approving
      await client.query('DELETE FROM repayments WHERE application_id = $1 AND status = $2', [loan.id, 'due']);

      for (let i = 1; i <= tenureMonths; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (i * 30));
        await client.query(
          `INSERT INTO repayments (application_id, due_date, amount_due, amount_paid, status)
           VALUES ($1, $2, $3, 0, 'due')`,
          [loan.id, dueDate.toISOString().split('T')[0], emi]
        );
      }
    }

    // Step 2, 3 & 4: Record lender decision on-chain & persist receipt in PostgreSQL (only for approved loans)
    let blockchainTx = null;
    if (newStatus === 'approved') {
      blockchainTx = await recordLoanDecisionOnChain(client, req.params.id, status, {
        lenderId: req.user.id,
        verified_credit_score,
        verified_monthly_income,
      });
    }

    // Create audit log
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'loan_application', $3, $4)`,
      [
        req.user.id,
        status === 'approved' ? 'LOAN_APPROVED' : 'LOAN_REJECTED',
        req.params.id,
        JSON.stringify({
          previous_status: loan.status,
          new_status: newStatus,
          reason,
          transaction_hash: blockchainTx?.transaction_hash || null,
          contract_address: blockchainTx?.contract_address || null,
        }),
      ]
    );

    await client.query('COMMIT');

    // In-app notification for applicant
    if (newStatus === 'approved') {
      createNotification(loan.applicant_id, {
        title: 'Loan Approved & Disbursed! 🎉',
        message: `Your loan of ₹${parseFloat(loan.requested_amount).toLocaleString('en-IN')} has been approved by the lender. Your EMI schedule is now active.`,
        type: 'success',
        link: '/applicant/repayments',
      }).catch(() => {});
    } else {
      createNotification(loan.applicant_id, {
        title: 'Loan Application Declined',
        message: `Your loan application was declined by the underwriter. Reason: ${reason || 'Criteria not met.'}`,
        type: 'warning',
        link: '/applicant/applications',
      }).catch(() => {});
    }

    res.json({
      message: `Loan ${status === 'approved' ? 'approved' : 'rejected'} successfully${blockchainTx ? ' and recorded on blockchain.' : '.'}`,
      new_status: newStatus,
      blockchain_tx: blockchainTx,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Loan decision error:', err.message);
    res.status(500).json({ error: 'Failed to process loan decision.' });
  } finally {
    client.release();
  }
});

// ──── Lender: Return application to admin for re-verification ────
// PATCH /api/loans/:id/return
router.patch('/:id/return', authenticate, authorize('lender'), async (req, res) => {
  const client = await getClient();
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A specific return reason is required.' });
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      'SELECT id, status, admin_status FROM loan_applications WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found.' });
    }

    const loan = checkRes.rows[0];

    // Update status to needs_correction so admin sees it for re-inspection
    await client.query(
      `UPDATE loan_applications
       SET admin_status = 'needs_correction', status = 'under_review',
           lender_return_message = $1, assigned_lender_id = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [reason.trim(), req.user.id, req.params.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'LOAN_RETURNED_TO_ADMIN', 'loan_application', $2, $3)`,
      [
        req.user.id,
        req.params.id,
        JSON.stringify({
          previous_status: loan.status,
          previous_admin_status: loan.admin_status,
          return_reason: reason.trim(),
        }),
      ]
    );

    await client.query('COMMIT');

    // Notify admins of returned application
    notifyRole('admin', {
      title: 'Application Returned by Lender',
      message: `A loan application was returned by underwriter for correction: "${reason.trim()}"`,
      type: 'action',
      link: '/admin/verification',
    }).catch(() => {});

    res.json({
      message: 'Loan application returned to admin for re-verification.',
      application_id: req.params.id,
      admin_status: 'needs_correction',
      status: 'under_review',
      lender_return_message: reason.trim(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Loan return error:', err.message);
    res.status(500).json({ error: 'Failed to return loan application.' });
  } finally {
    client.release();
  }
});

export default router;
