// ==============================================================================
// Student Micro-Credential Verification Engine - Skills Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/skills
 * 
 * Purpose:
 * Fetches verified skills matrix earned strictly through the authenticated user's certificates.
 * 
 * Return fields:
 * - id
 * - name
 * - category
 * - level / proficiency_level
 * - verifiedCertificatesCount
 */
router.get(['/', '/api/skills'], requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    let skillsList = [];

    try {
      const query = `
        SELECT 
          s.id, 
          s.name, 
          s.category, 
          COUNT(cs.id)::int AS "verifiedCertificatesCount",
          COALESCE(MAX(cs.proficiency_level), 'Intermediate') AS proficiency_level
        FROM certificates c
        JOIN certificate_skills cs ON c.id = cs.certificate_id
        JOIN skills s ON cs.skill_id = s.id
        WHERE c.student_id = $1
        GROUP BY s.id, s.name, s.category
        ORDER BY s.name ASC;
      `;

      const result = await pool.query(query, [studentId]);

      skillsList = (result.rows || []).map((s) => {
        const topLevel = s.proficiency_level || 'Intermediate';
        const certCount = parseInt(s.verifiedCertificatesCount, 10) || 0;

        return {
          id: s.id,
          name: s.name,
          category: s.category || 'General',
          level: topLevel,
          proficiency_level: topLevel,
          verifiedCertificatesCount: certCount,
          verified_certificates_count: certCount,
        };
      });
    } catch (dbErr) {
      console.warn('Notice: Error querying user skills from PostgreSQL:', dbErr.message);
    }

    return res.status(200).json(skillsList);
  } catch (err) {
    console.error('Error fetching skills:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch skills',
    });
  }
});

module.exports = router;
