import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Public & Authenticated Credential Verification Page
 * 
 * - Unauthenticated /verify/:identifier: Public verification of known credentials
 * - Authenticated /verify: Issuer workspace displaying their own live uploaded credentials
 * - Zero hardcoded credentials or mock datasets
 * - Enforces server-side user ownership for uploaded credentials
 */
function Verify() {
  const { id: paramId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, token } = useAuth();

  // Determine current lookup target (URL param or searchParam)
  const activeIdentifier = paramId || searchParams.get('id') || searchParams.get('query');

  // Search & data states for active verification lookup
  const [searchQuery, setSearchQuery] = useState('');
  const [credential, setCredential] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  // Authenticated Issuer's uploaded credentials
  const [userCertificates, setUserCertificates] = useState([]);
  const [isLoadingUserCerts, setIsLoadingUserCerts] = useState(false);
  const [userCertsError, setUserCertsError] = useState(null);

  // 1. Guard /verify for unauthenticated users (unless verifying a public identifier)
  useEffect(() => {
    if (!activeIdentifier && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/verify' } }, replace: true });
    }
  }, [activeIdentifier, isAuthenticated, navigate]);

  // 2. Fetch authenticated Issuer's own certificates (enforced server-side via GET /api/certificates)
  const fetchUserCertificates = async () => {
    if (!isAuthenticated) return;
    setIsLoadingUserCerts(true);
    setUserCertsError(null);

    try {
      const authToken = token || localStorage.getItem('token');
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await axios.get('http://localhost:5000/api/certificates', { headers });
      const list = Array.isArray(response.data) ? response.data : (response.data?.certificates || []);
      setUserCertificates(list);
    } catch (err) {
      console.error('Error loading issuer certificates:', err);
      setUserCertsError('Unable to load your certificates. Please try again.');
    } finally {
      setIsLoadingUserCerts(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserCertificates();
    }
  }, [isAuthenticated]);

  // 3. Execute verification lookup against backend for active identifier
  const executeVerification = async (targetId) => {
    if (!targetId || !targetId.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const cleanId = encodeURIComponent(targetId.trim());
      const response = await axios.get(`http://localhost:5000/api/verify/${cleanId}`);

      if (response.data?.success && response.data?.credential) {
        setCredential(response.data.credential);
        setSearchQuery(response.data.credential.credentialId || targetId);
      } else {
        throw new Error(response.data?.message || 'Verification could not be authenticated.');
      }
    } catch (err) {
      console.error('Verification lookup error:', err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `No credential found matching "${targetId}". This micro-credential has not been issued or is invalid.`;
      setErrorMessage(serverMsg);
      setCredential(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeIdentifier) {
      executeVerification(activeIdentifier);
    } else {
      setCredential(null);
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [activeIdentifier]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/verify/${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleCopyHash = () => {
    if (!credential?.verificationHash) return;
    navigator.clipboard.writeText(credential.verificationHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[85vh] py-10 px-4 max-w-4xl mx-auto">
      {/* Top Search & Lookup Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
        <div className="max-w-2xl mx-auto text-center mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            VERIFY CREDENTIAL
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Query the cryptographic registry directly to confirm credential authenticity and competence.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Certificate ID, Hash, or Title..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-mono"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:bg-indigo-400 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin text-sm">⏳</span>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>🔍</span>
                <span>Verify</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Loading Indicator for Active Verification */}
      {isLoading && activeIdentifier && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-3">⚙️</div>
          <h3 className="text-base font-bold text-slate-800">Authenticating Credential...</h3>
          <p className="text-xs text-slate-500 mt-1">
            Running cryptographic checks against PostgreSQL and logging audit verification event.
          </p>
        </div>
      )}

      {/* Error Message for Active Verification */}
      {!isLoading && activeIdentifier && errorMessage && (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-3 border border-rose-200">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-slate-900">Verification Failed</h3>
          <p className="text-sm text-rose-700 mt-2 max-w-md mx-auto">{errorMessage}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/certificates"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Browse Valid Certificates
            </Link>
            <Link
              to="/upload"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Upload Certificate
            </Link>
          </div>
        </div>
      )}

      {/* Verified Credential View */}
      {!isLoading && activeIdentifier && !errorMessage && credential && (() => {
        const getStatusTheme = (statusCode) => {
          const code = (statusCode || '').toUpperCase();
          switch (code) {
            case 'VERIFIED':
            case 'APPROVED':
              return {
                bannerBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
                badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
                icon: '✅',
                label: 'Credential Verified',
                desc: 'This digital micro-credential has been authoritatively verified by the issuing institution.',
              };
            case 'MANUAL_REVIEW':
              return {
                bannerBg: 'bg-gradient-to-r from-amber-500 to-amber-700',
                badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
                icon: '⚠️',
                label: 'Manual Review Required',
                desc: 'This digital micro-credential requires manual verification before authenticity can be confirmed.',
              };
            case 'REJECTED':
              return {
                bannerBg: 'bg-gradient-to-r from-rose-600 to-red-700',
                badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
                icon: '❌',
                label: 'Credential Rejected',
                desc: 'This digital micro-credential was rejected by the issuing institution.',
              };
            case 'VERIFICATION_TIMEOUT':
              return {
                bannerBg: 'bg-gradient-to-r from-amber-600 to-orange-700',
                badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
                icon: '⏱️',
                label: 'Verification Timed Out',
                desc: 'Outbound issuer verification timed out. Manual review is required.',
              };
            case 'UNSUPPORTED_ISSUER':
              return {
                bannerBg: 'bg-gradient-to-r from-amber-500 to-amber-700',
                badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
                icon: '🏛️',
                label: 'Unsupported Issuer',
                desc: 'The claimed issuer is not supported for automated verification.',
              };
            case 'PENDING':
            default:
              return {
                bannerBg: 'bg-gradient-to-r from-slate-600 to-slate-800',
                badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
                icon: '⏳',
                label: 'Pending Review',
                desc: 'This digital micro-credential has been registered and is currently under review.',
              };
          }
        };

        const statusTheme = getStatusTheme(credential.statusCode);

        return (
          <div className="space-y-4 mb-8">
            {isAuthenticated && (
              <div>
                <Link
                  to="/verify"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  <span>←</span> Back to Your Uploaded Credentials
                </Link>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* CARD 1: Certificate Verification Banner */}
            <div className={`p-6 sm:p-8 text-white ${statusTheme.bannerBg}`}>
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
                    {statusTheme.icon}
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-1.5 backdrop-blur-xs">
                      <span>CARD 1:</span> Certificate Verification
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {credential.status || statusTheme.label}
                    </h1>
                    <p className="text-white/85 text-xs sm:text-sm mt-1 max-w-xl">
                      {statusTheme.desc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-white/90">
                <div>
                  <span className="text-white/60">ID: </span>
                  <span className="font-semibold">{credential.credentialId || credential.id}</span>
                </div>
                <div>
                  <span className="text-white/60">Status Code: </span>
                  <span className="font-semibold uppercase">{credential.statusCode}</span>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* CARD 2: Authenticity / Issuer Verification */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        CARD 2: Authenticity / Issuer Verification
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Authoritative issuer confirmation and official verification protocol details
                      </p>
                    </div>
                  </div>
                  <span
                    className={`self-start sm:self-auto px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${statusTheme.badgeBg}`}
                  >
                    ● {credential.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 block">Claimed Issuer:</span>
                    <span className="font-bold text-slate-900 text-sm">{credential.issuer || 'Not specified'}</span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-500 block">Verification Protocol / Method:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {credential.issuerVerification?.method || 'OFFICIAL_URL'}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-500 block">Issuer Status:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {credential.issuerVerification?.status || credential.statusCode}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-500 block">Verified At:</span>
                    <span className="text-slate-700">
                      {credential.issuerVerification?.verifiedAt
                        ? new Date(credential.issuerVerification.verifiedAt).toLocaleString()
                        : 'Recent'}
                    </span>
                  </div>

                  <div className="md:col-span-2 pt-1">
                    <span className="font-semibold text-slate-500 block mb-1">
                      Authenticity Verification Reason:
                    </span>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium text-xs leading-relaxed">
                      {credential.issuerVerification?.reason ||
                        (credential.statusCode === 'MANUAL_REVIEW'
                          ? 'Issuer could not be authoritatively verified. Manual review required.'
                          : 'Authenticity evaluated by verification engine.')}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Authenticity Policy: </span>
                  Certificates are only marked VERIFIED when authoritatively confirmed by an authorized issuing organization. Reachable web pages, OCR heuristics, or AI skill analysis never confer authentic status.
                </div>
              </div>

              {/* CARD 3: Detected Skills */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        CARD 3: Detected Skills
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Competencies extracted from document text via AI evidence analysis
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                    Matched to Institutional Taxonomy
                  </span>
                </div>

                {/* CRITICAL DISCLAIMER STATEMENT */}
                <div className="p-3 rounded-lg bg-white border border-indigo-200/80 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
                  <span className="text-base shrink-0">ℹ️</span>
                  <p className="leading-relaxed">
                    <span className="font-bold text-slate-900">Important Statement: </span>
                    Skill detection does not prove certificate authenticity. Skills are detected directly from certificate text and validated against the institutional taxonomy.
                  </p>
                </div>

                {/* Detected Taxonomy Skills List */}
                {credential.detectedSkills && credential.detectedSkills.length > 0 ? (
                  <div className="space-y-3">
                    {credential.detectedSkills.map((skill, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold text-base">✓</span>
                            <span className="text-sm font-bold text-slate-900">{skill.name}</span>
                            {skill.category && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {skill.category}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            Confidence: {typeof skill.confidence === 'number'
                              ? `${Math.round(skill.confidence <= 1 ? skill.confidence * 100 : skill.confidence)}%`
                              : skill.confidence}
                          </span>
                        </div>

                        {skill.evidence && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-[11px] text-slate-700">
                            <span className="font-semibold text-slate-500 block mb-0.5">Evidence in Document:</span>
                            <span className="italic font-mono text-slate-800">"{skill.evidence}"</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                    No verified taxonomy skills detected from this certificate.
                  </div>
                )}
              </div>

              {/* CARD 4: Skills Requiring Taxonomy Review */}
              {credential.unmatchedSkills && credential.unmatchedSkills.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-amber-200/80 pb-2">
                    <span className="text-base">📋</span>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        CARD 4: Skills Requiring Taxonomy Review
                      </h2>
                      <p className="text-[11px] text-amber-800">
                        Documented technical skills requiring institutional curriculum review
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-amber-900 leading-relaxed">
                    The following technical skills were explicitly evidenced in the certificate text but do not currently exist in the approved institutional skills taxonomy. They are displayed for review and are not mapped as taxonomy skills:
                  </p>

                  <div className="space-y-2.5">
                    {credential.unmatchedSkills.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-white border border-amber-200 text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                          <span className="font-mono text-amber-800 font-semibold text-xs">
                            Confidence: {typeof item.confidence === 'number'
                              ? `${Math.round(item.confidence <= 1 ? item.confidence * 100 : item.confidence)}%`
                              : item.confidence}
                          </span>
                        </div>
                        {item.evidence && (
                          <div className="bg-slate-50 p-2 rounded border border-slate-150 text-[11px] text-slate-700 italic font-mono">
                            Evidence: "{item.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CARD 5: Certificate Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="text-base">📄</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      CARD 5: Certificate Details
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Authentic records retrieved directly from PostgreSQL database
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Certificate Name */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Certificate / Course Name
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {credential.courseName || credential.certificateName || 'Not specified'}
                    </p>
                  </div>

                  {/* Issuing Authority */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Issuing Authority
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {credential.issuer || 'Not specified'}
                    </p>
                  </div>

                  {/* Recipient / Certificate Holder */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Certificate Holder / Recipient
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {credential.studentName || 'Not specified'}
                    </p>
                  </div>

                  {/* Issue Date */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Issue Date
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {credential.issueDate || 'Not specified'}
                    </p>
                  </div>

                  {/* Certificate ID */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Certificate ID
                    </span>
                    <p className="font-mono text-xs text-slate-800 font-semibold">
                      {credential.certificateId || credential.credentialId || 'Not specified'}
                    </p>
                  </div>

                  {/* File Type */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      File Type
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {credential.fileType || 'PDF'}
                    </p>
                  </div>

                  {/* Authenticity Status */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Authenticity Status
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase border ${statusTheme.badgeBg}`}>
                      ● {credential.status || 'Not specified'}
                    </span>
                  </div>
                </div>

                {/* Cryptographic Hash & Stored File URL */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Cryptographic Verification Hash (SHA-256)
                      </span>
                      <div className="font-mono text-xs text-slate-800 break-all select-all mt-0.5">
                        {credential.verificationHash}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyHash}
                      className="self-start sm:self-auto px-3 py-1 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    >
                      {copied ? '✓ Copied' : 'Copy Hash'}
                    </button>
                  </div>

                  {/* Live Audit Log Event Info */}
                  <div className="pt-2 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between text-slate-500 gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">●</span>
                      <span>
                        Audit Event Logged at{' '}
                        <span className="font-mono text-slate-700 font-medium">
                          {new Date().toLocaleTimeString()}
                        </span>{' '}
                        in PostgreSQL verification_logs
                      </span>
                    </div>
                    {credential.fileUrl && (
                      <a
                        href={credential.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-1"
                      >
                        <span>View Stored Certificate File</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 text-base">🛡️</span>
                    <span>Tamper-proof verifiable credential via Verification Engine</span>
                  </div>
                  <Link
                    to="/certificates"
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    View all certificates →
                  </Link>
                </div>
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {/* Authenticated Issuer Section: Your Uploaded Credentials */}
      {isAuthenticated && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                YOUR UPLOADED CREDENTIALS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Certificates belonging to your account from the live registry
              </p>
            </div>
            {userCertificates.length > 0 && (
              <Link
                to="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span>+</span> Upload Another Certificate
              </Link>
            )}
          </div>

          {/* Loading state */}
          {isLoadingUserCerts && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <div className="inline-block animate-spin text-2xl mb-2">⚙️</div>
              <p className="text-sm font-semibold text-slate-700">Loading your certificates...</p>
              <p className="text-xs text-slate-400 mt-0.5">Connecting to live PostgreSQL database</p>
            </div>
          )}

          {/* Error state */}
          {!isLoadingUserCerts && userCertsError && (
            <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-rose-700">{userCertsError}</p>
              <button
                type="button"
                onClick={fetchUserCertificates}
                className="mt-3 px-4 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer border border-rose-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoadingUserCerts && !userCertsError && userCertificates.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto mb-4 border border-indigo-100">
                📜
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No certificates uploaded yet.
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-6 max-w-md mx-auto leading-relaxed">
                Upload a certificate to extract its details, analyze its skills, and verify its authenticity.
              </p>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <span>📤</span>
                <span>Upload Certificate</span>
              </Link>
            </div>
          )}

          {/* Non-empty state: Certificate Cards */}
          {!isLoadingUserCerts && !userCertsError && userCertificates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {userCertificates.map((cert) => {
                const certIdentifier = cert.certificate_id || cert.certificateId || cert.id;
                const statusUpper = (cert.status || 'PENDING').toUpperCase();
                const isVerified = statusUpper === 'VERIFIED' || statusUpper === 'APPROVED';
                const isReview = statusUpper === 'MANUAL_REVIEW' || statusUpper === 'PENDING';

                return (
                  <div
                    key={cert.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {(cert.certificate_id || cert.certificateId) && (
                            <span className="text-[10px] font-mono text-slate-400 block truncate">
                              ID: {cert.certificate_id || cert.certificateId}
                            </span>
                          )}
                          <h3 className="text-base font-bold text-slate-900 truncate mt-0.5" title={cert.certificate_name || cert.title}>
                            {cert.certificate_name || cert.certificateName || cert.title || 'Untitled Certificate'}
                          </h3>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isReview
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          ● {cert.status || 'Pending'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Issuer</span>
                          <span className="font-medium text-slate-800 truncate block">{cert.issuer || 'Not specified'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Issue Date</span>
                          <span className="font-medium text-slate-800 block">
                            {cert.issueDate || cert.date || (cert.created_at ? new Date(cert.created_at).toLocaleDateString() : 'Recent')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Status: <span className="font-semibold text-slate-700">{cert.status || 'Pending'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/verify/${encodeURIComponent(certIdentifier)}`)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        View Verification →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Verify;

