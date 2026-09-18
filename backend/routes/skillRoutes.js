// ==============================================================================
// Student Micro-Credential Verification Engine - Skills Routes
// ==============================================================================

const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/skills
 * 
 * Purpose:
 * Fetches skills matrix from Supabase tables:
 * - 'skills'
 * - 'certificate_skills'
 * 
 * Return fields:
 * - id
 * - name
 * - category
 * - level / proficiency_level
 * - verifiedCertificatesCount
 */
router.get(['/', '/api/skills'], async (req, res) => {
  try {
    let skillsList = [];

    if (supabase.isConfigured) {
      // 1. Try relational query joining skills with certificate_skills
      const { data, error } = await supabase
        .from('skills')
        .select(`
          id,
          name,
          category,
          created_at,
          certificate_skills (
            id,
            certificate_id,
            proficiency_level
          )
        `)
        .order('name', { ascending: true });

      if (!error && Array.isArray(data)) {
        skillsList = data.map((s) => {
          const certSkills = Array.isArray(s.certificate_skills) ? s.certificate_skills : [];
          const topLevel =
            certSkills.length > 0 && certSkills[0].proficiency_level
              ? certSkills[0].proficiency_level
              : 'Intermediate';

          return {
            id: s.id,
            name: s.name,
            category: s.category || 'General',
            level: topLevel,
            proficiency_level: topLevel,
            verifiedCertificatesCount: certSkills.length,
            verified_certificates_count: certSkills.length,
          };
        });
      } else {
        // Fallback: Query tables independently if FK relationships differ
        const [skillsRes, certSkillsRes] = await Promise.all([
          supabase.from('skills').select('id, name, category, created_at').order('name', { ascending: true }),
          supabase.from('certificate_skills').select('id, skill_id, proficiency_level'),
        ]);

        const rawSkills = Array.isArray(skillsRes.data) ? skillsRes.data : [];
        const rawCertSkills = Array.isArray(certSkillsRes.data) ? certSkillsRes.data : [];

        skillsList = rawSkills.map((s) => {
          const matches = rawCertSkills.filter((cs) => cs.skill_id === s.id);
          const topLevel =
            matches.length > 0 && matches[0].proficiency_level
              ? matches[0].proficiency_level
              : 'Intermediate';

          return {
            id: s.id,
            name: s.name,
            category: s.category || 'General',
            level: topLevel,
            proficiency_level: topLevel,
            verifiedCertificatesCount: matches.length,
            verified_certificates_count: matches.length,
          };
        });
      }
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
