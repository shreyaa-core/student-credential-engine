import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * BadgeDetails Page Component
 * 
 * Displays the verified credential and digital badge details for a specific earned badge.
 * Sources data exclusively from the authenticated user's real-time report API:
 * GET /api/badges/report
 * 
 * Provides one-click download of the authentic Verified Credential Report PDF:
 * GET /api/badges/report/download
 */
function BadgeDetails() {
  const { badgeId } = useParams();
  const { user, token } = useAuth();

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const fetchBadgeDetails = async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!activeToken) {
      setIsLoading(false);
      setErrorMessage('Authentication required. Please log in to view badge details.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.get('http://localhost:5000/api/badges/report', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (response.data && response.data.success && response.data.report) {
        setReport(response.data.report);
      } else {
        throw new Error('Unexpected response format received from report server.');
      }
    } catch (err) {
      console.error('Failed to load badge details:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load badge details. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBadgeDetails();
  }, [badgeId, token]);

  // Handle PDF report download from backend service
  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

      const response = await axios.get('http://localhost:5000/api/badges/report/download', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'Verified-Credential-Report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download report PDF:', err);
      setDownloadError('Unable to download the report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Find the certificate matching the badgeId parameter
  const verifiedCerts = Array.isArray(report?.verifiedCertificates) ? report.verifiedCertificates : [];
  const cleanId = (badgeId || '').replace(/^badge-/, '');
  const matchedCert = verifiedCerts.find(
    (c) => c.id === badgeId || c.id === cleanId || `badge-${c.id}` === badgeId
  );

  const issuerName = report?.issuer?.fullName || user?.name || 'Issuer';
  const issuerRole = report?.issuer?.role || user?.role || 'Issuer';
  const verifiedCount = report?.verifiedCertificatesCount ?? 0;
  const overallSkills = Array.isArray(report?.overallSkills) ? report.overallSkills : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/badges"
          className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>←</span> Back to Digital Badges
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          {badgeId || 'Badge Details'}
        </span>
      </div>

      {/* Error Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchBadgeDetails}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {downloadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>⚠️</span>
            <span>{downloadError}</span>
          </div>
          <button
            onClick={() => setDownloadError(null)}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
          <h3 className="text-base font-bold text-slate-800">Loading badge details...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Querying authoritative PostgreSQL verification records
          </p>
        </div>
      )}

      {/* Badge Not Found State */}
      {!isLoading && !errorMessage && !matchedCert && (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mx-auto">
            🔍
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Badge not found</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              {verifiedCount === 0
                ? 'No verified credentials are currently available.'
                : 'The requested badge identifier does not match any of your verified credentials.'}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/badges"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Back to Digital Badges
            </Link>
          </div>
        </div>
      )}

      {/* Badge Details Content */}
      {!isLoading && matchedCert && (
        <div className="space-y-6">
          {/* Main Badge Hero Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-4xl shadow-md ring-4 ring-slate-50 shrink-0">
                  🏅
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-0.5">
                    <span>DIGITAL BADGE</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {matchedCert.certificateName} Badge
                  </h1>
                  <p className="text-xs text-slate-500">
                    Verified Credential Achievement
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ● {matchedCert.status || 'VERIFIED'}
                </span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{isDownloading ? '⏳' : '📥'}</span>
                  <span>{isDownloading ? 'Generating PDF...' : 'Download Digital Badge Report'}</span>
                </button>
              </div>
            </div>

            {/* Credential Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Issued To
                </span>
                <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                  {issuerName}
                </p>
                <span className="text-[10px] text-indigo-600 font-medium block">
                  {issuerRole}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Issuing Organization
                </span>
                <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                  {matchedCert.issuer || 'Credential Authority'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Verified Issuer
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Issue / Earned Date
                </span>
                <p className="text-xs font-bold text-slate-900 mt-1">
                  {matchedCert.issueDate || 'Recent'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Authoritative Record
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Badge Identifier
                </span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-1 truncate" title={badgeId}>
                  badge-{matchedCert.id?.substring(0, 8)}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium block">
                  Cryptographically Bound
                </span>
              </div>
            </div>
          </div>

          {/* Section: Verified Credential Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                VERIFIED CREDENTIALS
              </h2>
              <p className="text-xs text-slate-500">
                Coursework and certificate achievements mapped to this digital badge.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {matchedCert.certificateName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Issued by <span className="font-semibold text-slate-700">{matchedCert.issuer || 'Credential Authority'}</span>
                  </p>
                </div>
                <span className="self-start sm:self-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  ● Verified
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Skills Learned in this Credential
                </span>
                {Array.isArray(matchedCert.skills) && matchedCert.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchedCert.skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                      >
                        <span>⚡</span>
                        <span>{skill.name}</span>
                        {skill.category && (
                          <span className="text-[10px] text-indigo-400 font-normal">
                            • {skill.category}
                          </span>
                        )}
                        {skill.proficiencyLevel && (
                          <span className="text-[10px] text-indigo-500 font-medium ml-0.5">
                            ({skill.proficiencyLevel})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No individual skills listed</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Overall Verified Competencies */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                OVERALL VERIFIED SKILLS
              </h2>
              <p className="text-xs text-slate-500">
                Unique verified competencies confirmed across all accredited credentials ({overallSkills.length} total).
              </p>
            </div>

            {overallSkills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {overallSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {skill.name}
                      </p>
                      {skill.category && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {skill.category}
                        </p>
                      )}
                    </div>
                    <span className="text-emerald-600 font-bold text-xs shrink-0">✓</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                0 verified skills recorded yet.
              </p>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <h4 className="text-sm font-bold text-slate-800">
                Download Official Credential Report
              </h4>
              <p className="text-xs text-slate-500">
                Generate and download the authoritative PDF verification attestation.
              </p>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isDownloading ? '⏳' : '📥'}</span>
              <span>{isDownloading ? 'Generating PDF...' : 'Download Digital Badge Report'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BadgeDetails;
