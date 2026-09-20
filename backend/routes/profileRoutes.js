// ==============================================================================
// Student Micro-Credential Verification Engine - Profile / Portfolio Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper: Query and format real student portfolio data from PostgreSQL
 * Strictly filters all certificates, skills, and badges by the target user ID.
 */
async function fetchUserProfileData(userId) {
  // 1. Fetch Student Profile from PostgreSQL 'profiles'
  const profileRes = await pool.query(
    `SELECT id, full_name, email, role, institution, bio, last_qualification, profile_photo_url, created_at 
     FROM profiles 
     WHERE id = $1`,
    [userId]
  );

  if (!profileRes.rows || profileRes.rows.length === 0) {
    return null;
  }

  const profile = profileRes.rows[0];

  // 2. Fetch Certificates belonging strictly to this user
  const certRes = await pool.query(
    `SELECT id, student_id, certificate_name, issuer, file_url, status, verification_score, created_at 
     FROM certificates 
     WHERE student_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );

  const certificates = (certRes.rows || []).map((c) => ({
    id: c.id,
    title: c.certificate_name || 'Certificate',
    certificate_name: c.certificate_name,
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
    verificationHash: c.id ? `0x${c.id.replace(/-/g, '').substring(0, 32)}` : null,
    file_url: c.file_url || '',
  }));

  // 3. Fetch Skills connected strictly to this user's certificates
  const skillsQuery = `
    SELECT 
      s.id, 
      s.name, 
      s.category, 
      COUNT(cs.id)::int AS "verifiedBy",
      COALESCE(MAX(cs.proficiency_level), 'Intermediate') AS level
    FROM certificates c
    JOIN certificate_skills cs ON c.id = cs.certificate_id
    JOIN skills s ON cs.skill_id = s.id
    WHERE c.student_id = $1
    GROUP BY s.id, s.name, s.category
    ORDER BY s.name ASC;
  `;
  const skillRes = await pool.query(skillsQuery, [userId]);
  const skills = (skillRes.rows || []).map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category || 'General',
    level: s.level || 'Intermediate',
    verifiedBy: parseInt(s.verifiedBy, 10) || 0,
  }));

  // 4. Fetch Badges awarded strictly to this user
  const badgeRes = await pool.query(
    `SELECT id, student_id, certificate_id, name, image_url, criteria, created_at 
     FROM badges 
     WHERE student_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );

  const badges = (badgeRes.rows || []).map((b) => ({
    id: b.id,
    name: b.name,
    issuer: 'Credential Authority',
    criteria: b.criteria || null,
    image_url: b.image_url || '',
    icon: b.image_url || '🏅',
    earnedDate: b.created_at
      ? new Date(b.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : null,
  }));

  // Synchronize and include digital badges dynamically for any verified / approved certificates
  const existingBadgeCertIds = new Set(badges.map((b) => b.certificate_id).filter(Boolean));
  for (const cert of certificates) {
    const isVerified = ['VERIFIED', 'APPROVED'].includes((cert.status || '').toUpperCase());
    if (isVerified && !existingBadgeCertIds.has(cert.id)) {
      const certSkills = skills
        .filter((s) => s.verifiedBy > 0)
        .map((s) => s.name);
      const criteriaText = certSkills.length > 0
        ? `Demonstrated competency in ${certSkills.join(', ')}`
        : 'Verified Credential Achievement';

      badges.push({
        id: `badge-${cert.id}`,
        student_id: userId,
        certificate_id: cert.id,
        name: `${cert.title || cert.certificate_name} Badge`,
        issuer: cert.issuer || 'Credential Authority',
        criteria: criteriaText,
        image_url: '',
        icon: '🏅',
        earnedDate: cert.issueDate || 'Recent',
      });
    }
  }

  const totalCertificates = certificates.length;
  const verifiedCertificates = certificates.filter((c) =>
    ['VERIFIED', 'APPROVED'].includes((c.status || '').toUpperCase())
  ).length;
  const rawTrustRating = totalCertificates === 0 ? 0 : (verifiedCertificates / totalCertificates) * 100;
  const trustScoreFormatted = totalCertificates === 0
    ? '0%'
    : (rawTrustRating % 1 === 0 ? `${rawTrustRating}%` : `${rawTrustRating.toFixed(2)}%`);

  const formattedProfile = {
    id: profile.id,
    name: profile.full_name,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    institution: profile.institution || null,
    bio: profile.bio || null,
    last_qualification: profile.last_qualification || null,
    profile_photo_url: profile.profile_photo_url || null,
    studentId: `STU-${profile.id.substring(0, 8).toUpperCase()}`,
    issuerId: `ISS-${profile.id.substring(0, 8).toUpperCase()}`,
    created_at: profile.created_at,
    stats: {
      certificatesCount: totalCertificates,
      verifiedCertificatesCount: verifiedCertificates,
      skillsCount: skills.length,
      badgesCount: badges.length,
      trustScore: trustScoreFormatted,
      trustRating: trustScoreFormatted,
    },
  };

  return {
    profile: formattedProfile,
    studentProfile: formattedProfile,
    certificates,
    skills,
    badges,
  };
}

/**
 * GET /api/profile/me
 * 
 * Authenticated endpoint retrieving strictly the current logged-in user's profile and portfolio data.
 * Does not accept user ID from query or body; derives ID solely from req.user.id.
 */
router.get(['/me', '/api/profile/me'], requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No user identity found.',
      });
    }

    const portfolioData = await fetchUserProfileData(req.user.id);

    if (!portfolioData) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found in database.',
      });
    }

    return res.status(200).json({
      success: true,
      profile: portfolioData.profile,
      studentProfile: portfolioData.studentProfile,
      certificates: portfolioData.certificates,
      skills: portfolioData.skills,
      badges: portfolioData.badges,
    });
  } catch (err) {
    console.error('Error in GET /api/profile/me:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve authenticated user profile.',
    });
  }
});

