// ==============================================================================
// Student Micro-Credential Verification Engine - Dashboard Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/dashboard
 * 
 * Purpose:
 * Fetch real-time aggregated dashboard metrics and summary strictly for the authenticated user:
 * - certificates (total, verified, pending for req.user.id)
 * - skills (skills earned through certificates belonging to req.user.id)
 * - badges (badges earned by req.user.id)
 */
router.get(['/', '/api/dashboard'], requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;

    let totalCertificates = 0;
    let verifiedCertificates = 0;
    let pendingCertificates = 0;
    let skillsEarned = 0;
    let badgesEarned = 0;
    let recentCertificates = [];
    let latestBadges = [];

    try {
      // 1. Fetch user-specific certificates from PostgreSQL
      const certResult = await pool.query(
        `SELECT id, certificate_name, issuer, status, verification_score, created_at 
         FROM certificates 
         WHERE student_id = $1 
         ORDER BY created_at DESC;`,
        [studentId]
      );
      const certs = certResult.rows || [];

      totalCertificates = certs.length;
      verifiedCertificates = certs.filter((c) =>
        ['APPROVED', 'VERIFIED', 'Verified', 'Approved', 'valid'].includes(c.status)
      ).length;
      pendingCertificates = certs.filter((c) =>
        ['PENDING', 'Pending', 'Pending Review', 'pending'].includes(c.status)
      ).length;

      recentCertificates = certs.slice(0, 4).map((c) => ({
        id: c.id,
        title: c.certificate_name || 'Certificate',
        issuer: c.issuer || null,
        issueDate: c.created_at
          ? new Date(c.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null,
        status: c.status || 'PENDING',
        verificationScore: c.verification_score || 0,
      }));

      // 2. Fetch skills count earned strictly through this user's certificates
      const skillsResult = await pool.query(
        `SELECT COUNT(DISTINCT cs.skill_id)::int AS count
         FROM certificates c
         JOIN certificate_skills cs ON c.id = cs.certificate_id
         WHERE c.student_id = $1;`,
        [studentId]
      );
      if (skillsResult.rows && skillsResult.rows.length > 0) {
        skillsEarned = skillsResult.rows[0].count || 0;
      }

      // 3. Fetch badges earned strictly by this user
      const badgesResult = await pool.query(
        `SELECT id, name, criteria, image_url, created_at 
         FROM badges 
         WHERE student_id = $1 
         ORDER BY created_at DESC;`,
        [studentId]
      );
      const badgeList = badgesResult.rows || [];

      badgesEarned = badgeList.length;
      latestBadges = badgeList.slice(0, 4).map((b) => ({
        id: b.id,
        name: b.name || 'Micro-Credential Badge',
        criteria: b.criteria || null,
        imageUrl: b.image_url || '',
        earnedDate: b.created_at
          ? new Date(b.created_at).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          : null,
      }));
    } catch (dbQueryErr) {
      console.warn('Notice: Error executing PostgreSQL query for user dashboard metrics:', dbQueryErr.message);
    }

    return res.status(200).json({
      success: true,
      totalCertificates,
      total_certificates: totalCertificates,
      verifiedCertificates,
      verified_certificates: verifiedCertificates,
      pendingCertificates,
      pending_certificates: pendingCertificates,
      skillsEarned,
      skills_earned: skillsEarned,
      badgesEarned,
      badges_earned: badgesEarned,
      recentCertificates,
      latestBadges,
    });
  } catch (err) {
    console.error('Error fetching user dashboard statistics:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch dashboard data',
    });
  }
});

module.exports = router;
