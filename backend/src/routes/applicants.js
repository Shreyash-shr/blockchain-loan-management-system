import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, profileUpdateSchema } from '../validators/schemas.js';

const router = Router();

// GET /api/applicants/me - Get the authenticated applicant's profile
router.get('/me', authenticate, authorize('applicant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.created_at,
              ap.date_of_birth, ap.gender, ap.address_line1, ap.city, ap.state, ap.pincode,
              ap.monthly_income, ap.declared_credit_score, ap.existing_loan_details,
              ap.existing_monthly_emi, ap.profile_completed
       FROM users u
       LEFT JOIN applicant_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Applicant profile not found.' });
    }

    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Applicant profile fetch error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// PATCH /api/applicants/me - Update applicant profile
router.patch('/me', authenticate, authorize('applicant'), validate(profileUpdateSchema), async (req, res) => {
  try {
    const data = req.body;

    // Ensure the applicant profile exists
    await query(
      `INSERT INTO applicant_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    // Update user personal details (full_name, phone) on users table if present
    if (data.full_name || data.phone !== undefined) {
      const uFields = [];
      const uValues = [];
      let uIdx = 1;

      if (data.full_name) {
        uFields.push(`full_name = $${uIdx++}`);
        uValues.push(data.full_name);
      }
      if (data.phone !== undefined) {
        uFields.push(`phone = $${uIdx++}`);
        uValues.push(data.phone);
      }

      if (uFields.length > 0) {
        uValues.push(req.user.id);
        await query(
          `UPDATE users SET ${uFields.join(', ')}, updated_at = NOW() WHERE id = $${uIdx}`,
          uValues
        );
      }
    }

    // Profile table allowed columns
    const profileColumns = [
      'date_of_birth',
      'gender',
      'address_line1',
      'city',
      'state',
      'pincode',
      'monthly_income',
      'declared_credit_score',
      'existing_loan_details',
      'existing_monthly_emi',
    ];

    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of profileColumns) {
      if (data[key] !== undefined && data[key] !== null) {
        fields.push(`${key} = $${idx}`);
        values.push(data[key]);
        idx++;
      }
    }

    // Check if profile is now "complete"
    const completionCheck = ['date_of_birth', 'gender', 'monthly_income'];
    const existingProfile = await query(
      'SELECT * FROM applicant_profiles WHERE user_id = $1',
      [req.user.id]
    );
    const merged = { ...existingProfile.rows[0], ...data };
    const isComplete = completionCheck.every((f) => merged[f] !== null && merged[f] !== undefined);
    fields.push(`profile_completed = $${idx}`);
    values.push(isComplete);
    idx++;

    values.push(req.user.id);

    await query(
      `UPDATE applicant_profiles SET ${fields.join(', ')} WHERE user_id = $${idx}`,
      values
    );

    // Audit
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'PROFILE_UPDATED', 'applicant_profile', $1, $2)`,
      [req.user.id, JSON.stringify({ updated_fields: Object.keys(data) })]
    );

    res.json({ message: 'Profile updated successfully', profile_completed: isComplete });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
