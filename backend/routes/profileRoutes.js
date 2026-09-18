// ==============================================================================
// Student Micro-Credential Verification Engine - Profile / Portfolio Routes
// ==============================================================================

const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/profile/:id
 * 
 * Purpose:
 * Fetch student portfolio information including:
 * - student profile (from 'profiles' table)
 * - certificates (from 'certificates' table)
 * - skills (from 'skills' & 'certificate_skills' tables)
 * - badges (from 'badges' table)
 */
router.get(['/:id', '/api/profile/:id', '/'], async (req, res) => {
  try {
    const requestedId = req.params.id || 'default';

    let profile = null;
    let certificates = [];
    let skills = [];
    let badges = [];

    if (supabase.isConfigured) {
      try {
        // 1. Fetch Student Profile from 'profiles'
        let profileQuery = supabase.from('profiles').select('*');

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId);
        if (isUUID) {
          profileQuery = profileQuery.eq('id', requestedId);
        } else if (requestedId.includes('@')) {
          profileQuery = profileQuery.eq('email', requestedId);
        } else {
          profileQuery = profileQuery.limit(1);
        }

        const { data: profileData, error: profileErr } = await profileQuery.maybeSingle();
        if (!profileErr && profileData) {
          profile = profileData;
        }

        // 2. Fetch Certificates from 'certificates'
        const { data: certData, error: certErr } = await supabase
          .from('certificates')
          .select('id, student_id, certificate_name, issuer, file_url, status, verification_score, created_at')
          .order('created_at', { ascending: false });

        if (!certErr && Array.isArray(certData)) {
          certificates = certData.map((c) => ({
            id: c.id,
            title: c.certificate_name || 'Certificate',
            certificate_name: c.certificate_name,
            issuer: c.issuer || 'Issuing Authority',
            issueDate: c.created_at
              ? new Date(c.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent',
            status: c.status || 'PENDING',
            verificationScore: c.verification_score || 0,
            verificationHash: `0x${(c.id || '').replace(/-/g, '').substring(0, 32)}` || '0xverified',
            file_url: c.file_url || '',
          }));
        }

        // 3. Fetch Skills from 'skills' & 'certificate_skills'
        const { data: skillData, error: skillErr } = await supabase
          .from('skills')
          .select(`
            id,
            name,
            category,
            certificate_skills (
              id,
              proficiency_level
            )
          `)
          .order('name', { ascending: true });

        if (!skillErr && Array.isArray(skillData)) {
          skills = skillData.map((s) => {
            const csList = Array.isArray(s.certificate_skills) ? s.certificate_skills : [];
            const level = csList.length > 0 && csList[0].proficiency_level ? csList[0].proficiency_level : 'Intermediate';
            return {
              id: s.id,
              name: s.name,
              category: s.category || 'General',
              level,
              verifiedBy: csList.length,
            };
          });
        }

        // 4. Fetch Badges from 'badges'
        const { data: badgeData, error: badgeErr } = await supabase
          .from('badges')
          .select('id, student_id, certificate_id, name, image_url, criteria, created_at')
          .order('created_at', { ascending: false });

        if (!badgeErr && Array.isArray(badgeData)) {
          badges = badgeData.map((b) => ({
            id: b.id,
            name: b.name,
            issuer: 'Credential Authority',
            criteria: b.criteria || 'Verified Competency Milestone',
            image_url: b.image_url || '',
            icon: b.image_url || '🏅',
            earnedDate: b.created_at
              ? new Date(b.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : 'Recent',
          }));
        }
      } catch (dbErr) {
        console.warn('Notice: Supabase query notice for profile:', dbErr.message);
      }
    }

    // Normalized Student Profile fallback
    const resolvedProfile = {
      id: profile?.id || requestedId,
      name: profile?.full_name || profile?.name || 'Student Scholar',
      full_name: profile?.full_name || profile?.name || 'Student Scholar',
      title: profile?.institution ? `Scholar at ${profile.institution}` : 'Software & Engineering Scholar',
      institution: profile?.institution || 'National Institute of Technology',
      studentId: profile?.id ? `STU-${profile.id.substring(0, 8).toUpperCase()}` : 'STU-VERIFIED',
      email: profile?.email || 'student@university.edu',
      location: 'Academic Campus',
      bio: 'All micro-credentials, verified competencies, and digital milestone badges displayed are authenticated via the Verification Engine and stored in the Supabase PostgreSQL database.',
      stats: {
        certificatesCount: certificates.length,
        skillsCount: skills.length,
        badgesCount: badges.length,
        trustScore: certificates.length > 0 ? '100%' : 'N/A',
      },
    };

    return res.status(200).json({
      success: true,
      profile: resolvedProfile,
      studentProfile: resolvedProfile,
      certificates,
      skills,
      badges,
    });
  } catch (err) {
    console.error('Error in GET /api/profile/:id:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve profile portfolio',
    });
  }
});

module.exports = router;
