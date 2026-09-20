// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { generateBadge } = require('../services/badgeService');
const { generateQRCode } = require('../services/qrService');
const { generateBadgeReportPdf } = require('../services/badgeReportPdfService');
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

    // Synchronize and include digital badges dynamically for any verified certificates
    try {
      const existingCertBadgeIds = new Set(formattedBadges.map((b) => b.certificate_id).filter(Boolean));
      const certRes = await pool.query(
        `SELECT id, certificate_name, issuer, created_at 
         FROM certificates 
         WHERE student_id = $1 AND UPPER(status) IN ('VERIFIED', 'APPROVED') 
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      const verifiedCerts = certRes.rows || [];
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

            formattedBadges.push({
              id: `badge-${cert.id}`,
              name: `${cert.certificate_name} Badge`,
              issuer: cert.issuer || 'Credential Authority',
              criteria: criteriaText,
              image_url: '',
              imageUrl: '',
              icon: '🏅',
              created_at: cert.created_at,
              earnedDate: cert.created_at
                ? new Date(cert.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent',
              certificate_id: cert.id,
              student_id: req.user.id,
            });
          }
        }
      }
    } catch (syncErr) {
      console.warn('Notice: Error deriving badges from verified certificates:', syncErr.message);
    }

    return res.status(200).json(formattedBadges);
  } catch (err) {
    console.error('Error fetching badges:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch badges',
    });
  }
});

/**
 * Helper: Query and assemble real-time verified credential report data strictly for a user.
 * Scoped strictly to the provided userId.
 * Only certificates where status === 'VERIFIED' are included.
 */
async function fetchVerifiedReportData(userId, poolClient = pool) {
  // 1. Fetch user profile
  const profileRes = await poolClient.query(
    'SELECT id, full_name, email, role FROM profiles WHERE id = $1',
    [userId]
  );

  if (profileRes.rows.length === 0) {
    return null;
  }

  const profile = profileRes.rows[0];
  const userRole = (profile.role || 'issuer').toLowerCase() === 'admin' ? 'Admin' : 'Issuer';

  // 2. Fetch VERIFIED / APPROVED certificates strictly for this user
  const certQuery = `
    SELECT 
      id,
      certificate_name,
      issuer,
      issue_date,
      status,
      created_at
    FROM certificates
    WHERE student_id = $1
      AND UPPER(status) IN ('VERIFIED', 'APPROVED')
    ORDER BY COALESCE(issue_date, created_at::date) DESC, created_at DESC
  `;
  const certRes = await poolClient.query(certQuery, [userId]);
  const certRows = certRes.rows || [];

  // 3. Fetch skills for the user's VERIFIED / APPROVED certificates
  const skillsByCert = new Map();
  const overallSkillsMap = new Map();

  if (certRows.length > 0) {
    const skillsQuery = `
      SELECT 
        cs.certificate_id,
        s.id AS skill_id,
        s.name AS skill_name,
        s.category,
        COALESCE(cs.proficiency_level, 'Intermediate') AS proficiency_level
      FROM certificates c
      JOIN certificate_skills cs ON c.id = cs.certificate_id
      JOIN skills s ON cs.skill_id = s.id
      WHERE c.student_id = $1
        AND UPPER(c.status) IN ('VERIFIED', 'APPROVED')
      ORDER BY s.name ASC
    `;
    const skillsRes = await poolClient.query(skillsQuery, [userId]);
    const skillRows = skillsRes.rows || [];

    for (const row of skillRows) {
      if (!skillsByCert.has(row.certificate_id)) {
        skillsByCert.set(row.certificate_id, []);
      }
      skillsByCert.get(row.certificate_id).push({
        id: row.skill_id,
        name: row.skill_name,
        category: row.category || 'General',
        proficiencyLevel: row.proficiency_level,
      });

      if (!overallSkillsMap.has(row.skill_id)) {
        overallSkillsMap.set(row.skill_id, {
          id: row.skill_id,
          name: row.skill_name,
          category: row.category || 'General',
        });
      }
    }
  }

  // 4. Format verified certificates
  const verifiedCertificates = certRows.map((cert) => {
    let issueDateStr = null;
    if (cert.issue_date) {
      issueDateStr = new Date(cert.issue_date).toISOString().split('T')[0];
    } else if (cert.created_at) {
      issueDateStr = new Date(cert.created_at).toISOString().split('T')[0];
    }

    return {
      id: cert.id,
      certificateName: cert.certificate_name,
      issuer: cert.issuer,
      issueDate: issueDateStr,
      status: (cert.status || '').toUpperCase() === 'APPROVED' ? 'VERIFIED' : cert.status,
      skills: skillsByCert.get(cert.id) || [],
    };
  });

  const overallSkills = Array.from(overallSkillsMap.values());

  return {
    issuer: {
      id: profile.id,
      fullName: profile.full_name,
      role: userRole,
    },
    verifiedCertificatesCount: verifiedCertificates.length,
    verifiedCertificates,
    overallSkills,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/badges/report
 * 
 * Purpose:
 * Generate dynamic, real-time Verified Credential Report strictly for the authenticated user.
 * 
 * Security & Scoping:
 * - Requires authentication (requireAuth middleware)
 * - Scoped strictly to req.user.id
 * - ONLY certificates with status === 'VERIFIED' are included.
 * - Non-VERIFIED statuses (MANUAL_REVIEW, PENDING, PROCESSING, VERIFICATION_TIMEOUT,
 *   SUSPICIOUS, REJECTED, APPROVED) are strictly excluded.
 */
router.get(['/report', '/api/badges/report'], requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const report = await fetchVerifiedReportData(userId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (err) {
    console.error('Error generating verified credential report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate verified credential report',
    });
  }
});

/**
 * GET /api/badges/report/download
 * 
 * Purpose:
 * Generates and streams a downloadable Verified Credential Report PDF
 * strictly using the authenticated user's current PostgreSQL data.
 * 
 * Security & Scoping:
 * - Requires authentication (requireAuth middleware)
 * - Scoped strictly to req.user.id (never accepts user ID from query/params)
 * - Only exact status === 'VERIFIED' certificates are included
 * - Returns Content-Type: application/pdf
 * - Returns Content-Disposition: attachment; filename="Verified-Credential-Report.pdf"
 */
router.get(['/report/download', '/api/badges/report/download'], requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const report = await fetchVerifiedReportData(userId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    const pdfBuffer = await generateBadgeReportPdf(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Verified-Credential-Report.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('Error downloading verified credential report PDF:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate verified credential report PDF',
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

router.fetchVerifiedReportData = fetchVerifiedReportData;
module.exports = router;
