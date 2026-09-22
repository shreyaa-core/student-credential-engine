// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Routes
// Standard: 1EdTech Open Badges 3.0 & W3C Verifiable Credentials Data Integrity
// Cryptosuite: eddsa-rdfc-2022
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const {
  getPublicIssuerProfile,
  getPublicKeyDocument,
  issueBadgeForCertificate,
  verifyBadgeByCredentialId,
  getIssuerConfig,
} = require('../services/openBadgeService');
const { generateQRCode } = require('../services/qrService');
const { generateBadgeReportPdf } = require('../services/badgeReportPdfService');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

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

  // 2. Auto-issue badges for any verified/approved certificates lacking a badge row
  try {
    const pendingCertsRes = await poolClient.query(
      `SELECT id FROM certificates 
       WHERE student_id = $1 
         AND UPPER(status) IN ('VERIFIED', 'APPROVED')
         AND id NOT IN (SELECT certificate_id FROM badges WHERE certificate_id IS NOT NULL)`,
      [userId]
    );

    for (const row of pendingCertsRes.rows || []) {
      try {
        await issueBadgeForCertificate(row.id, userId, poolClient);
      } catch (autoErr) {
        console.warn(`[AutoBadge] Could not auto-issue badge for cert ${row.id}:`, autoErr.message);
      }
    }
  } catch (syncErr) {
    console.warn('Notice: Non-critical auto-badge check notice:', syncErr.message);
  }

  // 3. Fetch VERIFIED / APPROVED certificates strictly for this user
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

// ==============================================================================
// 1. PUBLIC ISSUER & VERIFICATION METHOD ENDPOINTS (Open Badges 3.0 Standard)
// ==============================================================================

/**
 * GET /api/badges/issuer
 * Public endpoint returning the Issuer Profile document.
 */
router.get(['/issuer', '/api/badges/issuer'], async (req, res) => {
  try {
    const profile = await getPublicIssuerProfile();
    return res.status(200).json(profile);
  } catch (err) {
    console.error('Error fetching issuer profile:', err);
    return res.status(500).json({ error: 'Failed to retrieve issuer profile' });
  }
});

/**
 * GET /api/badges/issuer/keys/:keyId
 * Public endpoint returning the public key / verification method document.
 * NEVER exposes private keys.
 */
router.get(['/issuer/keys/:keyId', '/api/badges/issuer/keys/:keyId'], async (req, res) => {
  try {
    const keyDoc = await getPublicKeyDocument(req.params.keyId);
    return res.status(200).json(keyDoc);
  } catch (err) {
    console.error('Error fetching public key document:', err);
    return res.status(500).json({ error: 'Failed to retrieve public key document' });
  }
});

/**
 * GET /api/badges/public/:credentialId
 * Public endpoint returning the exact stored OpenBadgeCredential JSON.
 */
router.get(['/public/:credentialId', '/api/badges/public/:credentialId'], async (req, res) => {
  try {
    const { credentialId } = req.params;
    if (!credentialId) {
      return res.status(400).json({ error: 'Credential ID is required.' });
    }

    const badgeRes = await pool.query(
      'SELECT credential_json FROM badges WHERE credential_id = $1',
      [credentialId.trim()]
    );

    if (badgeRes.rows.length === 0) {
      return res.status(404).json({
        error: `OpenBadgeCredential with ID "${credentialId}" not found.`,
      });
    }

    // Set JSON-LD content type header
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(badgeRes.rows[0].credential_json);
  } catch (err) {
    console.error('Error fetching public credential JSON:', err);
    return res.status(500).json({ error: 'Failed to retrieve credential JSON' });
  }
});

/**
 * GET /api/badges/verify/:credentialId
 * Public endpoint verifying the OpenBadgeCredential:
 * - Checks cryptographic proof (eddsa-rdfc-2022)
 * - Checks source certificate state
 * - Reports overall validity
 */
