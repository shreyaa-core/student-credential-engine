// ==============================================================================
// Student Micro-Credential Verification Engine - Authentication Routes (Local JWT + PostgreSQL)
// ==============================================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { generateToken, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Normalizes role string to standard format ('Issuer', 'Admin').
 * Rejects invalid roles (returns null).
 */
function normalizeRole(roleInput) {
  const r = (roleInput || '').trim().toLowerCase();
  if (r === 'admin') {
    return 'Admin';
  }
  if (r === 'issuer') {
    return 'Issuer';
  }
  return null;
}

/**
 * Normalizes role for profiles table DB check constraint ('issuer', 'admin').
 * Defaults to 'issuer' for safe non-admin fallback.
 */
function toDbRole(role) {
  const r = (role || '').trim().toLowerCase();
  if (r === 'admin') return 'admin';
  return 'issuer';
}

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
 * Note: Verifies domain capability to receive email, does not prove individual mailbox.
 */
async function verifyEmailDomain(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      return true;
    }
  } catch (mxErr) {
    // If no MX records found, check for A record fallback per RFC 5321
    try {
      const aRecords = await dns.resolve4(domain);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        return true;
      }
    } catch (aErr) {
      return false;
    }
  }
  return false;
}

/**
 * GET /api/auth/register
 * 
 * Friendly response for web browser inspection
 */
router.get(['/register', '/api/auth/register'], (req, res) => {
  return res.status(200).json({
    message: "Registration endpoint is active. Send an HTTP POST request to create an account.",
    method: "POST",
    endpoint: "/api/auth/register",
    requiredFields: {
      name: "Full Name",
      email: "issuer@example.com",
      password: "securePassword123",
      role: "Issuer | Admin",
      institution: "Institution / Organization"
    },
    frontendApp: "http://localhost:3000/register"
  });
});

/**
 * POST /api/auth/register
 * 
 * Secure user registration:
 * 1. Validate required fields
 * 2. Normalize email to lowercase
 * 3. Validate email syntax format
 * 4. Verify domain MX / fallback A records via Node.js dns.promises
 * 5. Check duplicate email in PostgreSQL profiles table
 * 6. Validate password strength (min 8 chars, uppercase, lowercase, number, special char)
 * 7. Hash password via bcrypt
 * 8. Insert into PostgreSQL profiles table
 * 9. Issue session JWT (no email sending, no verification tokens)
 */
router.post(['/register', '/api/auth/register'], async (req, res) => {
  try {
    const { name, fullName, email, password, role, institution } = req.body;

    // 1. Validate required fields
    const chosenName = (name || fullName || '').trim();
    if (!chosenName) {
      return res.status(400).json({
        success: false,
        error: 'Full name is required.',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required.',
      });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Password is required.',
      });
    }

    // 2. Normalize email to lowercase
    const cleanEmail = email.trim().toLowerCase();

    // 3. Validate email syntax
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format. Please provide a valid email (e.g. name@domain.com).',
      });
    }

    // 4. Validate email domain via DNS MX and fallback A records
    const domain = cleanEmail.split('@')[1];
    const isDomainValid = await verifyEmailDomain(domain);
    if (!isDomainValid) {
      return res.status(400).json({
        success: false,
        error: `The email domain "${domain}" could not be resolved or does not have valid mail server records. Please enter a valid email address.`,
      });
    }

    // 5. Check duplicate email in PostgreSQL
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

    // 6. Validate password complexity
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError,
      });
    }

    // Role validation: Only 'Issuer' and 'Admin' are permitted
    const requestedRole = (role || 'Issuer').trim();
    const resolvedRole = normalizeRole(requestedRole);
    if (!resolvedRole) {
      return res.status(400).json({
        success: false,
        error: `Invalid role "${role}". Allowed roles are: Issuer, Admin.`,
      });
    }

    const dbRole = toDbRole(resolvedRole);

    // 7. Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 8. Insert new user into PostgreSQL profiles table (without removed columns)
    const userId = uuidv4();
    const insertQuery = `
      INSERT INTO profiles (id, full_name, email, password_hash, role, institution, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, full_name, email, role, institution, created_at;
    `;

    const result = await pool.query(insertQuery, [
      userId,
      chosenName,
      cleanEmail,
      passwordHash,
      dbRole,
      institution ? institution.trim() : null,
    ]);

    const newUser = result.rows[0];

    // Construct user payload - NEVER return password_hash
    const userPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.full_name,
      role: resolvedRole,
      institution: newUser.institution,
    };

    // Generate JWT session token
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

/**
 * GET /api/auth/login
 * 
 * Friendly response for web browser inspection
 */
router.get(['/login', '/api/auth/login'], (req, res) => {
  return res.status(200).json({
    message: "Login endpoint is active. Send an HTTP POST request with credentials to log in.",
    method: "POST",
    endpoint: "/api/auth/login",
    requiredFields: {
      email: "issuer@example.com",
      password: "yourPassword"
    },
    frontendApp: "http://localhost:3000/login"
  });
});

/**
 * POST /api/auth/login
 * 
 * Native email/password login:
 * 1. Finds user in PostgreSQL 'profiles' table by email
 * 2. Verifies password against bcrypt hash
 * 3. Issues signed JWT session token
 */
router.post(['/login', '/api/auth/login'], async (req, res) => {
  try {
    const { email, password, role } = req.body;

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

    // 1. Fetch user from PostgreSQL profiles table
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

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        message: 'Invalid email or password.',
      });
    }

    // 3. Read the authoritative role strictly from the PostgreSQL database record
    const dbRoleRaw = (userRow.role || 'issuer').trim().toLowerCase();
    const authoritativeRole = dbRoleRaw === 'admin' ? 'Admin' : 'Issuer';

    // 4. Role mismatch validation:
    // The role selected on the login page MUST NEVER elevate or change the user's actual role.
    if (role) {
      const selectedRole = normalizeRole(role);
      if (!selectedRole || selectedRole !== authoritativeRole) {
        return res.status(403).json({
          success: false,
          message: 'Selected role does not match the role assigned to this account.',
          error: 'Selected role does not match the role assigned to this account.',
        });
      }
    }

    // 5. Construct user payload strictly using authoritative database role
    const userPayload = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.full_name,
      role: authoritativeRole,
      institution: userRow.institution || null,
    };

    // 6. Generate cryptographically signed JWT using ONLY the database role
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

/**
 * POST /api/auth/logout
 * 
 * Stateless JWT logout endpoint.
 */
router.post('/logout', async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

/**
 * GET /api/auth/me
 * 
 * Returns currently authenticated user session from JWT.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
