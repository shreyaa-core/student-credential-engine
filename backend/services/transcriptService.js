// ==============================================================================
// Student Micro-Credential Verification Engine - Transcript Service (Step 6)
// Authoritative Co-Curricular Transcript Builder
// ==============================================================================

const pool = require('../config/database');

/**
 * Builds a comprehensive, verifiable co-curricular transcript for an authenticated student.
 * 
 * Strict Data Integrity Rules:
 * 1. Verified Credentials: ONLY certificates where status IN ('VERIFIED', 'APPROVED').
 *    Excludes: PROCESSING, PENDING, MANUAL_REVIEW, VERIFICATION_TIMEOUT, SUSPICIOUS, REJECTED.
 * 2. Certificate Date Handling: Use issue_date when present. If null, return issue_date: null
 *    and uploaded_at: created_at. Never mislabel created_at as issue_date.
 * 3. Credential Skills: Loaded strictly from verified/approved certificates.
 * 4. Co-Curricular Activities: Loaded from activity_logs for student_id. Clearly labeled as
 *    recorded activities, never claimed as verified credentials.
 * 5. Activity Skills: Loaded from activity_skills. Distinct and distinguishable from credential skills.
 * 6. Digital Badges: Loaded from badges. Only badges whose source certificate status is
 *    VERIFIED or APPROVED are included as active/current.
 * 7. Privacy: Strictly queries studentId passed from req.user.id.
 * 
 * @param {string} studentId - UUID of the authenticated student
 * @param {object} [dbClient=pool] - Optional PostgreSQL client or pool
 * @returns {Promise<object|null>} Complete transcript object or null if student not found
 */