router.get(['/verify/:credentialId', '/api/badges/verify/:credentialId'], async (req, res) => {
  try {
    const { credentialId } = req.params;
    const report = await verifyBadgeByCredentialId(credentialId);

    if (report.notFound) {
      return res.status(404).json(report);
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('Error during public badge verification:', err);
    return res.status(500).json({
      success: false,
      valid: false,
      error: 'Failed to verify badge credential: ' + err.message,
    });
  }
});

// ==============================================================================
// 2. AUTHENTICATED USER BADGE ENDPOINTS
// ==============================================================================

/**
 * GET /api/badges
 * Fetch stored Open Badges for the authenticated student.
 * Automatically issues badges for any verified certificates that do not have one yet.
 */
router.get(['/', '/api/badges'], requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';
    const config = getIssuerConfig();

    // 1. Auto-issue badges for any verified certificates lacking a badge row
    try {
      const pendingCertsRes = await pool.query(
        `SELECT id FROM certificates 
         WHERE student_id = $1 
           AND UPPER(status) IN ('VERIFIED', 'APPROVED')
           AND id NOT IN (SELECT certificate_id FROM badges WHERE certificate_id IS NOT NULL)`,
        [studentId]
      );

      for (const row of pendingCertsRes.rows || []) {
        try {
          await issueBadgeForCertificate(row.id, studentId);
        } catch (autoErr) {
          console.warn(`[AutoBadge] Could not auto-issue badge for cert ${row.id}:`, autoErr.message);
        }
      }
    } catch (syncErr) {
      console.warn('Notice: Non-critical auto-badge check notice:', syncErr.message);
    }

    // 2. Query badges table from PostgreSQL
    const query = isAdmin
      ? `SELECT b.*, c.certificate_name, c.issuer AS cert_issuer, c.status AS cert_status
         FROM badges b
         LEFT JOIN certificates c ON b.certificate_id = c.id
         ORDER BY b.created_at DESC`
      : `SELECT b.*, c.certificate_name, c.issuer AS cert_issuer, c.status AS cert_status
         FROM badges b
         LEFT JOIN certificates c ON b.certificate_id = c.id
         WHERE b.student_id = $1
         ORDER BY b.created_at DESC`;
    const params = isAdmin ? [] : [studentId];

    const result = await pool.query(query, params);
    const badges = result.rows || [];

    const formattedBadges = [];
    for (const badge of badges) {
      const verificationUrl = `${config.clientUrl}/verify/badge/${badge.credential_id}`;
      let qrCode = '';
      try {
        qrCode = await generateQRCode(verificationUrl);
      } catch {}

      formattedBadges.push({
        id: badge.id,
        credential_id: badge.credential_id,
        credentialId: badge.credential_id,
        name: badge.name,
        criteria: badge.criteria || null,
        image_url: badge.image_url || '🏅',
        imageUrl: badge.image_url || '🏅',
        icon: badge.image_url || '🏅',
        issued_at: badge.issued_at,
        created_at: badge.created_at,
        earnedDate: badge.issued_at
          ? new Date(badge.issued_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null,
        certificate_id: badge.certificate_id,
        student_id: badge.student_id,
        issuer: badge.cert_issuer || config.issuerName,
        sourceCertificateStatus: badge.cert_status || 'VERIFIED',
        verificationUrl,
        qrCode,
        credential_json: badge.credential_json,
      });
    }

    return res.status(200).json(formattedBadges);
  } catch (err) {
    console.error('Error fetching badges:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch badges',
    });
  }
});

// ==============================================================================
// 3. VERIFIED REPORT & PDF DOWNLOAD ENDPOINTS (Placed before /:id)
// ==============================================================================

/**
 * GET /api/badges/report
 * Dynamic real-time Verified Credential Report strictly for the authenticated user.
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
 * Streams a downloadable Verified Credential Report PDF for the authenticated user.
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

/**
 * POST /api/badges/create
 * Issue an Open Badges 3.0 credential for a verified certificate.
 * 
 * Payload: { certificate_id: UUID }
 */
