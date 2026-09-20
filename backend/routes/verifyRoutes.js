// ==============================================================================
// Student Micro-Credential Verification Engine - Public Verification Routes
// ==============================================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { mapSkillsFromCourse } = require('../services/skillMappingService');

const router = express.Router();

/**
 * Normalizes UUID or Credential ID strings
 */
function cleanIdentifier(id = '') {
  return (id || '').trim().replace(/^CRED-/i, '').replace(/^0x/i, '');
}

/**
 * Format date nicely
 */
function formatDate(dateString) {
  if (!dateString) return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

/**
 * 1. GET /api/verify
 * 
 * Returns recently registered verifiable credentials and system statistics
 */
router.get(['/', '/api/verify'], async (req, res) => {
  try {
    const searchParam = req.query.id || req.query.query || req.query.search;
    if (searchParam) {
      return handleVerificationLookup(searchParam, req, res);
    }

    let credentials = [];

    try {
      const result = await pool.query(`
        SELECT id, student_id, certificate_name, certificate_id, issuer, status, verification_score, file_url, file_hash, created_at 
        FROM certificates 
        ORDER BY created_at DESC 
        LIMIT 10;
      `);

      if (result.rows && result.rows.length > 0) {
        credentials = result.rows;
      }
    } catch (dbErr) {
      console.warn('Notice: Error querying verifiable credentials from PostgreSQL:', dbErr.message);
    }

    const formattedList = credentials.map((c) => ({
      id: c.id,
      credentialId: c.certificate_id || `CRED-${(c.id || '').substring(0, 8).toUpperCase()}`,
      certificateId: c.certificate_id || null,
      title: c.certificate_name,
      certificate_name: c.certificate_name,
      issuer: c.issuer,
      status: c.status || 'PENDING',
      verificationScore: c.verification_score || 0,
      issueDate: formatDate(c.created_at),
      verificationHash: c.file_hash ? `0x${c.file_hash.substring(0, 32)}` : `0x${(c.id || '').replace(/-/g, '').substring(0, 32)}`,
    }));

    return res.status(200).json({
      success: true,
      count: formattedList.length,
      credentials: formattedList,
      latest: formattedList[0] || null,
    });
  } catch (err) {
    console.error('Error fetching verifiable credentials:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve verifiable credentials',
    });
  }
});

/**
 * 2. GET /api/verify/:identifier
 * 
 * Verifies authenticity of a specific credential and logs verification event.
 */
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  return handleVerificationLookup(identifier, req, res);
});

/**
 * Lookup and verification event handler
 */