/**
 * PUT /api/profile/me
 * 
 * Authenticated endpoint to update the logged-in user's profile.
 * - Editable: full_name, institution, last_qualification, bio
 * - Read-only: email, role, id, created_at, password_hash
 * - Identifies target user strictly via req.user.id (never from body or query)
 * - Returns updated profile without password_hash
 */
router.put(['/me', '/api/profile/me'], requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No user identity found.',
      });
    }

    const userId = req.user.id;

    // 1. Fetch existing user profile
    const existingRes = await pool.query(
      `SELECT id, full_name, email, role, institution, bio, last_qualification, profile_photo_url, created_at 
       FROM profiles 
       WHERE id = $1`,
      [userId]
    );

    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found in database.',
      });
    }

    const existing = existingRes.rows[0];

    // 2. Validate and sanitize editable fields
    let updatedFullName = existing.full_name;
    let updatedInstitution = existing.institution;
    let updatedLastQual = existing.last_qualification;
    let updatedBio = existing.bio;

    // Validate full_name
    if (req.body.full_name !== undefined) {
      if (typeof req.body.full_name !== 'string' || !req.body.full_name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Full name cannot be empty.',
        });
      }
      const trimmedName = req.body.full_name.trim();
      if (trimmedName.length > 255) {
        return res.status(400).json({
          success: false,
          error: 'Full name cannot exceed 255 characters.',
        });
      }
      updatedFullName = trimmedName;
    }

    // Validate institution
    if (req.body.institution !== undefined) {
      if (req.body.institution === null || !req.body.institution.toString().trim()) {
        updatedInstitution = null;
      } else {
        const trimmedInst = req.body.institution.toString().trim();
        if (trimmedInst.length > 255) {
          return res.status(400).json({
            success: false,
            error: 'Institution cannot exceed 255 characters.',
          });
        }
        updatedInstitution = trimmedInst;
      }
    }

    // Validate last_qualification
    if (req.body.last_qualification !== undefined) {
      if (req.body.last_qualification === null || !req.body.last_qualification.toString().trim()) {
        updatedLastQual = null;
      } else {
        const trimmedQual = req.body.last_qualification.toString().trim();
        if (trimmedQual.length > 255) {
          return res.status(400).json({
            success: false,
            error: 'Last qualification cannot exceed 255 characters.',
          });
        }
        updatedLastQual = trimmedQual;
      }
    }

    // Validate bio
    if (req.body.bio !== undefined) {
      if (req.body.bio === null || !req.body.bio.toString().trim()) {
        updatedBio = null;
      } else {
        const trimmedBio = req.body.bio.toString().trim();
        if (trimmedBio.length > 2000) {
          return res.status(400).json({
            success: false,
            error: 'Bio cannot exceed 2000 characters.',
          });
        }
        updatedBio = trimmedBio;
      }
    }

    // 3. Execute parameterized update query
    const updateRes = await pool.query(
      `UPDATE profiles
       SET full_name = $1,
           institution = $2,
           last_qualification = $3,
           bio = $4
       WHERE id = $5
       RETURNING id, full_name, email, role, institution, bio, last_qualification, profile_photo_url, created_at`,
      [updatedFullName, updatedInstitution, updatedLastQual, updatedBio, userId]
    );

    const updatedProfile = updateRes.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile: {
        id: updatedProfile.id,
        full_name: updatedProfile.full_name,
        name: updatedProfile.full_name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        institution: updatedProfile.institution || null,
        bio: updatedProfile.bio || null,
        last_qualification: updatedProfile.last_qualification || null,
        profile_photo_url: updatedProfile.profile_photo_url || null,
        created_at: updatedProfile.created_at,
      },
    });
  } catch (err) {
    console.error('Error in PUT /api/profile/me:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update profile.',
    });
  }
});

/**
 * GET /api/profile/:id
 * 
 * Look up public student portfolio by UUID or email.
 * Never uses LIMIT 1 or fallback data for unknown identifiers.
 */
router.get(['/:id', '/api/profile/:id'], async (req, res) => {
  try {
    const requestedId = req.params.id;

    if (!requestedId || requestedId === 'default' || requestedId === 'me') {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (authHeader && (requestedId === 'me' || requestedId === 'default')) {
        return requireAuth(req, res, async () => {
          const portfolioData = await fetchUserProfileData(req.user.id);
          if (!portfolioData) {
            return res.status(404).json({ success: false, error: 'Profile not found.' });
          }
          return res.status(200).json({ success: true, ...portfolioData });
        });
      }

      return res.status(400).json({
        success: false,
        error: 'A valid user ID or email is required to view a portfolio.',
      });
    }

    let targetUserId = null;

    if (UUID_REGEX.test(requestedId)) {
      targetUserId = requestedId;
    } else if (requestedId.includes('@')) {
      const lookup = await pool.query(
        'SELECT id FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [requestedId.trim()]
      );
      if (lookup.rows.length > 0) {
        targetUserId = lookup.rows[0].id;
      }
    }

    if (!targetUserId) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found.',
      });
    }

    const portfolioData = await fetchUserProfileData(targetUserId);

    if (!portfolioData) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      ...portfolioData,
    });
  } catch (err) {
    console.error('Error in GET /api/profile/:id:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve profile portfolio.',
    });
  }
});

module.exports = router;
