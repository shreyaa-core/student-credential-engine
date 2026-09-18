// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Routes
// ==============================================================================

const express = require('express');
const supabase = require('../config/supabase');
const { generateBadge } = require('../services/badgeService');
const { generateQRCode } = require('../services/qrService');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/badges
 * 
 * Purpose:
 * Fetch all badges from Supabase 'badges' table.
 */
router.get(['/', '/api/badges'], async (req, res) => {
  try {
    let badges = [];

    if (supabase.isConfigured) {
      const { data, error } = await supabase
        .from('badges')
        .select('id, student_id, certificate_id, name, image_url, criteria, created_at')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        badges = data;
      } else if (error) {
        console.warn('Notice: Error querying badges table from Supabase:', error.message);
      }
    }

    const formattedBadges = badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      criteria: badge.criteria || 'Verified Milestone Achievement',
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
        : 'Recent',
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
      studentName: "Rahul Das",
      courseName: "Machine Learning with Python",
      issuer: "NPTEL",
      skills: ["Machine Learning", "Python"]
    }
  });
});

/**
 * POST /api/badges/create
 * 
 * Process:
 * 1. Authenticate and authorize request (Teacher, Admin, or Student)
 * 2. Generate badge using badgeService
 * 3. Create verification URL
 * 4. Generate QR code using qrService
 * 5. Return response
 */
router.post(['/create', '/api/badges/create'], requireAuth, requireRole('teacher', 'admin', 'student'), async (req, res) => {
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

    // 4. Return response
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
