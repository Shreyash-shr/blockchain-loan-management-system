import { Router } from 'express';
import { query, getClient } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, adminVerificationSchema, documentVerificationSchema, policyRulesSchema } from '../validators/schemas.js';
import { createNotification, notifyRole } from '../services/notifications.js';

const router = Router();

// ──── Dashboard Statistics ────
// GET /api/admin/dashboard
router.get('/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [users, applications, statusCounts, recentActivity, dailyStats] = await Promise.all([
      query(`
        SELECT role, COUNT(*) AS count FROM users GROUP BY role
      `),
      query(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS requested,
               SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS under_review,
               SUM(CASE WHEN admin_status = 'pending' THEN 1 ELSE 0 END) AS pending_verification,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
               SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing,
               SUM(CASE WHEN status IN ('repaid', 'completed') THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN status = 'compliance_verified' THEN 1 ELSE 0 END) AS compliance_verified,
               SUM(requested_amount) AS total_requested_amount
        FROM loan_applications
      `),
      query(`
        SELECT status, COUNT(*) AS count FROM loan_applications GROUP BY status
      `),
      query(`
        SELECT al.*, u.full_name AS actor_name
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.actor_user_id
        ORDER BY al.created_at DESC LIMIT 10
      `),
      query(`
        SELECT DATE(submitted_at) AS date,
               COUNT(*) AS total,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
        FROM loan_applications
        WHERE submitted_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(submitted_at)
        ORDER BY date
      `),
    ]);

    const roleCounts = {};
    users.rows.forEach((r) => { roleCounts[r.role] = parseInt(r.count); });

    res.json({
      users: roleCounts,
      applications: applications.rows[0],
      status_distribution: statusCounts.rows,
      recent_activity: recentActivity.rows,
      daily_stats: dailyStats.rows,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

// ──── Admin Verification: List applications pending admin review ────
// GET /api/admin/verification
router.get('/verification', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { admin_status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE la.admin_status IN ('pending', 'needs_correction')";
    const params = [];
    let pIdx = 1;

    if (admin_status && admin_status !== 'ALL' && admin_status !== 'all') {
      whereClause = `WHERE la.admin_status = $${pIdx}`;
      params.push(admin_status);
      pIdx++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM loan_applications la ${whereClause}`,
      params
    );

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT la.*, u.full_name AS applicant_name, u.email AS applicant_email,
              ap.date_of_birth, ap.monthly_income, ap.declared_credit_score, ap.existing_loan_details,
              ap.existing_monthly_emi, ap.gender, ap.city, ap.state,
              (SELECT COUNT(*) FROM documents d WHERE d.application_id = la.id) AS doc_count,
              (SELECT COUNT(*) FROM documents d WHERE d.application_id = la.id AND d.verification_status = 'valid') AS valid_doc_count
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = la.applicant_id
       ${whereClause}
       ORDER BY la.submitted_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      params
    );

    const activePolicyRes = await query(
      `SELECT * FROM loan_policy_rules WHERE is_active = TRUE ORDER BY id DESC LIMIT 1`
    );

    res.json({
      applications: result.rows,
      policy: activePolicyRes.rows[0] || null,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin verification list error:', err.message);
    res.status(500).json({ error: 'Failed to load verification queue.' });
  }
});

// ──── Admin Verification: Get single application with full details ────
// GET /api/admin/verification/:id
router.get('/verification/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const appResult = await query(
      `SELECT la.*, u.full_name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone,
              ap.date_of_birth, ap.gender, ap.address_line1, ap.city, ap.state, ap.pincode,
              ap.monthly_income, ap.declared_credit_score, ap.existing_loan_details, ap.existing_monthly_emi
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = la.applicant_id
       WHERE la.id = $1`,
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const docsResult = await query(
      'SELECT * FROM documents WHERE application_id = $1 ORDER BY uploaded_at',
      [req.params.id]
    );

    const checksResult = await query(
      'SELECT * FROM verification_checks WHERE application_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    // Get active policy rules for comparison
    const policyResult = await query(
      'SELECT * FROM loan_policy_rules WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
    );

    // Read blockchain audit trail for this application
    const txResult = await query(
      `SELECT * FROM blockchain_transactions WHERE application_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      application: appResult.rows[0],
      documents: docsResult.rows,
      verification_checks: checksResult.rows,
      policy_rules: policyResult.rows[0] || null,
      blockchain_transactions: txResult.rows,
    });
  } catch (err) {
    console.error('Admin verification detail error:', err.message);
    res.status(500).json({ error: 'Failed to load application details.' });
  }
});

// ──── Admin: Verify/Reject a document ────
// PATCH /api/admin/documents/:id/verify
router.patch('/documents/:id/verify', authenticate, authorize('admin'), validate(documentVerificationSchema), async (req, res) => {
  try {
    const { verification_status, reviewer_note } = req.body;

    const result = await query(
      `UPDATE documents 
       SET verification_status = $1, reviewer_note = $2, reviewer_id = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [verification_status, reviewer_note || null, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Audit
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'DOCUMENT_VERIFIED', 'document', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ verification_status, reviewer_note })]
    );

    res.json({ message: 'Document verification updated.', document: result.rows[0] });
  } catch (err) {
    console.error('Document verification error:', err.message);
    res.status(500).json({ error: 'Failed to update document verification.' });
  }
});