async function buildStudentTranscript(studentId, dbClient = pool) {
  if (!studentId) {
    throw new Error('Student ID is required to build transcript.');
  }

  // 1. Fetch Student Profile
  const profileRes = await dbClient.query(
    `SELECT id, full_name, email, role, institution, bio, last_qualification, created_at
     FROM profiles
     WHERE id = $1`,
    [studentId]
  );

  if (profileRes.rows.length === 0) {
    return null;
  }

  const profile = profileRes.rows[0];

  // 2. Fetch Verified & Approved Certificates ONLY
  const certQuery = `
    SELECT 
      id,
      certificate_name,
      issuer,
      issue_date::text AS issue_date,
      file_url,
      verification_url,
      status,
      created_at
    FROM certificates
    WHERE student_id = $1
      AND UPPER(status) IN ('VERIFIED', 'APPROVED')
    ORDER BY COALESCE(issue_date, created_at::date) DESC, created_at DESC
  `;
  const certRes = await dbClient.query(certQuery, [studentId]);
  const certRows = certRes.rows || [];

  // 3. Fetch Skills for Verified Certificates
  const certIds = certRows.map((c) => c.id);
  const certSkillsMap = new Map();
  const credentialSkillsMap = new Map();

  if (certIds.length > 0) {
    const certSkillsQuery = `
      SELECT 
        cs.certificate_id,
        s.id AS skill_id,
        s.name AS skill_name,
        s.category,
        COALESCE(cs.proficiency_level, 'Intermediate') AS proficiency_level
      FROM certificate_skills cs
      JOIN skills s ON cs.skill_id = s.id
      WHERE cs.certificate_id = ANY($1::uuid[])
      ORDER BY s.name ASC
    `;
    const csRes = await dbClient.query(certSkillsQuery, [certIds]);
    for (const row of csRes.rows || []) {
      if (!certSkillsMap.has(row.certificate_id)) {
        certSkillsMap.set(row.certificate_id, []);
      }
      const skillObj = {
        id: row.skill_id,
        name: row.skill_name,
        category: row.category || 'General',
        proficiencyLevel: row.proficiency_level,
      };
      certSkillsMap.get(row.certificate_id).push(skillObj);

      if (!credentialSkillsMap.has(row.skill_id)) {
        credentialSkillsMap.set(row.skill_id, {
          id: row.skill_id,
          name: row.skill_name,
          category: row.category || 'General',
          source: 'Verified Certificate',
        });
      }
    }
  }

  // Format certificates
  const formattedCertificates = certRows.map((c) => {
    let issueDateFormatted = null;
    if (c.issue_date) {
      issueDateFormatted = new Date(c.issue_date).toISOString().split('T')[0];
    }
    const uploadedAtFormatted = c.created_at
      ? new Date(c.created_at).toISOString().split('T')[0]
      : null;

    return {
      id: c.id,
      certificate_name: c.certificate_name,
      issuer: c.issuer || 'Credential Authority',
      issue_date: issueDateFormatted,
      uploaded_at: uploadedAtFormatted,
      status: (c.status || '').toUpperCase() === 'APPROVED' ? 'Approved' : 'Verified',
      raw_status: c.status,
      verification_url: c.verification_url || null,
      skills: certSkillsMap.get(c.id) || [],
    };
  });

  // 4. Fetch Recorded Co-Curricular Activities
  const actQuery = `
    SELECT 
      id,
      student_id,
      title,
      activity_type,
      organizer,
      description,
      activity_date::text AS activity_date,
      evidence_url,
      created_at
    FROM activity_logs
    WHERE student_id = $1
    ORDER BY COALESCE(activity_date, created_at::date) DESC, created_at DESC
  `;
  const actRes = await dbClient.query(actQuery, [studentId]);
  const actRows = actRes.rows || [];

  // 5. Fetch Skills Mapped from Activities
  const actIds = actRows.map((a) => a.id);
  const actSkillsMap = new Map();
  const activitySkillsMap = new Map();

  if (actIds.length > 0) {
    const actSkillsQuery = `
      SELECT 
        ask.activity_id,
        s.id AS skill_id,
        s.name AS skill_name,
        s.category,
        ask.confidence_score,
        ask.evidence_text
      FROM activity_skills ask
      JOIN skills s ON ask.skill_id = s.id
      WHERE ask.activity_id = ANY($1::uuid[])
      ORDER BY s.name ASC
    `;
    const asRes = await dbClient.query(actSkillsQuery, [actIds]);
    for (const row of asRes.rows || []) {
      if (!actSkillsMap.has(row.activity_id)) {
        actSkillsMap.set(row.activity_id, []);
      }
      const actSkillObj = {
        id: row.skill_id,
        name: row.skill_name,
        category: row.category || 'General',
        confidenceScore: row.confidence_score,
        evidenceText: row.evidence_text,
      };
      actSkillsMap.get(row.activity_id).push(actSkillObj);

      if (!activitySkillsMap.has(row.skill_id)) {
        activitySkillsMap.set(row.skill_id, {
          id: row.skill_id,
          name: row.skill_name,
          category: row.category || 'General',
          source: 'Activity Log',
        });
      }
    }
  }

  // Format activities
  const formattedActivities = actRows.map((a) => {
    let activityDateFormatted = null;
    if (a.activity_date) {
      activityDateFormatted = new Date(a.activity_date).toISOString().split('T')[0];
    }
    return {
      id: a.id,
      title: a.title,
      activity_type: a.activity_type || 'Co-Curricular',
      organizer: a.organizer || null,
      description: a.description,
      activity_date: activityDateFormatted,
      evidence_url: a.evidence_url || null,
      created_at: a.created_at ? new Date(a.created_at).toISOString() : null,
      skills: actSkillsMap.get(a.id) || [],
    };
  });

  // 6. Fetch Active Digital Badges (Checking Source Certificate Status)
  const badgeQuery = `
    SELECT 
      b.id,
      b.credential_id,
      b.name,
      b.criteria,
      b.image_url,
      b.issued_at,
      b.created_at,
      b.certificate_id,
      c.certificate_name,
      c.issuer AS cert_issuer,
      c.status AS cert_status
    FROM badges b
    JOIN certificates c ON b.certificate_id = c.id
    WHERE b.student_id = $1
    ORDER BY COALESCE(b.issued_at, b.created_at) DESC
  `;
  const badgeRes = await dbClient.query(badgeQuery, [studentId]);
  const badgeRows = badgeRes.rows || [];

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  // Include ONLY badges where source certificate is VERIFIED or APPROVED
  const activeBadges = [];
  for (const b of badgeRows) {
    const certStatusUpper = (b.cert_status || '').toUpperCase();
    const isSourceValid = ['VERIFIED', 'APPROVED'].includes(certStatusUpper);

    if (isSourceValid) {
      activeBadges.push({
        id: b.id,
        credential_id: b.credential_id,
        name: b.name,
        criteria: b.criteria,
        image_url: b.image_url || '🏅',
        issued_at: b.issued_at ? new Date(b.issued_at).toISOString() : null,
        certificate_id: b.certificate_id,
        certificate_name: b.certificate_name,
        issuer: b.cert_issuer || 'Credential Authority',
        verification_url: b.credential_id
          ? `${clientUrl}/verify/badge/${b.credential_id}`
          : null,
      });
    }
  }

  // 7. Assemble Unified Skills Summary with Provenance
  const unifiedSkillsMap = new Map();

  for (const [skillId, skill] of credentialSkillsMap.entries()) {
    unifiedSkillsMap.set(skillId, {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      sources: ['Verified Certificate'],
    });
  }

  for (const [skillId, skill] of activitySkillsMap.entries()) {
    if (unifiedSkillsMap.has(skillId)) {
      const existing = unifiedSkillsMap.get(skillId);
      if (!existing.sources.includes('Activity')) {
        existing.sources.push('Activity');
      }
    } else {
      unifiedSkillsMap.set(skillId, {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        sources: ['Activity'],
      });
    }
  }

  const credentialBasedSkills = Array.from(credentialSkillsMap.values());
  const activityBasedSkills = Array.from(activitySkillsMap.values());
  const unifiedSkills = Array.from(unifiedSkillsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // 8. Assemble Summary Counts
  const summary = {
    verified_certificates: formattedCertificates.length,
    activities: formattedActivities.length,
    digital_badges: activeBadges.length,
    credential_skills: credentialBasedSkills.length,
    activity_skills: activityBasedSkills.length,
    total_unique_skills: unifiedSkills.length,
  };

  return {
    student: {
      id: profile.id,
      full_name: profile.full_name,
      institution: profile.institution || null,
      last_qualification: profile.last_qualification || null,
      bio: profile.bio || null,
    },
    summary,
    certificates: formattedCertificates,
    activities: formattedActivities,
    badges: activeBadges,
    skills: {
      credential_based: credentialBasedSkills,
      activity_based: activityBasedSkills,
      unified: unifiedSkills,
    },
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  buildStudentTranscript,
};
