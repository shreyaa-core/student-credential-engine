// ==============================================================================
// Student Micro-Credential Verification Engine - Authentication Routes (Supabase Auth)
// ==============================================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateToken, requireAuth } = require('../middleware/authMiddleware');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * Normalizes role string to standard format (Student, Teacher, Admin)
 */
function normalizeRole(roleInput, email = '') {
  const r = (roleInput || '').trim().toLowerCase();
  const em = (email || '').toLowerCase();

  if (r === 'admin' || em.includes('admin')) {
    return 'Admin';
  }
  if (r === 'teacher' || r === 'issuer' || r === 'faculty' || em.includes('teacher') || em.includes('faculty')) {
    return 'Teacher';
  }
  return 'Student';
}

/**
 * Normalizes role for profiles table DB check constraint ('student', 'issuer', 'verifier', 'admin')
 */
function toDbRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'teacher' || r === 'issuer' || r === 'faculty') return 'issuer';
  if (r === 'verifier') return 'verifier';
  return 'student';
}

/**
 * POST /api/auth/register
 * 
 * Email/password signup using Supabase Auth (supabase.auth.signUp).
 * Creates profile row in profiles table.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, fullName, email, password, role, institution } = req.body;

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

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const resolvedRole = normalizeRole(role, cleanEmail);
    const dbRole = toDbRole(resolvedRole);

    let authUser = null;
    let sessionToken = null;

    if (supabase.isConfigured) {
      // 1. Supabase Auth: Sign Up with email & password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: chosenName,
            role: resolvedRole,
          },
        },
      });

      if (authError) {
        return res.status(400).json({
          success: false,
          error: authError.message,
        });
      }

      authUser = authData?.user;
      sessionToken = authData?.session?.access_token;

      // 2. Create profile row in profiles table
      if (authUser) {
        try {
          await supabase.from('profiles').upsert(
            {
              id: authUser.id,
              full_name: chosenName,
              email: cleanEmail,
              role: dbRole,
              institution: institution || 'National Institute of Technology',
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );
        } catch (dbErr) {
          console.warn('Notice: Error upserting profile in database on registration:', dbErr.message);
        }
      }
    }

    // Fallback if running in offline development mode
    if (!authUser) {
      authUser = {
        id: uuidv4(),
        email: cleanEmail,
      };
    }

    const userPayload = {
      id: authUser.id,
      email: cleanEmail,
      name: chosenName,
      role: resolvedRole,
    };

    const token = sessionToken || generateToken(userPayload, '7d');

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully via Supabase Auth',
      token,
      user: userPayload,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred during registration.',
    });
  }
});

/**
 * POST /api/auth/login
 * 
 * Email/password login using Supabase Auth (supabase.auth.signInWithPassword).
 * After login: Create profile row in profiles table.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

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

    const cleanEmail = email.trim().toLowerCase();
    const resolvedRole = normalizeRole(role, cleanEmail);
    const dbRole = toDbRole(resolvedRole);
    const displayName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    let authUser = null;
    let sessionToken = null;

    if (supabase.isConfigured) {
      // 1. Supabase Auth: Sign In with email & password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authError) {
        return res.status(401).json({
          success: false,
          error: authError.message || 'Invalid login credentials.',
        });
      }

      authUser = authData?.user;
      sessionToken = authData?.session?.access_token;

      // 2. After login: Create profile row in profiles table
      if (authUser) {
        try {
          const profileFullName = authUser.user_metadata?.full_name || displayName;
          await supabase.from('profiles').upsert(
            {
              id: authUser.id,
              full_name: profileFullName,
              email: cleanEmail,
              role: dbRole,
              institution: 'National Institute of Technology',
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );
        } catch (dbErr) {
          console.warn('Notice: Error upserting profile in database on login:', dbErr.message);
        }
      }
    }

    // Fallback if running in offline development mode
    if (!authUser) {
      authUser = {
        id: uuidv4(),
        email: cleanEmail,
      };
    }

    const userPayload = {
      id: authUser.id,
      email: cleanEmail,
      name: authUser.user_metadata?.full_name || displayName,
      role: resolvedRole,
    };

    const token = sessionToken || generateToken(userPayload, '7d');

    return res.status(200).json({
      success: true,
      message: 'Login successful via Supabase Auth',
      token,
      user: userPayload,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred during login.',
    });
  }
});

/**
 * POST /api/auth/logout
 * 
 * Supabase Auth Logout (supabase.auth.signOut).
 */
router.post('/logout', async (req, res) => {
  try {
    if (supabase.isConfigured) {
      await supabase.auth.signOut();
    }
    return res.status(200).json({
      success: true,
      message: 'Supabase session logged out successfully',
    });
  } catch (err) {
    console.warn('Logout notice:', err.message);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

/**
 * GET /api/auth/me
 * 
 * Returns currently authenticated user session.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
