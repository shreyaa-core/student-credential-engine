// ==============================================================================
// Student Micro-Credential Verification Engine - Dashboard Routes
// ==============================================================================

const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/dashboard
 * 
 * Purpose:
 * Fetch real-time aggregated dashboard metrics and summary from Supabase database tables:
 * - certificates (total, verified, pending)
 * - skills (skills earned)
 * - badges (badges earned)
 * 
 * Return JSON:
 * {
 *   totalCertificates: number,
 *   verifiedCertificates: number,
 *   pendingCertificates: number,
 *   skillsEarned: number,
 *   badgesEarned: number,
 *   recentCertificates: array,
 *   latestBadges: array
 * }
 */
router.get(['/', '/api/dashboard'], async (req, res) => {
  try {
    let totalCertificates = 0;
    let verifiedCertificates = 0;
    let pendingCertificates = 0;
    let skillsEarned = 0;
    let badgesEarned = 0;
    let recentCertificates = [];
    let latestBadges = [];

    // Query Supabase tables if configured
    if (supabase.isConfigured) {
      try {
        // 1. Fetch certificates from Supabase
        const { data: certs, error: certErr } = await supabase
          .from('certificates')
          .select('id, certificate_name, issuer, status, verification_score, created_at')
          .order('created_at', { ascending: false });

        if (!certErr && Array.isArray(certs)) {
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
            issuer: c.issuer || 'Issuing Authority',
            issueDate: c.created_at
              ? new Date(c.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recently',
            status: c.status || 'PENDING',
            verificationScore: c.verification_score || 0,
          }));
        }

        // 2. Fetch skills count from Supabase
        const { count: skillCount, error: skillErr } = await supabase
          .from('skills')
          .select('*', { count: 'exact', head: true });

        if (!skillErr && typeof skillCount === 'number') {
          skillsEarned = skillCount;
        }

        // 3. Fetch badges from Supabase
        const { data: badgeList, count: badgeCount, error: badgeErr } = await supabase
          .from('badges')
          .select('id, name, criteria, image_url, created_at')
          .order('created_at', { ascending: false });

        if (!badgeErr && Array.isArray(badgeList)) {
          badgesEarned = badgeCount !== null && badgeCount !== undefined ? badgeCount : badgeList.length;
          latestBadges = badgeList.slice(0, 4).map((b) => ({
            id: b.id,
            name: b.name || 'Micro-Credential Badge',
            criteria: b.criteria || 'Verified Milestone',
            imageUrl: b.image_url || '',
            earnedDate: b.created_at
              ? new Date(b.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : 'Recently',
          }));
        }
      } catch (dbQueryErr) {
        console.warn('Notice: Error executing Supabase query for dashboard metrics:', dbQueryErr.message);
      }
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
    console.error('Error fetching dashboard statistics:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch dashboard data',
    });
  }
});

module.exports = router;