// ──── Admin: Verify/Reject an application (compliance check) ────
// PATCH /api/admin/verification/:id
router.patch('/verification/:id', authenticate, authorize('admin'), validate(adminVerificationSchema), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { admin_status, admin_remarks } = req.body;

    // Check current state
    const current = await client.query(
      'SELECT * FROM loan_applications WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found.' });
    }

    const app = current.rows[0];
    if (app.admin_status !== 'pending' && app.admin_status !== 'needs_correction') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Application already has admin status "${app.admin_status}". Cannot change.`,
      });
    }

    // Update admin verification status
    let newLoanStatus = app.status;
    if (admin_status === 'verified') {
      newLoanStatus = 'compliance_verified';
    } else if (admin_status === 'rejected') {
      newLoanStatus = 'compliance_rejected';
    } else if (admin_status === 'needs_correction') {
      newLoanStatus = 'under_review';
    }

    const clearReturnMsg = admin_status === 'verified';

    await client.query(
      `UPDATE loan_applications 
       SET admin_status = $1::admin_verification_status,
           admin_remarks = $2,
           admin_verifier_id = $3,
           admin_verified_at = NOW(),
           status = $4,
           lender_return_message = CASE WHEN $5::boolean THEN NULL ELSE lender_return_message END
       WHERE id = $6`,
      [admin_status, admin_remarks || null, req.user.id, newLoanStatus, clearReturnMsg, req.params.id]
    );

    // Update verification checks
    if (admin_status === 'verified') {
      await client.query(
        `UPDATE verification_checks SET status = 'valid', checked_by = $1, checked_at = NOW()
         WHERE application_id = $2 AND status = 'pending'`,
        [req.user.id, req.params.id]
      );
    }

    // Audit
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'loan_application', $3, $4)`,
      [
        req.user.id,
        admin_status === 'verified' ? 'ADMIN_COMPLIANCE_VERIFIED' : admin_status === 'rejected' ? 'ADMIN_COMPLIANCE_REJECTED' : 'ADMIN_RETURNED_FOR_CORRECTION',
        req.params.id,
        JSON.stringify({ admin_status, admin_remarks, previous_status: app.status }),
      ]
    );

    await client.query('COMMIT');

    // Notify applicant & lenders
    if (admin_status === 'verified') {
      await createNotification(app.applicant_id, {
        title: 'Compliance Verified',
        message: 'Your loan application documents and eligibility criteria have been verified and forwarded to lenders for underwriting.',
        type: 'success',
        link: '/applicant/applications',
      });

      await notifyRole('lender', {
        title: 'Verified Loan for Review',
        message: `A loan application for ₹${parseFloat(app.requested_amount).toLocaleString('en-IN')} has been verified and is ready for underwriting.`,
        type: 'action',
        link: '/lender/requests',
      });
    } else if (admin_status === 'rejected') {
      await createNotification(app.applicant_id, {
        title: 'Verification Rejected',
        message: `Your loan application could not be certified. Reason: ${admin_remarks || 'Document or eligibility criteria not met.'}`,
        type: 'warning',
        link: '/applicant/applications',
      });
    } else if (admin_status === 'needs_correction') {
      await createNotification(app.applicant_id, {
        title: 'Application Returned for Correction',
        message: `Admin returned your application for corrections. Reason: ${admin_remarks || 'Please update your documents or details.'}`,
        type: 'warning',
        link: '/applicant/applications',
      });
    }

    res.json({
      message: `Application ${admin_status === 'verified' ? 'verified' : 'rejected'} successfully.`,
      admin_status,
      new_loan_status: newLoanStatus,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin verification error:', err.message);
    res.status(500).json({ error: 'Failed to process verification.' });
  } finally {
    client.release();
  }
});