async function handleVerificationLookup(identifier, req, res) {
  try {
    const rawQuery = (identifier || '').trim();
    if (!rawQuery) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid certificate ID, credential hash, or course identifier to verify.',
      });
    }

    const clean = cleanIdentifier(rawQuery).toLowerCase();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = UUID_REGEX.test(rawQuery);

    let cert = null;
    let studentProfile = null;
    let junctionSkillRows = [];

    try {
      // 1. Query certificate by exact UUID
      if (isUUID) {
        const certRes = await pool.query('SELECT * FROM certificates WHERE id = $1 LIMIT 1', [rawQuery]);
        if (certRes.rows && certRes.rows.length > 0) {
          cert = certRes.rows[0];
        }
      }

      // 2. Query by certificate_id when available
      if (!cert) {
        const certIdRes = await pool.query(
          'SELECT * FROM certificates WHERE certificate_id = $1 OR LOWER(certificate_id) = LOWER($1) LIMIT 1',
          [rawQuery]
        );
        if (certIdRes.rows && certIdRes.rows.length > 0) {
          cert = certIdRes.rows[0];
        }
      }

      // 3. Query by file_hash (SHA-256 or prefix)
      if (!cert && /^[0-9a-fA-F]{16,64}$/.test(rawQuery.replace(/^0x/i, ''))) {
        const hashQuery = rawQuery.replace(/^0x/i, '');
        const hashRes = await pool.query(
          'SELECT * FROM certificates WHERE file_hash = $1 OR file_hash ILIKE $2 LIMIT 1',
          [hashQuery, `${hashQuery}%`]
        );
        if (hashRes.rows && hashRes.rows.length > 0) {
          cert = hashRes.rows[0];
        }
      }

      // 4. Query by course title, issuer, or UUID prefix (e.g. CRED-...)
      if (!cert) {
        const searchPattern = `%${rawQuery}%`;
        const certsRes = await pool.query(
          'SELECT * FROM certificates WHERE id::text ILIKE $1 OR certificate_name ILIKE $2 OR issuer ILIKE $2 LIMIT 1',
          [`${clean}%`, searchPattern]
        );
        if (certsRes.rows && certsRes.rows.length > 0) {
          cert = certsRes.rows[0];
        }
      }

      // 5. Fetch associated student profile if student_id is set (public-safe fields only)
      if (cert && cert.student_id && UUID_REGEX.test(cert.student_id)) {
        const profRes = await pool.query(
          'SELECT full_name, institution FROM profiles WHERE id = $1 LIMIT 1',
          [cert.student_id]
        );
        if (profRes.rows && profRes.rows.length > 0) {
          studentProfile = profRes.rows[0];
        }
      }

      // 6. Fetch associated skills from junction table
      if (cert && cert.id) {
        const skillJunction = await pool.query(`
          SELECT s.name, s.category, cs.proficiency_level 
          FROM certificate_skills cs
          JOIN skills s ON cs.skill_id = s.id
          WHERE cs.certificate_id = $1
        `, [cert.id]);

        if (skillJunction.rows && Array.isArray(skillJunction.rows)) {
          junctionSkillRows = skillJunction.rows;
        }
      }
    } catch (dbErr) {
      console.warn('PostgreSQL query notice in verification lookup:', dbErr.message);
    }

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: `No authentic credential found matching "${rawQuery}". Verification failed or credential does not exist.`,
        searchedQuery: rawQuery,
      });
    }

    // Process skills from verification_evidence and junction table
    const evidenceObj = cert.verification_evidence || {};
    const skillAnalysis = evidenceObj.skillAnalysis || {};
    const rawSkills = skillAnalysis.skills || [];
    const rawUnmatched = skillAnalysis.unmatchedSkills || [];

    let detectedSkills = [];
    if (rawSkills.length > 0) {
      detectedSkills = rawSkills.map((item) => {
        const name = item.skillName || item.skill || item.name;
        const matchingJunction = junctionSkillRows.find(
          (j) => j.name?.toLowerCase() === name?.toLowerCase()
        );
        return {
          name: name,
          category: matchingJunction?.category || item.category || 'General Competency',
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
          evidence: item.evidence || 'Evidenced in certificate documentation',
        };
      });
    } else if (junctionSkillRows.length > 0) {
      detectedSkills = junctionSkillRows.map((j) => ({
        name: j.name,
        category: j.category || 'General Competency',
        confidence: 0.90,
        evidence: `Evidenced in credential coursework (${j.proficiency_level || 'Proficient'})`,
      }));
    }

    let unmatchedSkills = [];
    if (Array.isArray(rawUnmatched) && rawUnmatched.length > 0) {
      unmatchedSkills = rawUnmatched.map((item) => ({
        name: item.name,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
        evidence: item.evidence || 'Evidenced in certificate documentation',
      }));
    }

    // Process safe issuer verification information
    const rawIv = evidenceObj.issuerVerification || null;
    let issuerVerification = null;
    if (rawIv) {
      issuerVerification = {
        issuer: rawIv.issuer || cert.issuer || 'Not specified',
        status: rawIv.status || cert.status || 'PENDING',
        method: rawIv.method || 'OFFICIAL_URL',
        reason: rawIv.reason || (cert.status === 'MANUAL_REVIEW' ? 'Issuer could not be authoritatively verified.' : 'Verification evaluated by engine.'),
        verifiedAt: rawIv.verifiedAt || cert.created_at || null,
        certificateIdMatched: Boolean(rawIv.certificateIdMatched),
      };
    } else if (cert.status === 'MANUAL_REVIEW') {
      issuerVerification = {
        issuer: cert.issuer || 'Not specified',
        status: 'MANUAL_REVIEW',
        method: 'OFFICIAL_URL',
        reason: 'Issuer could not be authoritatively verified.',
        verifiedAt: cert.created_at || null,
        certificateIdMatched: false,
      };
    }

    // Log real audit event into PostgreSQL verification_logs table
    const isCertVerified = cert.status === 'VERIFIED' || cert.status === 'APPROVED';
    const verificationStatus = isCertVerified ? 'SUCCESS' : 'PENDING_REVIEW';
    const auditEventId = uuidv4();
    const eventTimestamp = new Date().toISOString();

    if (cert.id && isUUID) {
      try {
        const logQuery = `
          INSERT INTO verification_logs (
            id, certificate_id, verifier_id, verification_status, verification_method, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `;
        const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        await pool.query(logQuery, [
          auditEventId,
          cert.id,
          null,
          verificationStatus,
          'public_portal',
          clientIp,
        ]);
      } catch (logErr) {
        console.warn('Notice: Non-critical audit log note in PostgreSQL:', logErr.message);
      }
    }

    // Map human-readable status
    const statusUpper = (cert.status || 'PENDING').toUpperCase();
    let displayStatus = 'Pending Review';
    if (statusUpper === 'VERIFIED' || statusUpper === 'APPROVED') {
      displayStatus = 'Credential Verified';
    } else if (statusUpper === 'MANUAL_REVIEW') {
      displayStatus = 'Manual Review Required';
    } else if (statusUpper === 'REJECTED') {
      displayStatus = 'Credential Rejected';
    } else if (statusUpper === 'VERIFICATION_TIMEOUT') {
      displayStatus = 'Verification Timed Out';
    } else if (statusUpper === 'UNSUPPORTED_ISSUER') {
      displayStatus = 'Unsupported Issuer';
    } else if (statusUpper === 'PENDING') {
      displayStatus = 'Pending Review';
    } else {
      displayStatus = cert.status.replace(/_/g, ' ');
    }

    // Determine student name (public-safe)
    const studentName = studentProfile?.full_name || 'Student';

    // Format response payload
    const verificationPayload = {
      id: cert.id,
      credentialId: cert.certificate_id || `CRED-${cert.id.substring(0, 8).toUpperCase()}`,
      certificateId: cert.certificate_id || null,
      studentName: studentName,
      courseName: cert.certificate_name || 'Not specified',
      certificateName: cert.certificate_name || 'Not specified',
      issuer: cert.issuer || 'Not specified',
      fileType: cert.file_type || 'PDF',
      issueDate: cert.issue_date ? formatDate(cert.issue_date) : (cert.created_at ? formatDate(cert.created_at) : 'Not specified'),
      status: displayStatus,
      statusCode: statusUpper,
      verificationScore: cert.verification_score !== null && cert.verification_score !== undefined ? cert.verification_score : 0,
      fileUrl: cert.file_url || '',
      fileHash: cert.file_hash || '',
      verificationHash: cert.file_hash ? `0x${cert.file_hash.substring(0, 32)}` : `0x${cert.id.replace(/-/g, '').substring(0, 32)}`,
      issuerVerification: issuerVerification,
      detectedSkills: detectedSkills,
      unmatchedSkills: unmatchedSkills,
      skills: detectedSkills.map((s) => s.name),
      auditEvent: {
        eventId: auditEventId,
        status: verificationStatus,
        method: 'public_portal',
        timestamp: eventTimestamp,
        logged: true,
      },
    };

    return res.status(200).json({
      success: true,
      credential: verificationPayload,
    });
  } catch (err) {
    console.error('Error during credential verification lookup:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during credential verification.',
    });
  }
}

module.exports = router;
