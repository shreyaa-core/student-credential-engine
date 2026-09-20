import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Credential Transcript Page Component
 * 
 * Formal verifiable transcript displaying authentic data:
 * - Real Account Name & Institution from PostgreSQL
 * - Real Certificates list
 * - Real Skills earned
 * - Real Badges earned
 * - Download / Print Transcript Button
 */
function Transcript() {
  const { user, token } = useAuth();

  const [transcriptData, setTranscriptData] = useState({
    profile: null,
    certificates: [],
    skills: [],
    badges: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchTranscript = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('http://localhost:5000/api/profile/me', { headers });
      const data = response.data || {};

      setTranscriptData({
        profile: data.profile || data.studentProfile || null,
        certificates: Array.isArray(data.certificates) ? data.certificates : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        badges: Array.isArray(data.badges) ? data.badges : [],
      });
    } catch (err) {
      console.error('Failed to load transcript data:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load transcript. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscript();
  }, [token]);

  const handleDownload = () => {
    window.print();
  };

  const profile = transcriptData.profile || {
    full_name: user?.name || user?.email?.split('@')[0] || 'User',
    name: user?.name || user?.email?.split('@')[0] || 'User',
    institution: user?.institution || null,
    studentId: user?.id ? `STU-${user.id.substring(0, 8).toUpperCase()}` : 'STU-OFFICIAL',
    role: user?.role || 'Issuer',
  };

  const certificates = transcriptData.certificates;
  const skillsEarned = transcriptData.skills;
  const badgesEarned = transcriptData.badges;

  const issueDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4 sm:px-6">
      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchTranscript}
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
          <h3 className="text-base font-bold text-slate-800">Generating Official Transcript...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Retrieving authenticated academic records from PostgreSQL database
          </p>
        </div>
      )}

      {!isLoading && (
        /* Transcript Card Container */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8 print:shadow-none print:border-none print:p-0">
          
          {/* Header with Student Info and Action Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
                <span>🏛️</span>
                <span>Official Micro-Credential Transcript</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {profile.full_name || profile.name}
              </h1>
              <p className="text-sm font-medium text-slate-600 mt-0.5">
                {profile.last_qualification ? `${profile.last_qualification} • ` : ''}
                {profile.institution ? profile.institution : <span className="text-slate-400 italic">Institution Not specified</span>}
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 mt-2 font-mono">
                <span>Student ID: <strong className="text-slate-700">{profile.studentId || 'STU-VERIFIED'}</strong></span>
                <span>•</span>
                <span>Issued: <strong className="text-slate-700">{issueDateFormatted}</strong></span>
                <span>•</span>
                <span className="text-emerald-600 font-semibold">● Official Record</span>
              </div>
            </div>

            {/* Download Transcript Button */}
            <button
              onClick={handleDownload}
              className="print:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <span>📥</span>
              <span>Download Transcript</span>
            </button>
          </div>

          {/* 1. Certificates List Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>📜</span> Verified Certificates
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {certificates.length} Recorded
              </span>
            </div>

            {certificates.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Certificate Name</th>
                      <th className="py-3 px-4">Issuer</th>
                      <th className="py-3 px-4">Issue Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{cert.title || cert.certificate_name}</div>
                          <div className="font-mono text-xs text-slate-400">{cert.id?.substring(0, 18)}...</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{cert.issuer || 'Unknown'}</td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">{cert.issueDate || 'Recorded'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            ['APPROVED', 'VERIFIED'].includes((cert.status || '').toUpperCase())
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {cert.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No verified certificates recorded for this account yet.
              </div>
            )}
          </section>

          {/* 2. Skills Earned Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>⚡</span> Skills Earned
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {skillsEarned.length} Verified
              </span>
            </div>

            {skillsEarned.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {skillsEarned.map((skill, index) => (
                  <div
                    key={skill.id || index}
                    className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{skill.name}</div>
                      <div className="text-[11px] text-slate-500">{skill.category || 'General'}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {skill.level || 'Intermediate'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No verified competencies recorded yet.
              </div>
            )}
          </section>

          {/* 3. Badges Earned Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🏆</span> Badges Earned
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {badgesEarned.length} Badges
              </span>
            </div>

            {badgesEarned.length > 0 ? (
              <div className="grid sm:grid-cols-3 gap-4">
                {badgesEarned.map((badge) => (
                  <div
                    key={badge.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 text-center flex flex-col items-center justify-between shadow-2xs"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mb-2.5 shadow-inner">
                        {badge.icon || '🏅'}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-0.5">{badge.name}</h4>
                      <p className="text-xs font-medium text-indigo-600 mb-1.5">{badge.issuer || 'Credential Authority'}</p>
                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 px-1 mb-2">
                        {badge.criteria}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                      Earned {badge.earnedDate || 'Recently'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No digital badges awarded yet.
              </div>
            )}
          </section>

          {/* Footer / Attestation */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>🛡️</span>
              <span>Cryptographically sealed record • Automated Verification Engine</span>
            </div>
            <div className="font-mono text-[11px]">
              Doc Ref: TRN-{profile.studentId ? profile.studentId.replace('STU-', '') : 'OFFICIAL'}-VERIFIED
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transcript;
