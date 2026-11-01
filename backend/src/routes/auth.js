import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { validate, loginSchema, registerSchema } from '../validators/schemas.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user (always as applicant for self-registration)
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'applicant')
       RETURNING id, full_name, email, phone, role, created_at`,
      [fullName, email.toLowerCase(), phone || null, passwordHash]
    );

    const user = result.rows[0];

    // Create empty applicant profile
    await query(
      `INSERT INTO applicant_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Generate JWT
    const token = generateToken(user);

    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'USER_REGISTERED', 'user', $1, $2)`,
      [user.id, JSON.stringify({ email: user.email, role: user.role })]
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Find user by email
    const result = await query(
      'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
    }

    // Verify password using bcrypt compare against the pgcrypto hash
    // pgcrypto uses $2a$ prefix, bcryptjs uses $2b$ - they are compatible
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    } catch {
      // If bcrypt compare fails (e.g. pgcrypto hash format), try manual comparison
      // pgcrypto's crypt() uses $2a$ which bcryptjs can handle
      isPasswordValid = false;
    }

    // If direct bcrypt fails, check pgcrypto format by querying DB
    if (!isPasswordValid) {
      const pgResult = await query(
        "SELECT (password_hash = crypt($1, password_hash)) AS valid FROM users WHERE id = $2",
        [password, user.id]
      );
      isPasswordValid = pgResult.rows.length > 0 && pgResult.rows[0].valid;
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // If a role is specified, verify the user has that role
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `This account does not have ${role} access.`,
      });
    }

    // Generate JWT
    const token = generateToken(user);

    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'USER_LOGIN', 'user', $1, $2)`,
      [user.id, JSON.stringify({ email: user.email, role: user.role })]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'USER_LOGOUT', 'user', $1, '{}')`,
      [req.user.id]
    );
  } catch {
    // Ignore audit failure on logout
  }
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, full_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    console.error('Auth/me error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

export default router;
