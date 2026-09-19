// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { generateBadge } = require('../services/badgeService');
const { generateQRCode } = require('../services/qrService');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/badges
 * 
 * Purpose:
 * Fetch badges from PostgreSQL 'badges' table strictly for the authenticated user.
 */
router.get(['/', '/api/badges'], requireAuth, async (req, res) => {
  try {
    let badges = [];
    const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';

    try {
      const query = isAdmin
        ? 'SELECT id, student_id, certificate_id, name, image_url, criteria, created_at FROM badges ORDER BY created_at DESC'
        : 'SELECT id, student_id, certificate_id, name, image_url, criteria, created_at FROM badges WHERE student_id = $1 ORDER BY created_at DESC';
      const params = isAdmin ? [] : [req.user.id];

      const result = await pool.query(query, params);
      badges = result.rows || [];
    } catch (dbErr) {
      console.warn('Notice: Error querying badges table from PostgreSQL:', dbErr.message);
    }

    const formattedBadges = badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      criteria: badge.criteria || null,
      image_url: badge.image_url || '',
      imageUrl: badge.image_url || '',
      icon: badge.image_url || '🏅',
      created_at: badge.created_at,
      earnedDate: badge.created_at
        ? new Date(badge.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null,
      certificate_id: badge.certificate_id,
      student_id: badge.student_id,
    }));

    return res.status(200).json(formattedBadges);
  } catch (err) {
    console.error('Error fetching badges:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch badges',
    });
  }
});

// GET /api/badges/create
// Helpful response when opened directly in a web browser via GET
router.get(['/create', '/api/badges/create'], (req, res) => {
  res.status(200).json({
    message: "Badge creation endpoint is ready. Send an HTTP POST request to generate a badge and QR code.",
    method: "POST",
    endpoint: "/api/badges/create",
    examplePayload: {
      studentName: "Student Name",
      courseName: "Machine Learning with Python",
      issuer: "Credential Authority",
      skills: ["Machine Learning", "Python"]
    }
  });
});

/**
 * POST /api/badges/create
 * 
 * Process:
 * 1. Authenticate and authorize request (Issuer or Admin)
 * 2. Generate badge using badgeService
 * 3. Create verification URL
 * 4. Generate QR code using qrService
 * 5. Record badge into PostgreSQL 'badges' table if profile exists
 * 6. Return response
 */
router.post(['/create', '/api/badges/create'], requireAuth, requireRole('issuer', 'admin'), async (req, res) => {
  try {
    const {
      studentName = '',
      courseName = '',
      issuer = '',
      skills = [],
    } = req.body;

    // 1. Generate badge using badgeService
    const badge = generateBadge({
      studentName,
      courseName,
      issuer,
      skills,
    });

    // 2. Create verification URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const verificationUrl = req.body.verificationUrl || `${clientUrl}/verify/${badge.credentialId}`;

    // Include verificationUrl inside metadata for reference
    badge.metadata.verificationUrl = verificationUrl;

    // 3. Generate QR code for the verification URL
    const qrCode = await generateQRCode(verificationUrl);

    // 4. Record badge into PostgreSQL 'badges' table
    try {
      let studentId = req.user?.id;
      if (studentId) {
        const profCheck = await pool.query('SELECT id FROM profiles WHERE id = $1', [studentId]);
        if (profCheck.rows.length > 0) {
          const badgeTitle = badge.badgeName || `${courseName || 'Credential'} Badge`;
          const criteriaText = Array.isArray(skills) && skills.length > 0
            ? `Demonstrated competency in ${skills.join(', ')}`
            : 'Verified Milestone Achievement';

          await pool.query(
            `INSERT INTO badges (student_id, name, image_url, criteria, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              studentId,
              badgeTitle,
              '🏅',
              criteriaText
            ]
          );
        }
      }
    } catch (dbErr) {
      console.warn('Notice: Error logging badge into PostgreSQL:', dbErr.message);
    }

    // 5. Return response
    return res.status(201).json({
      badge,
      qrCode,
    });
  } catch (error) {
    console.error('Error generating badge:', error.message);
    return res.status(500).json({
      error: error.message || 'Failed to generate badge',
    });
  }
});

module.exports = router;