router.post(['/create', '/api/badges/create'], requireAuth, async (req, res) => {
  try {
    const certificateId = req.body.certificate_id || req.body.certificateId;
    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'certificate_id is required to issue a badge.',
      });
    }

    const studentId = req.user.id;
    const result = await issueBadgeForCertificate(certificateId, studentId);

    const statusCode = result.alreadyExists ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      message: result.alreadyExists ? 'Badge already exists for this certificate' : 'Open Badge 3.0 credential issued successfully',
      alreadyExists: result.alreadyExists,
      badge: {
        id: result.badge.id,
        credential_id: result.badge.credential_id,
        credentialId: result.badge.credential_id,
        name: result.badge.name,
        criteria: result.badge.criteria,
        issued_at: result.badge.issued_at,
        credential_json: result.badge.credential_json,
      },
      qrCode: result.qrCode,
      verificationUrl: result.verificationUrl,
    });
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to issue digital badge',
    });
  }
});

/**
 * GET /api/badges/:id
 * Retrieve a specific badge by internal database ID, credential_id, or certificate_id.
 * Positioned strictly after fixed named endpoints (/report, /report/download, /create).
 */
router.get(['/:id', '/api/badges/:id'], requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'undefined' || id === 'null' || id.trim() === '') {
    return res.status(400).json({ error: 'Valid badge identifier is required.' });
  }

  const cleanId = id.trim().replace(/^badge-/, '');
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
    return res.status(400).json({ error: 'Valid badge identifier is required.' });
  }

  const config = getIssuerConfig();

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    let badgeRes = await pool.query(
      isUUID
        ? `SELECT b.*, c.certificate_name, c.issuer AS cert_issuer, c.status AS cert_status
           FROM badges b
           LEFT JOIN certificates c ON b.certificate_id = c.id
           WHERE b.id::text = $1 OR b.credential_id = $1 OR b.certificate_id::text = $1`
        : `SELECT b.*, c.certificate_name, c.issuer AS cert_issuer, c.status AS cert_status
           FROM badges b
           LEFT JOIN certificates c ON b.certificate_id = c.id
           WHERE b.credential_id = $1`,
      [cleanId]
    );

    // If no badge row exists yet, check if cleanId matches an eligible certificate of this user
    if (badgeRes.rows.length === 0 && isUUID) {
      const certCheck = await pool.query(
        `SELECT id FROM certificates 
         WHERE id = $1 AND student_id = $2 AND UPPER(status) IN ('VERIFIED', 'APPROVED')`,
        [cleanId, req.user.id]
      );
      if (certCheck.rows.length > 0) {
        try {
          const issued = await issueBadgeForCertificate(cleanId, req.user.id);
          if (issued && issued.badge) {
            badgeRes = await pool.query(
              `SELECT b.*, c.certificate_name, c.issuer AS cert_issuer, c.status AS cert_status
               FROM badges b
               LEFT JOIN certificates c ON b.certificate_id = c.id
               WHERE b.id = $1`,
              [issued.badge.id]
            );
          }
        } catch (autoErr) {
          console.warn(`[AutoBadge] Could not issue badge on-demand for cert ${cleanId}:`, autoErr.message);
        }
      }
    }

    if (badgeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    const badge = badgeRes.rows[0];
    const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';
    if (badge.student_id !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Access denied to this badge.' });
    }

    const verificationUrl = `${config.clientUrl}/verify/badge/${badge.credential_id}`;
    const qrCode = await generateQRCode(verificationUrl);

    return res.status(200).json({
      id: badge.id,
      credential_id: badge.credential_id,
      credentialId: badge.credential_id,
      name: badge.name,
      criteria: badge.criteria,
      image_url: badge.image_url || '🏅',
      imageUrl: badge.image_url || '🏅',
      icon: badge.image_url || '🏅',
      issued_at: badge.issued_at,
      created_at: badge.created_at,
      earnedDate: badge.issued_at
        ? new Date(badge.issued_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null,
      certificate_id: badge.certificate_id,
      student_id: badge.student_id,
      issuer: badge.cert_issuer || config.issuerName,
      sourceCertificateStatus: badge.cert_status || 'VERIFIED',
      verificationUrl,
      qrCode,
      credential_json: badge.credential_json,
    });
  } catch (err) {
    console.error('Error fetching badge details:', err);
    return res.status(500).json({ error: 'Failed to fetch badge details' });
  }
});

router.fetchVerifiedReportData = fetchVerifiedReportData;
module.exports = router;
