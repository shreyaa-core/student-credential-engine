import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyTranscript, downloadTranscriptPdf } from '../services/transcriptService';

/**
 * Co-Curricular Transcript Page Component (Step 6)
 * 
 * Formal verifiable transcript built from authoritative PostgreSQL data:
 * - Real Student Profile from PostgreSQL
 * - Strictly VERIFIED or APPROVED Certificates (never unverified/rejected)
 * - Co-Curricular Activities Log with derived skills
 * - Comprehensive Skills Taxonomy with clear source provenance
 * - Active Digital Badges (Open Badges 3.0) with public verification links
 * - Downloadable Publication-Quality PDF
 * - Browser Print Support
 */
function Transcript() {
  const { user, token } = useAuth();

  const [transcript, setTranscript] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const fetchTranscriptData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
      if (!activeToken) {
        setIsLoading(false);
        setErrorMessage('Authentication required. Please log in to view your transcript.');
        return;
      }

      const res = await getMyTranscript(activeToken);
      if (res && res.success && res.data) {
        setTranscript(res.data);
      } else {
        throw new Error('Unexpected transcript format received from server.');
      }
    } catch (err) {
      console.error('Failed to load transcript:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load official transcript. Ensure backend server is running.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscriptData();
  }, [token]);

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
      const studentName = transcript?.student?.full_name || user?.name || 'Student';
      await downloadTranscriptPdf(activeToken, studentName);
    } catch (err) {
      console.error('Failed to download transcript PDF:', err);
      setDownloadError('Unable to download transcript PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle Browser Print
  const handlePrint = () => {
    window.print();
  };

  const student = transcript?.student || {};
  const summary = transcript?.summary || {};
  const certificates = transcript?.certificates || [];
  const activities = transcript?.activities || [];
  const badges = transcript?.badges || [];
  const skills = transcript?.skills || {};
  const unifiedSkills = skills.unified || [];

  const studentName = student.full_name || user?.name || 'Student';
  const studentIdRef = student.id ? student.id.substring(0, 8).toUpperCase() : 'VERIFIED';
  const generatedDateStr = transcript?.generated_at
    ? new Date(transcript.generated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* Top Action Bar (hidden in print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>←</span> Back to Dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchTranscriptData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh transcript records"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            title="Print transcript"
          >
            <span>🖨️</span> Print
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading || isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isDownloading ? '⏳' : '📥'}</span>
            <span>{isDownloading ? 'Generating PDF...' : 'Download Official PDF'}</span>
          </button>
        </div>
      </div>

      {/* Error Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchTranscriptData}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {downloadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
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
          <h3 className="text-base font-bold text-slate-800">Generating Official Co-Curricular Transcript...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Assembling verified certificates, activity logs, and cryptographic badges from PostgreSQL
          </p>
        </div>
      )}

      {/* Main Transcript Document */}
      {!isLoading && transcript && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8 print:shadow-none print:border-none print:p-0">
          
          {/* Header Section */}
          <div className="border-b border-slate-200 pb-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
                <span>🏛️</span>
                <span>Official Co-Curricular & Credential Transcript</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Generated: <strong className="text-slate-700">{generatedDateStr}</strong>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {studentName}
              </h1>
              <p className="text-sm font-medium text-slate-600 mt-0.5">
                {student.institution ? (
                  <span>{student.institution}</span>
                ) : (
                  <span className="text-slate-400 italic">Affiliated Academic Institution</span>
                )}
                {student.last_qualification && (
                  <span className="text-slate-500"> • {student.last_qualification}</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1 font-mono">
              <span>Doc Ref: <strong className="text-slate-700">TRN-{studentIdRef}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Authoritative Record
              </span>
            </div>
          </div>

          {/* Summary Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Verified Credentials
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
                {summary.verified_certificates ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Recorded Activities
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
                {summary.activities ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Digital Badges
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
                {summary.digital_badges ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Unique Competencies
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-700 mt-0.5 block">
                {summary.total_unique_skills ?? 0}
              </span>
            </div>
          </div>

          {/* Section 1: Verified Credentials */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>📜</span> VERIFIED CREDENTIALS
                </h2>
                <p className="text-xs text-slate-500">
                  Certifications authoritatively verified against issuer registries or administratively approved.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {certificates.length} Verified
              </span>
            </div>

            {certificates.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No verified certificates recorded for this account yet.
              </div>
            ) : (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 transition-colors space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {cert.certificate_name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Issued by <strong className="text-slate-700">{cert.issuer}</strong>
                          {' • '}
                          {cert.issue_date ? (
                            <span>Issue Date: <strong className="text-slate-700">{cert.issue_date}</strong></span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Issue date not available
                              {cert.uploaded_at ? ` (Uploaded on ${cert.uploaded_at})` : ''}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ● {cert.status || 'Verified'}
                        </span>
                        {cert.verification_url && (
                          <a
                            href={cert.verification_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline print:hidden"
                          >
                            Verify Online →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Mapped Skills */}
                    {Array.isArray(cert.skills) && cert.skills.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                          Skills:
                        </span>
                        {cert.skills.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            <span>⚡</span>
                            <span>{s.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Co-Curricular Activities */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🎯</span> CO-CURRICULAR ACTIVITIES
                </h2>
                <p className="text-xs text-slate-500">
                  Recorded co-curricular engagements, hackathons, workshops, and project achievements.
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                {activities.length} Recorded
              </span>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No co-curricular activities recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {act.title}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-indigo-700 border border-slate-200 uppercase">
                            {act.activity_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {act.organizer && <span>Organized by <strong className="text-slate-700">{act.organizer}</strong> • </span>}
                          <span>Date: <strong className="text-slate-700">{act.activity_date || 'Not specified'}</strong></span>
                        </p>
                      </div>

                      {act.evidence_url && (
                        <a
                          href={act.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline print:hidden shrink-0"
                        >
                          View Evidence ↗
                        </a>
                      )}
                    </div>

                    {act.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {act.description}
                      </p>
                    )}

                    {/* Derived Activity Skills */}
                    {Array.isArray(act.skills) && act.skills.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                          Derived Skills:
                        </span>
                        {act.skills.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100"
                          >
                            <span>🎯</span>
                            <span>{s.name}</span>
                            {s.confidenceScore && (
                              <span className="text-[10px] text-violet-400 font-normal">
                                ({s.confidenceScore}%)
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Skills Summary & Provenance */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>⚡</span> SKILLS TAXONOMY & PROVENANCE
                </h2>
                <p className="text-xs text-slate-500">
                  Unique verified competencies confirmed through institutional credentials and recorded activities.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {unifiedSkills.length} Total
              </span>
            </div>

            {unifiedSkills.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                0 verified skills recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {unifiedSkills.map((sk) => {
                  const hasCert = sk.sources?.includes('Verified Certificate');
                  const hasAct = sk.sources?.includes('Activity');
                  return (
                    <div
                      key={sk.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{sk.name}</h4>
                          <span className="text-emerald-600 font-bold text-xs">✓</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{sk.category || 'General'}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1 text-[10px]">
                        {hasCert && hasAct ? (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-violet-50 text-violet-700 border border-violet-100">
                            Certificate + Activity
                          </span>
                        ) : hasCert ? (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Verified Certificate
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Activity Log
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 4: Digital Micro-Credentials */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🏅</span> DIGITAL MICRO-CREDENTIALS
                </h2>
                <p className="text-xs text-slate-500">
                  Active 1EdTech Open Badges 3.0 secured by Ed25519 Data Integrity Proofs.
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                {badges.length} Active
              </span>
            </div>

            {badges.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No active digital micro-credentials awarded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-2xl flex items-center justify-center shrink-0">
                        {b.image_url || '🏅'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{b.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Issued by {b.issuer || 'Credential Authority'}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 mt-1 truncate" title={b.credential_id}>
                          ID: {b.credential_id || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        Issued: {b.issued_at ? b.issued_at.split('T')[0] : 'Recent'}
                      </span>
                      {b.credential_id && (
                        <Link
                          to={`/verify/badge/${b.credential_id}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 underline print:hidden"
                        >
                          Verify Online →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer & Attestation */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>🛡️</span>
              <span>Cryptographically verified record • Automated Verification Engine</span>
            </div>
            <div className="font-mono text-[11px]">
              Doc Ref: TRN-{studentIdRef} • PostgreSQL Authoritative
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transcript;
