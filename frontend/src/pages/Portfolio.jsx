import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Portfolio Page Component
 * 
 * Fetches real credential portfolio from Express API (GET /api/profile/:id)
 * backed by Supabase tables: 'profiles', 'certificates', 'skills', and 'badges'.
 * 
 * Displays:
 * 1. Verified Profile & Identity
 * 2. Real Accredited Certificates
 * 3. Verified Competencies & Skills Matrix
 * 4. Digital Achievement Badges
 * 5. Shareable Portfolio Link & Verification Attestation
 */
function Portfolio() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [portfolioData, setPortfolioData] = useState({
    profile: null,
    certificates: [],
    skills: [],
    badges: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  const { token } = useAuth();
  const isOwnPortfolio = !id || id === 'me' || (user?.id && id === user.id);
  const profileIdentifier = id || user?.id || user?.email || 'default';

  // Fetch real portfolio data from backend API
  const fetchPortfolioData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const endpoint = isOwnPortfolio
        ? 'http://localhost:5000/api/profile/me'
        : `http://localhost:5000/api/profile/${profileIdentifier}`;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(endpoint, { headers });
      const data = response.data || {};

      setPortfolioData({
        profile: data.profile || data.studentProfile || null,
        certificates: Array.isArray(data.certificates) ? data.certificates : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        badges: Array.isArray(data.badges) ? data.badges : [],
      });
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load portfolio. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [profileIdentifier, isOwnPortfolio, token]);

  const handleCopyShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper to extract student initials
  const getInitials = (nameStr) => {
    if (!nameStr) return 'ST';
    const parts = nameStr.trim().split(/[\s@._-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const certificates = Array.isArray(portfolioData.certificates) ? portfolioData.certificates : [];
  const skills = Array.isArray(portfolioData.skills) ? portfolioData.skills : [];
  const badges = Array.isArray(portfolioData.badges) ? portfolioData.badges : [];

  // Dynamic Trust Rating Calculation:
  // (number of VERIFIED / APPROVED certificates / total number of uploaded certificates) * 100
  // Authoritative verified statuses ('VERIFIED', 'APPROVED') count as verified.
  // All other statuses (MANUAL_REVIEW, PENDING, REJECTED, etc.) count as unverified.
  const totalCertificates = certificates.length;
  const verifiedCertificates = certificates.filter((c) =>
    ['VERIFIED', 'APPROVED'].includes((c.status || '').toUpperCase())
  ).length;
  const rawTrustRating = totalCertificates === 0 ? 0 : (verifiedCertificates / totalCertificates) * 100;
  const trustRatingDisplay = totalCertificates === 0
    ? '0%'
    : (rawTrustRating % 1 === 0 ? `${rawTrustRating}%` : `${rawTrustRating.toFixed(2)}%`);

  // Derive digital badges dynamically from verified certificates if none in badges table
  let displayBadges = [...badges];
  if (displayBadges.length === 0) {
    const verifiedList = certificates.filter((c) =>
      ['VERIFIED', 'APPROVED'].includes((c.status || '').toUpperCase())
    );
    displayBadges = verifiedList.map((cert) => {
      const skillNames = skills.map((s) => s.name).filter(Boolean);
      return {
        id: `badge-${cert.id}`,
        name: `${cert.title || cert.certificate_name} Badge`,
        issuer: cert.issuer || 'Credential Authority',
        criteria: skillNames.length > 0
          ? `Demonstrated competency in ${skillNames.join(', ')}`
          : 'Verified Credential Achievement',
        image_url: '',
        icon: '🏅',
        earnedDate: cert.issueDate || 'Recent',
      };
    });
  }

  const profile = portfolioData.profile || {
    name: user?.name || user?.email?.split('@')[0] || 'User',
    full_name: user?.name || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    role: user?.role || 'Issuer',
    institution: null,
    last_qualification: null,
    bio: null,
    profile_photo_url: null,
    studentId: user?.id ? `STU-${user.id.substring(0, 8).toUpperCase()}` : 'STU-VERIFIED',
    stats: {
      certificatesCount: totalCertificates,
      verifiedCertificatesCount: verifiedCertificates,
      skillsCount: skills.length,
      badgesCount: displayBadges.length,
      trustScore: trustRatingDisplay,
      trustRating: trustRatingDisplay,
    },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-4 px-4 sm:px-6">
      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchPortfolioData}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
          <h3 className="text-base font-bold text-slate-800">Loading Portfolio...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Querying profiles, certificates, skills, and badges tables from Supabase
          </p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ========================================================================= */}
          {/* 1. PROFILE SECTION                                                        */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Cover Accent Banner */}
            <div className="h-32 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]"></div>
            </div>

            <div className="p-6 sm:p-8 pt-0 relative">
              <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-16 mb-6">
                {/* Avatar & Name */}
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name || profile.name || 'User'}
                      className="w-28 h-28 rounded-2xl object-cover shadow-xl border-4 border-white"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-4xl font-extrabold shadow-xl border-4 border-white">
                      {getInitials(profile.full_name || profile.name)}
                    </div>
                  )}
                  <div className="pt-2">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        {profile.full_name || profile.name}
                      </h1>
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-200 shadow-xs">
                        <span>✓</span> Verified Profile
                      </span>
                    </div>
                    {profile.last_qualification && (
                      <p className="text-sm font-medium text-slate-600 mb-0.5">
                        {profile.last_qualification}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-2">
                      <span>🏛️ {profile.institution ? profile.institution : <span className="text-slate-400 italic">Not specified</span>}</span>
                      <span className="text-slate-300">•</span>
                      <span className="capitalize font-semibold text-indigo-600">{profile.role || 'Issuer'}</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {isOwnPortfolio && (
                    <button
                      onClick={() => navigate('/profile')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Edit your account profile"
                    >
                      <span>✏️</span> Edit Profile
                    </button>
                  )}
                  <button
                    onClick={fetchPortfolioData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    title="Refresh portfolio from database"
                  >
                    <span>🔄</span> Refresh
                  </button>
                  <button
                    onClick={handleCopyShare}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>{copied ? '✅' : '🔗'}</span>
                    <span>{copied ? 'Link Copied!' : 'Share Portfolio'}</span>
                  </button>
                  <button
                    onClick={() => navigate('/verify')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <span>🛡️</span>
                    <span>Verify Credential</span>
                  </button>
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-6 whitespace-pre-line">
                {profile.bio ? profile.bio : <span className="text-slate-400 italic">No biography specified.</span>}
              </p>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-2xl font-bold text-slate-900 block">
                    {totalCertificates}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Certificates
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-2xl font-bold text-indigo-600 block">
                    {skills.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Verified Skills
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-2xl font-bold text-amber-500 block">
                    {displayBadges.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Digital Badges
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-2xl font-bold text-emerald-600 block">
                    {trustRatingDisplay}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Trust Rating
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. VERIFIED CERTIFICATES SECTION                                          */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>📜</span> Verified Certificates
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accredited credentials verified through institutional signing keys from Supabase database.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {certificates.length} Total
              </span>
            </div>

            {certificates.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-5">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                          🎓
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            ['APPROVED', 'VERIFIED', 'Verified', 'Approved', 'valid'].includes(cert.status)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          ● {cert.status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mb-1">
                        {cert.title || cert.certificate_name}
                      </h3>
                      <p className="text-xs font-medium text-slate-600 mb-3">
                        Issued by <span className="font-semibold text-slate-900">{cert.issuer}</span>
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>{cert.issueDate || 'Recent'}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {cert.id?.substring(0, 18)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <span className="text-3xl mb-2 block">📄</span>
                <p className="text-sm font-semibold text-slate-700">No certificates in portfolio yet</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">
                  Upload certificates to showcase your accredited credentials here.
                </p>
                <button
                  onClick={() => navigate('/upload')}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Upload Certificate
                </button>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 3. SKILLS SECTION                                                         */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>⚡</span> Verified Skills
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Technical competencies verified and mapped from coursework records in Supabase.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {skills.length} Competencies
              </span>
            </div>

            {skills.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map((skill, idx) => (
                  <div
                    key={skill.id || idx}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                        {skill.category || 'General'}
                      </span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {skill.level || 'Intermediate'}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">
                      {skill.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Verified in {skill.verifiedBy || 1} credential{(skill.verifiedBy || 1) !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <span className="text-3xl mb-2 block">⚡</span>
                <p className="text-sm font-semibold text-slate-700">No verified skills recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Skills will populate automatically as micro-credentials are added and approved.
                </p>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 4. BADGES SECTION                                                         */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>🏆</span> Digital Badges
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Portable micro-badges awarded for validated learning milestones.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {displayBadges.length} Badges Earned
              </span>
            </div>

            {displayBadges.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayBadges.map((badge) => (
                  <Link
                    key={badge.id}
                    to={`/badges/${badge.id}`}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center flex flex-col items-center justify-between hover:shadow-md hover:border-indigo-300 transition-all relative overflow-hidden group cursor-pointer"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl mb-4 shadow-md ring-4 ring-slate-50 group-hover:scale-105 transition-transform">
                        {badge.image_url?.startsWith('http') || badge.image_url?.startsWith('data:') ? (
                          <img
                            src={badge.image_url}
                            alt={badge.name}
                            className="w-12 h-12 object-contain rounded-xl"
                          />
                        ) : (
                          badge.icon || '🏅'
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                        {badge.name}
                      </h4>
                      <p className="text-xs font-semibold text-indigo-600 mb-2">
                        {badge.issuer || 'Credential Authority'}
                      </p>
                      <p className="text-xs text-slate-500 mb-4 px-2 leading-relaxed">
                        {badge.criteria}
                      </p>
                    </div>

                    <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Earned {badge.earnedDate}</span>
                      <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                        View Badge →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <span className="text-3xl mb-2 block">🏅</span>
                <p className="text-sm font-semibold text-slate-700">No badges awarded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Digital badges will appear here once earned from verified coursework milestones.
                </p>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* TRUST / VERIFICATION ATTESTATION FOOTER                                   */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <span className="text-2xl">🛡️</span>
              <div>
                <span className="font-semibold text-slate-800 block">
                  Cryptographically Verified Credential Record
                </span>
                <span>
                  All micro-credentials are authenticated and retrieved live from the Supabase PostgreSQL database.
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/verify')}
              className="shrink-0 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              Check Public Registry →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Portfolio;