// ──── Loan Policy Rules ────
// GET /api/admin/policy-rules
router.get('/policy-rules', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT lpr.*, u.full_name AS updated_by_name
       FROM loan_policy_rules lpr
       LEFT JOIN users u ON u.id = lpr.updated_by
       WHERE lpr.is_active = TRUE
       ORDER BY lpr.id DESC LIMIT 1`
    );

    res.json({ rules: result.rows[0] || null });
  } catch (err) {
    console.error('Policy rules fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load policy rules.' });
  }
});

// PUT & PATCH /api/admin/policy-rules
const updatePolicyRulesHandler = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      min_cibil_score, min_age, max_age, min_monthly_income,
      max_existing_loans, max_dti_ratio, authority_memo_ref,
    } = req.body;

    // Deactivate existing active rules
    await client.query('UPDATE loan_policy_rules SET is_active = FALSE WHERE is_active = TRUE');

    // Create new rule set
    const result = await client.query(
      `INSERT INTO loan_policy_rules 
       (min_cibil_score, min_age, max_age, min_monthly_income, max_existing_loans, 
        max_dti_ratio, is_active, authority_memo_ref, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
       RETURNING *`,
      [min_cibil_score, min_age, max_age, min_monthly_income, max_existing_loans, max_dti_ratio, authority_memo_ref || null, req.user.id]
    );

    // Audit
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'POLICY_RULES_UPDATED', 'loan_policy_rules', NULL, $2)`,
      [req.user.id, JSON.stringify({ ...req.body, rule_id: result.rows[0].id })]
    );

    await client.query('COMMIT');

    res.json({ message: 'Policy rules updated successfully.', rules: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Policy rules update error:', err.message);
    res.status(500).json({ error: 'Failed to update policy rules.' });
  } finally {
    client.release();
  }
};

router.put('/policy-rules', authenticate, authorize('admin'), validate(policyRulesSchema), updatePolicyRulesHandler);
router.patch('/policy-rules', authenticate, authorize('admin'), validate(policyRulesSchema), updatePolicyRulesHandler);

// ──── All Loans (Admin Monitoring) ────
// GET /api/admin/loans
router.get('/loans', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE 1=1';
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
              l.full_name AS lender_name,
              bt.transaction_hash, bt.contract_address, bt.network, bt.tx_status AS blockchain_status
       FROM loan_applications la
       JOIN users u ON u.id = la.applicant_id
       LEFT JOIN users l ON l.id = la.assigned_lender_id
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

    res.json({
      loans: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin loans error:', err.message);
    res.status(500).json({ error: 'Failed to load loans.' });
  }
});

// ──── Audit Logs ────
// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT al.*, u.full_name AS actor_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    console.error('Audit logs error:', err.message);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

// ──── User Management ────
// GET /api/admin/users
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (role) {
      whereClause += ` AND u.role = $${paramIdx}`;
      params.push(role);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (u.full_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await query(`SELECT COUNT(*) FROM users u ${whereClause}`, params);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM loan_applications la WHERE la.applicant_id = u.id) AS application_count
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// PATCH /api/admin/users/:id/status - Activate/deactivate a user
router.patch('/users/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean.' });
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === req.user.id && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account.' });
    }

    const result = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, full_name, email, role, is_active',
      [is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Audit
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'user', $3, $4)`,
      [
        req.user.id,
        is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        req.params.id,
        JSON.stringify({ target_user: result.rows[0].email }),
      ]
    );

    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'}.`, user: result.rows[0] });
  } catch (err) {
    console.error('User status update error:', err.message);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// ──── Reports ────
// GET /api/admin/reports
router.get('/reports', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type = 'summary', start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date) {
      params.push(start_date);
      dateFilter += ` AND la.submitted_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      dateFilter += ` AND la.submitted_at <= $${params.length}`;
    }

    if (type === 'summary') {
      const result = await query(
        `SELECT 
           COUNT(*) AS total_applications,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
           SUM(CASE WHEN status IN ('requested','under_review','compliance_verified') THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'approved' THEN requested_amount ELSE 0 END) AS total_approved_amount,
           SUM(requested_amount) AS total_requested_amount,
           AVG(CASE WHEN status = 'approved' THEN requested_amount END) AS avg_approved_amount,
           COUNT(DISTINCT applicant_id) AS unique_applicants
         FROM loan_applications la
         WHERE 1=1 ${dateFilter}`,
        params
      );

      res.json({ report: result.rows[0] });
    } else if (type === 'monthly') {
      const result = await query(
        `SELECT 
           TO_CHAR(submitted_at, 'YYYY-MM') AS month,
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
           SUM(requested_amount) AS total_amount
         FROM loan_applications la
         WHERE 1=1 ${dateFilter}
         GROUP BY TO_CHAR(submitted_at, 'YYYY-MM')
         ORDER BY month DESC
         LIMIT 12`,
        params
      );

      res.json({ report: result.rows });
    } else {
      res.status(400).json({ error: 'Invalid report type. Use "summary" or "monthly".' });
    }
  } catch (err) {
    console.error('Admin reports error:', err.message);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

export default router;
