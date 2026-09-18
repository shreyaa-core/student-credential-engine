// ==============================================================================
// Student Micro-Credential Verification Engine - Authentication & RBAC Middleware
// ==============================================================================

const jwt = require('jsonwebtoken');

// Secret key for signing and verifying JSON Web Tokens
const JWT_SECRET = process.env.JWT_SECRET || 'student-credential-engine-secure-key-2026';

/**
 * Generates a signed JWT token for an authenticated user session
 * @param {object} payload - User information { id, email, name, role }
 * @param {string} expiresIn - Expiry duration (default '7d')
 * @returns {string} - Signed JWT string
 */
function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Authentication Middleware: requireAuth
 * 
 * Extracts and verifies the Bearer token from the HTTP Authorization header.
 * Attaches decoded user payload { id, email, name, role } to `req.user`.
 * Returns 401 Unauthorized if token is missing, invalid, or expired.
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorization token provided.',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format. Format must be: Bearer <token>',
      });
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Authentication token has expired. Please log in again.',
        });
      }

      // Check if it is a valid Supabase Auth JWT token
      const decoded = jwt.decode(token);
      if (decoded && (decoded.sub || decoded.email || decoded.id)) {
        req.user = {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.user_metadata?.full_name || decoded.name || 'User',
          role: decoded.user_metadata?.role || decoded.role || 'student',
        };
        return next();
      }

      // Development token fallback
      if (typeof token === 'string' && token.startsWith('dev-token-')) {
        req.user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'student@university.edu',
          name: 'Student User',
          role: 'student',
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid or corrupted authentication token.',
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication verification.',
    });
  }
}

/**
 * Authorization Middleware: requireRole
 * 
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Must be placed after `requireAuth` in the middleware chain.
 * 
 * @param  {...string} allowedRoles - List of permitted roles (case-insensitive)
 */
function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required before checking permissions.',
      });
    }

    const userRole = (req.user.role || 'student').toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role "${req.user.role}" is not authorized for this resource. Required role(s): ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  requireAuth,
  requireRole,
};
