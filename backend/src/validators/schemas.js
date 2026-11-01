import { z } from 'zod';

// ──── Auth Schemas ────
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['applicant', 'lender', 'admin']).optional(),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(160),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().max(30).optional(),
});

// ──── Applicant Profile Schema ────
export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).max(160).optional(),
  phone: z.string().max(30).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().max(40).optional(),
  address_line1: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  monthly_income: z.number().min(0).optional(),
  declared_credit_score: z.number().int().min(300).max(900).optional(),
  existing_loan_details: z.string().max(2000).optional(),
  existing_monthly_emi: z.number().min(0).optional(),
});

// ──── Loan Application Schema ────
export const loanApplicationSchema = z.object({
  requested_amount: z.number().positive('Loan amount must be positive'),
  purpose: z.string().min(3, 'Purpose is required').max(120),
  tenure_months: z.number().int().positive('Tenure must be positive'),
});

// ──── Loan Decision Schema ────
export const loanDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
  verified_credit_score: z.number().int().min(300).max(900).optional(),
  verified_monthly_income: z.number().min(0).optional(),
});

// ──── Admin Verification Schema ────
export const adminVerificationSchema = z.object({
  admin_status: z.enum(['verified', 'rejected', 'needs_correction']),
  admin_remarks: z.string().max(2000).optional(),
});

// ──── Document Verification Schema ────
export const documentVerificationSchema = z.object({
  verification_status: z.enum(['valid', 'invalid', 'needs_review']),
  reviewer_note: z.string().max(2000).optional(),
});

// ──── Loan Policy Rules Schema ────
export const policyRulesSchema = z.object({
  min_cibil_score: z.number().int().min(300).max(900),
  min_age: z.number().int().min(18).max(99),
  max_age: z.number().int().min(19).max(100),
  min_monthly_income: z.number().min(0),
  max_existing_loans: z.number().int().min(0),
  max_dti_ratio: z.number().min(10).max(100),
  authority_memo_ref: z.string().max(255).optional(),
});

/**
 * Zod validation middleware factory
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        const messages = issues.map((e) => `${(e.path || []).join('.')}: ${e.message}`);
        return res.status(400).json({ error: 'Validation failed', details: messages });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}
