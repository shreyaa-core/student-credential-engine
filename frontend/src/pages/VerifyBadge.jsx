import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

/**
 * Public Open Badges 3.0 Verification Page Component
 * Route: /verify/badge/:credentialId
 * 
 * Verifies and inspects real OpenBadgeCredential records:
 * - Fetches cryptographic verification report from GET /api/badges/verify/:credentialId
 * - Shows cryptographic proof validity (eddsa-rdfc-2022)
 * - Shows source certificate current status
 * - Shows learner name, issuer profile, criteria, and mapped skills
 * - Offers direct download of authoritative JSON-LD OpenBadgeCredential
 */
function VerifyBadge() {
  const { credentialId } = useParams();

  const [verificationData, setVerificationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchBadgeVerification = async () => {
    if (!credentialId) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.get(
        `http://localhost:5000/api/badges/verify/${encodeURIComponent(credentialId.trim())}`
      );

      if (response.data && response.data.success) {
        setVerificationData(response.data);
      } else {
        throw new Error(response.data?.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Error verifying digital badge:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        `No digital badge found matching credential ID "${credentialId}".`;
      setErrorMessage(msg);
      setVerificationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBadgeVerification();
  }, [credentialId]);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!verificationData?.credentialJson) return;
    const jsonStr = JSON.stringify(verificationData.credentialJson, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-badge-${credentialId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isOverallValid = verificationData?.valid === true;
  const isProofValid = verificationData?.proofValid === true;
  const certStatus = verificationData?.sourceCertificateStatus || 'UNKNOWN';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mb-1">
            <span>🛡️</span> Open Badges 3.0 Verification
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Digital Badge Attestation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Independent cryptographic proof verification against the institution's public registry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            {copied ? '✓ Link Copied' : '🔗 Share Verification'}
          </button>
          <Link
            to="/verify"
            className="px-3.5 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
          >
            Verify Another →
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Verifying digital badge proof...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Evaluating Ed25519 cryptographic signature and source certificate records
          </p>
        </div>
      )}

      {/* Error state */}
      {!isLoading && errorMessage && (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-rose-200 p-8 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Verification Failed</h3>
            <p className="text-xs sm:text-sm text-rose-700 max-w-md mx-auto">
              {errorMessage}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/verify"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition"
            >
              Back to Verify Engine
            </Link>
          </div>
        </div>
      )}

      {/* Successful verification result */}
      {!isLoading && verificationData && (
        <div className="space-y-6">
          {/* Main Status Hero Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl shadow-sm shrink-0">
                  🏅
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {verificationData.badgeName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Awarded to <span className="font-semibold text-slate-800">{verificationData.studentName}</span>
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex flex-col items-start sm:items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isOverallValid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOverallValid ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  {isOverallValid ? '● Authentic Verified Badge' : '● Verification Inactive'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Format: Open Badges 3.0 (W3C VC)
                </span>
              </div>
            </div>

            {/* Verification Pillars Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
              {/* Pillar 1: Cryptographic Proof */}
              <div
                className={`p-4 rounded-xl border ${
                  isProofValid
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-rose-50/50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cryptographic Proof
                  </span>
                  <span className="text-sm">{isProofValid ? '🔐' : '❌'}</span>
                </div>
                <p
                  className={`text-sm font-bold ${
                    isProofValid ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {isProofValid ? 'Signature Valid' : 'Signature Verification Failed'}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isProofValid
                    ? 'DataIntegrityProof (eddsa-rdfc-2022) signature successfully verified against issuer public key.'
                    : 'The credential payload has been modified after signing or contains an invalid signature.'}
                </p>
              </div>

              {/* Pillar 2: Underlying Source Certificate */}
              <div
                className={`p-4 rounded-xl border ${
                  ['VERIFIED', 'APPROVED'].includes(certStatus)
                    ? 'bg-indigo-50/50 border-indigo-200'
                    : 'bg-amber-50/50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Source Certificate Status
                  </span>
                  <span className="text-sm">📜</span>
                </div>
                <p
                  className={`text-sm font-bold ${
                    ['VERIFIED', 'APPROVED'].includes(certStatus)
                      ? 'text-indigo-800'
                      : 'text-amber-800'
                  }`}
                >
                  {certStatus}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {['VERIFIED', 'APPROVED'].includes(certStatus)
                    ? 'Source certificate is active and authenticated in institutional database.'
                    : `Source certificate status is currently ${certStatus}. Badge validity reflects certificate state.`}
                </p>
              </div>
            </div>

            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100 mt-6 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                  Issued Date
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {verificationData.issuedAt
                    ? new Date(verificationData.issuedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Recent'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                  Badge Issuer
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate" title={verificationData.issuer}>
                  {verificationData.issuer}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                  Credential Identifier
                </span>
                <span
                  className="font-mono font-bold text-slate-800 mt-0.5 block truncate"
                  title={verificationData.credentialId}
                >
                  {verificationData.credentialId}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                  Proof Cryptosuite
                </span>
                <span className="font-mono font-bold text-indigo-700 mt-0.5 block truncate">
                  eddsa-rdfc-2022
                </span>
              </div>
            </div>
          </div>

          {/* Achievement & Criteria Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                ACHIEVEMENT & CRITERIA
              </h3>
              <p className="text-xs text-slate-500">
                Accredited learning achievement represented by this Open Badge.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-bold text-slate-900">
                  {verificationData.achievement?.name || verificationData.badgeName}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {verificationData.achievement?.description}
                </p>
              </div>

              {verificationData.achievement?.criteria && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Awarding Criteria:
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    {verificationData.achievement.criteria}
                  </p>
                </div>
              )}

              {/* Skills tags */}
              {Array.isArray(verificationData.skills) && verificationData.skills.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Verified Competencies ({verificationData.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {verificationData.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold"
                      >
                        <span>⚡</span>
                        <span>{skill}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical JSON-LD Download Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <h4 className="text-sm font-bold text-slate-900">
                Authoritative OpenBadgeCredential JSON-LD
              </h4>
              <p className="text-xs text-slate-500">
                Download the exact cryptographically signed Open Badges 3.0 document for wallet import.
              </p>
            </div>
            <button
              onClick={handleDownloadJson}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <span>📥</span> Download JSON-LD Credential
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyBadge;
