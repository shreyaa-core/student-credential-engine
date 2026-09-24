// ==============================================================================
// Student Micro-Credential Verification Engine - Authentication Routes
// ==============================================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { generateToken, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Canonical admin email ──────────────────────────────────────────────────────
// This is the ONE pre-seeded admin account. It cannot be created through public
// signup and its email is reserved — no other user may register with this address.
const CANONICAL_ADMIN_EMAIL = 'admin@test.in';

const dns = require('dns').promises;

/**
 * Validates password complexity:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least 1 uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least 1 lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least 1 number.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least 1 special character (!@#$%^&*...).';
  }
  return null;
}

/**
 * Verifies that the email domain has valid MX or fallback A DNS records.
 */
async function verifyEmailDomain(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) return true;
  } catch {
    try {
      const aRecords = await dns.resolve4(domain);
      if (Array.isArray(aRecords) && aRecords.length > 0) return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ==============================================================================
// GET /api/auth/register — browser-friendly info
// ==============================================================================
router.get(['/register', '/api/auth/register'], (req, res) => {
  return res.status(200).json({
    message: 'Registration endpoint is active. Send an HTTP POST request to create an account.',
    method: 'POST',
    endpoint: '/api/auth/register',
    requiredFields: { name: 'Full Name', email: 'you@example.com', password: 'SecurePass@1' },
    note: 'Only Issuer accounts are created through public signup. Admin access is pre-configured.',
  });
});

// ==============================================================================
// POST /api/auth/register
//
// Creates a new Issuer account. Rules enforced at the backend:
//  1. admin@test.in is a reserved email — cannot be registered here.
//  2. Any role=admin in the request body is rejected (403).
//  3. All successful registrations are locked to role=issuer regardless of
//     what the client sends.
// ==============================================================================
router.post(['/register', '/api/auth/register'], async (req, res) => {
  try {
    const { name, fullName, email, password, role, institution } = req.body;

    // 1. Required fields
    const chosenName = (name || fullName || '').trim();
    if (!chosenName) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    // 2. Normalize email
    const cleanEmail = email.trim().toLowerCase();

    // 3. Validate email syntax
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format. Please provide a valid email (e.g. name@domain.com).',
      });
    }

    // 4. Block the reserved admin email from being registered
    if (cleanEmail === CANONICAL_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: 'This email address is reserved and cannot be used for registration.',
      });
    }

    // 5. Block any attempt to request role=admin (case-insensitive)
    if ((role || '').trim().toLowerCase() === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts cannot be created through public registration.',
      });
    }

    // 6. Validate email domain via DNS
    const domain = cleanEmail.split('@')[1];
    const isDomainValid = await verifyEmailDomain(domain);
    if (!isDomainValid) {
      return res.status(400).json({
        success: false,
        error: `The email domain "${domain}" could not be resolved. Please enter a valid email address.`,
      });
    }

    // 7. Check duplicate email
    const existing = await pool.query(
      'SELECT id FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [cleanEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists. Please log in instead.',
      });
    }

    // 8. Validate password complexity
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    // 9. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 10. Insert — all public registrations are Issuer, regardless of any role field sent
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO profiles (id, full_name, email, password_hash, role, institution, created_at)
       VALUES ($1, $2, $3, $4, 'issuer', $5, NOW())
       RETURNING id, full_name, email, role, institution`,
      [userId, chosenName, cleanEmail, passwordHash, institution ? institution.trim() : null]
    );

    const newUser = result.rows[0];
    const userPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.full_name,
      role: 'Issuer',
      institution: newUser.institution,
    };

    const token = generateToken(userPayload, '7d');

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: userPayload,
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred during registration.',
    });
  }
});

// ==============================================================================
// GET /api/auth/login — browser-friendly info
// ==============================================================================
router.get(['/login', '/api/auth/login'], (req, res) => {
  return res.status(200).json({
    message: 'Login endpoint is active. Send an HTTP POST request with credentials to log in.',
    method: 'POST',
    endpoint: '/api/auth/login',
    requiredFields: { email: 'you@example.com', password: 'yourPassword' },
    note: 'Role is automatically determined from the database. No role field is required.',
  });
});

// ==============================================================================
// POST /api/auth/login
//
// Simplified login — no role parameter required or accepted.
// Role is read exclusively from PostgreSQL.
//   admin@test.in → role = 'Admin'
//   any other account → role = 'Issuer'
// ==============================================================================
router.post(['/login', '/api/auth/login'], async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required.',
        message: 'Email address is required.',
      });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Password is required.',
        message: 'Password is required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Fetch user from PostgreSQL
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash, role, institution FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        message: 'Invalid email or password.',
      });
    }

    const userRow = result.rows[0];

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        message: 'Invalid email or password.',
      });
    }

    // 3. Derive authoritative role from database only — client cannot influence this
    const dbRoleRaw = (userRow.role || 'issuer').trim().toLowerCase();
    const authoritativeRole = dbRoleRaw === 'admin' ? 'Admin' : 'Issuer';

    // 4. Build payload (never return password_hash)
    const userPayload = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.full_name,
      role: authoritativeRole,
      institution: userRow.institution || null,
    };

    // 5. Sign JWT
    const token = generateToken(userPayload, '7d');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userPayload,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred during login.',
      message: err.message || 'An unexpected error occurred during login.',
    });
  }
});

// ==============================================================================
// POST /api/auth/logout — stateless JWT logout
// ==============================================================================
router.post('/logout', (req, res) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// ==============================================================================
// GET /api/auth/me — returns authenticated user from JWT
// ==============================================================================
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
});

module.exports = router;
