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
  const [badgeRecord, setBadgeRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const fetchBadgeDetails = async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!activeToken) {
      setIsLoading(false);
      setErrorMessage('Authentication required. Please log in to view badge details.');
      return;
    }

    const rawId = (badgeId || '').trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      setIsLoading(false);
      setErrorMessage('A valid badge identifier is required.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const reportPromise = axios.get('http://localhost:5000/api/badges/report', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      const cleanId = rawId.replace(/^badge-/, '');
      const badgePromise = axios
        .get(`http://localhost:5000/api/badges/${cleanId}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        })
        .catch(() => null);

      const [reportRes, badgeRes] = await Promise.all([reportPromise, badgePromise]);

      if (reportRes.data && reportRes.data.success && reportRes.data.report) {
        setReport(reportRes.data.report);
      } else {
        throw new Error('Unexpected response format received from report server.');
      }

      if (badgeRes && badgeRes.data) {
        setBadgeRecord(badgeRes.data);
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

  // Download raw Open Badges 3.0 JSON-LD credential file
  const handleDownloadJsonLd = () => {
    if (!badgeRecord?.credential_json) return;
    const jsonStr = JSON.stringify(badgeRecord.credential_json, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/ld+json' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `OpenBadge-${badgeRecord.credential_id || 'credential'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  };

  // Find the certificate matching the badgeId parameter or the badgeRecord's certificate_id
  const verifiedCerts = Array.isArray(report?.verifiedCertificates) ? report.verifiedCertificates : [];
  const cleanId = (badgeId || '').replace(/^badge-/, '');
  const targetCertId = badgeRecord?.certificate_id || badgeRecord?.certificateId;
  const matchedCert = verifiedCerts.find(
    (c) =>
      c.id === badgeId ||
      c.id === cleanId ||
      `badge-${c.id}` === badgeId ||
      (targetCertId && (c.id === targetCertId || `badge-${c.id}` === targetCertId))
  ) || (badgeRecord ? {
    id: badgeRecord.certificate_id || cleanId,
    certificateName: badgeRecord.certificate_name || badgeRecord.name?.replace(/\s+Badge$/i, '') || 'Verified Credential',
    issuer: badgeRecord.cert_issuer || badgeRecord.issuer || 'Bitwave Credential Engine',
    issueDate: badgeRecord.issued_at || badgeRecord.created_at,
    status: badgeRecord.cert_status || 'VERIFIED',
    skills: []
  } : null);

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
                  {matchedCert.issuer || badgeRecord?.cert_issuer || badgeRecord?.issuer || 'Bitwave Credential Engine'}
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

          {/* Section: Badge Verification */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
                  <span>✓</span> Verified Digital Credential
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Verify this digital badge
                </h2>
                <p className="text-xs text-slate-500">
                  Scan the QR code or use the verification buttons below to verify authenticity online.
                </p>
              </div>

              {badgeRecord?.credential_id && (
                <div className="flex items-center gap-2">
                  <Link
                    to={`/verify/badge/${badgeRecord.credential_id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <span>🔍</span> Verify Online →
                  </Link>
                  <button
                    onClick={handleDownloadJsonLd}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    title="Download raw Open Badges 3.0 JSON-LD credential"
                  >
                    <span>📄</span> Download JSON-LD
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                {badgeRecord?.qrCode ? (
                  <img
                    src={badgeRecord.qrCode}
                    alt="Badge Verification QR Code"
                    className="w-40 h-40 rounded-lg shadow-sm border border-slate-200 bg-white p-2"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-white text-slate-400 text-xs">
                    QR Not Available
                  </div>
                )}
                <span className="text-[11px] font-semibold text-slate-600 mt-3">
                  Scan to Verify Badge
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Points to public verification portal
                </span>
              </div>

              {/* Student-facing details: Credential ID & Public Verification Link */}
              <div className="md:col-span-2 space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Credential ID
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800 break-all mt-0.5 select-all">
                    {badgeRecord?.credential_id || 'Generating / Pending'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Public Verification Link
                  </span>
                  {badgeRecord?.credential_id ? (
                    <Link
                      to={`/verify/badge/${badgeRecord.credential_id}`}
                      className="text-xs font-mono text-indigo-600 hover:text-indigo-800 break-all block mt-0.5 underline"
                    >
                      {window.location.origin}/verify/badge/{badgeRecord.credential_id}
                    </Link>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-0.5">
                      Verification link available once badge is issued
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {badgeRecord?.credential_id && (
                    <>
                      <Link
                        to={`/verify/badge/${badgeRecord.credential_id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition-colors"
                      >
                        <span>🔍</span> Verify Online
                      </Link>
                      <button
                        onClick={handleDownloadJsonLd}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>📄</span> Download Credential
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Advanced Verification Details */}
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {showAdvancedDetails ? '▼' : '▶'}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    Advanced Verification Details
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                    (Open Badges 3.0, W3C VC v2.0, cryptographic proof)
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600">
                  {showAdvancedDetails ? 'Hide details' : 'Show details'}
                </span>
              </button>

              {showAdvancedDetails && (
                <div className="mt-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Standard & Specification
                      </span>
                      <p className="text-xs font-bold text-indigo-700 mt-0.5">
                        Open Badges 3.0
                      </p>
                      <span className="text-[10px] text-slate-500">
                        W3C VC v2.0 (Verifiable Credentials)
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Cryptosuite & Key Type
                      </span>
                      <p className="text-xs font-bold text-emerald-700 mt-0.5 font-mono">
                        eddsa-rdfc-2022
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Ed25519 Multikey Cryptographic Signature
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Cryptographic Proof Information
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Signed with W3C <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">DataIntegrityProof</code> using canonical RDF dataset canonicalization (RDFC-1.0) and Ed25519 digital signature.
                    </p>
                    {badgeRecord?.credential_json?.proof && (
                      <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600 space-y-0.5">
                        <div>
                          <span className="text-slate-400">proof.type:</span> {badgeRecord.credential_json.proof.type || 'DataIntegrityProof'}
                        </div>
                        <div>
                          <span className="text-slate-400">proof.cryptosuite:</span> {badgeRecord.credential_json.proof.cryptosuite || 'eddsa-rdfc-2022'}
                        </div>
                        {badgeRecord.credential_json.proof.created && (
                          <div>
                            <span className="text-slate-400">proof.created:</span> {badgeRecord.credential_json.proof.created}
                          </div>
                        )}
                        {badgeRecord.credential_json.proof.verificationMethod && (
                          <div className="truncate">
                            <span className="text-slate-400">proof.verificationMethod:</span> {badgeRecord.credential_json.proof.verificationMethod}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                    Issued by <span className="font-semibold text-slate-700">{matchedCert.issuer || badgeRecord?.cert_issuer || badgeRecord?.issuer || 'Bitwave Credential Engine'}</span>
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
