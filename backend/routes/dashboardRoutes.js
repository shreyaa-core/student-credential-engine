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

      // 2. Fetch skills count earned strictly through this user's certificates and activity logs
      const skillsResult = await pool.query(
        `SELECT COUNT(DISTINCT skill_id)::int AS count
         FROM (
           SELECT cs.skill_id
           FROM certificates c
           JOIN certificate_skills cs ON c.id = cs.certificate_id
           WHERE c.student_id = $1
           UNION
           SELECT ask.skill_id
           FROM activity_logs a
           JOIN activity_skills ask ON a.id = ask.activity_id
           WHERE a.student_id = $1
         ) user_skills;`,
        [studentId]
      );
      if (skillsResult.rows && skillsResult.rows.length > 0) {
        skillsEarned = skillsResult.rows[0].count || 0;
      }

      // Fetch activities count for this user
      let totalActivities = 0;
      const actCountRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM activity_logs WHERE student_id = $1;`,
        [studentId]
      );
      if (actCountRes.rows && actCountRes.rows.length > 0) {
        totalActivities = actCountRes.rows[0].count || 0;
      }

      // 3. Fetch badges earned strictly by this user
      const badgesResult = await pool.query(
        `SELECT id, student_id, certificate_id, name, criteria, image_url, created_at 
         FROM badges 
         WHERE student_id = $1 
         ORDER BY created_at DESC;`,
        [studentId]
      );
      const explicitBadges = (badgesResult.rows || []).map((b) => ({
        id: b.id,
        certificate_id: b.certificate_id,
        name: b.name || 'Micro-Credential Badge',
        criteria: b.criteria || null,
        imageUrl: b.image_url || '',
        icon: b.image_url || '🏅',
        earnedDate: b.created_at
          ? new Date(b.created_at).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          : null,
      }));

      // Synchronize digital badges dynamically for any verified certificates
      const existingCertBadgeIds = new Set(explicitBadges.map((b) => b.certificate_id).filter(Boolean));
      const verifiedCerts = certs.filter((c) =>
        ['APPROVED', 'VERIFIED', 'Verified', 'Approved', 'valid'].includes(c.status)
      );

      if (verifiedCerts.length > 0) {
        const certIds = verifiedCerts.map((c) => c.id);
        const certSkillsRes = await pool.query(
          `SELECT cs.certificate_id, s.name AS skill_name
           FROM certificate_skills cs
           JOIN skills s ON cs.skill_id = s.id
           WHERE cs.certificate_id = ANY($1::uuid[])`,
          [certIds]
        );
        const skillsByCert = {};
        for (const row of certSkillsRes.rows || []) {
          if (!skillsByCert[row.certificate_id]) {
            skillsByCert[row.certificate_id] = [];
          }
          skillsByCert[row.certificate_id].push(row.skill_name);
        }

        for (const cert of verifiedCerts) {
          if (!existingCertBadgeIds.has(cert.id)) {
            const skillNames = skillsByCert[cert.id] || [];
            const criteriaText = skillNames.length > 0
              ? `Demonstrated competency in ${skillNames.join(', ')}`
              : 'Verified Credential Achievement';

            explicitBadges.push({
              id: `badge-${cert.id}`,
              certificate_id: cert.id,
              name: `${cert.certificate_name} Badge`,
              issuer: cert.issuer || 'Credential Authority',
              criteria: criteriaText,
              imageUrl: '',
              icon: '🏅',
              earnedDate: cert.created_at
                ? new Date(cert.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent',
            });
          }
        }
      }

      badgesEarned = explicitBadges.length;
      latestBadges = explicitBadges.slice(0, 4);
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
      totalActivities,
      total_activities: totalActivities,
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
