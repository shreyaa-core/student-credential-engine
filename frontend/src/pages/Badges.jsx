import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Digital Badges & Verified Credential Report Page Component
 * 
 * Features:
 * - Real-time data from GET /api/badges/report
 * - Displays authenticated Issuer name & role
 * - Real count of strictly VERIFIED certificates
 * - Cards for verified certificates with issuing organization, issue date, and mapped skills
 * - Overall unique verified skills breakdown
 * - Dynamic Download button calling GET /api/badges/report/download
 * - Clean institutional empty state when 0 verified certificates exist
 */
function Badges() {
  const { user, token } = useAuth();

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // Fetch real-time verified credential report from API
  const fetchReport = async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!activeToken) {
      setIsLoading(false);
      setErrorMessage('Authentication required. Please log in to view verified credentials.');
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
      console.error('Failed to load verified credential report:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load verified credentials. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (activeToken) {
      fetchReport();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Trigger PDF download from backend endpoint
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

  // Safe fallback metadata
  const issuerName = report?.issuer?.fullName || user?.name || 'Issuer';
  const issuerRole = report?.issuer?.role || user?.role || 'Issuer';
  const verifiedCount = report?.verifiedCertificatesCount ?? 0;
  const verifiedCertificates = Array.isArray(report?.verifiedCertificates) ? report.verifiedCertificates : [];
  const overallSkills = Array.isArray(report?.overallSkills) ? report.overallSkills : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
              <span>🏅</span> Digital Badge System
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Digital Badges
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Verified credentials and skills earned through successfully verified certificates.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchReport}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh credentials from live database"
            >
              <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isDownloading ? '⏳' : '📥'}</span>
              <span>{isDownloading ? 'Generating PDF...' : 'Download Digital Badge Report'}</span>
            </button>
          </div>
        </div>

        {/* Issuer Details Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Issuer Name
            </span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {issuerName}
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Role
            </span>
            <p className="text-sm font-bold text-indigo-700 mt-0.5">
              {issuerRole}
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Report Status
            </span>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Dynamic Record
            </p>
          </div>
        </div>
      </div>

      {/* Error Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchReport}
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
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
          <h3 className="text-base font-bold text-slate-800">Loading verified credentials...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Querying authoritative PostgreSQL verification records
          </p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Verified Certificates
                </span>
                <span className="text-3xl font-black text-slate-900 block mt-1">
                  {verifiedCount}
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Authoritatively authenticated records
                </span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-2xl">
                📜
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Verified Skills
                </span>
                <span className="text-3xl font-black text-slate-900 block mt-1">
                  {overallSkills.length}
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Unique validated competencies
                </span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">
                ⚡
              </div>
            </div>
          </div>

          {/* Section 1: Verified Credentials */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  VERIFIED CREDENTIALS
                </h2>
                <p className="text-xs text-slate-500">
                  Total Verified Certificates: {verifiedCount}
                </p>
              </div>
              <Link
                to="/certificates"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All Uploads →
              </Link>
            </div>

            {verifiedCertificates.length === 0 ? (
              /* Empty State */
              <div className="py-14 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 sm:p-10 shadow-sm">
                <span className="text-4xl mb-3 block">🏅</span>
                <h3 className="text-base font-bold text-slate-800">
                  No verified credentials yet.
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-5 max-w-md mx-auto leading-relaxed">
                  Your digital badge report will appear here after a certificate has completed authoritative verification.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to="/upload"
                    className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
                  >
                    Upload Certificate
                  </Link>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    className="inline-block px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Download Digital Badge Report
                  </button>
                </div>
              </div>
            ) : (
              /* Verified Certificate Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {verifiedCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-slate-900 truncate" title={cert.certificateName}>
                            {cert.certificateName}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Issued by <span className="font-semibold text-slate-700">{cert.issuer || 'Not specified'}</span>
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          ● Verified
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold text-slate-400 uppercase text-[10px]">Issue Date</span>
                          <span className="font-medium text-slate-800">{cert.issueDate || 'Date not specified'}</span>
                        </div>
                      </div>

                      {/* Skills Learned */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          Skills Learned
                        </span>
                        {Array.isArray(cert.skills) && cert.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cert.skills.map((skill) => (
                              <span
                                key={skill.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                              >
                                <span>⚡</span>
                                <span>{skill.name}</span>
                                {skill.proficiencyLevel && (
                                  <span className="text-[10px] text-indigo-500 font-normal">
                                    ({skill.proficiencyLevel})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No specific skills mapped</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">badge-{cert.id?.substring(0, 8)}</span>
                        <Link
                          to={`/badges/badge-${cert.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          View Badge Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Overall Verified Skills */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                OVERALL VERIFIED SKILLS
              </h2>
              <p className="text-xs text-slate-500">
                Unique competencies extracted and confirmed across all verified credentials.
              </p>
            </div>

            {overallSkills.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                0 verified skills recorded yet.
              </p>
            ) : (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Badges;
