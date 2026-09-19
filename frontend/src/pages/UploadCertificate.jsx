import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadCertificate } from '../services/certificateService';
import { useAuth } from '../context/AuthContext';

/**
 * UploadCertificate Page Component
 * 
 * Production Flow:
 * React Form -> Express API (/api/certificates/upload) -> Supabase Storage ('certificates') -> PostgreSQL ('certificates')
 * 
 * Displays:
 * - Real upload result card upon completion:
 *   - Certificate ID (from Supabase DB)
 *   - Student ID
 *   - File URL (from Supabase Storage)
 *   - File Type
 *   - Status & Verification Score
 *   - Verification Checks breakdown
 */
function UploadCertificate() {
  const { user } = useAuth();

  const [certificateName, setCertificateName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [file, setFile] = useState(null);

  // Status states
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleReset = () => {
    setCertificateName('');
    setIssuer('');
    setFile(null);
    setUploadResult(null);
    setErrorMessage(null);
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!file) {
      setErrorMessage('Please select a certificate file (PDF, PNG, or JPG).');
      return;
    }

    if (!certificateName.trim()) {
      setErrorMessage('Please enter a certificate name.');
      return;
    }

    if (!issuer.trim()) {
      setErrorMessage('Please enter an issuer name.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // Send file and metadata to Express API
      const response = await uploadCertificate(file, certificateName, issuer, user?.id);

      if (response && response.success) {
        setUploadResult(response);
      } else {
        setErrorMessage(response.message || 'Failed to upload and save certificate.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to connect to the server. Please check backend connection.';
      setErrorMessage(serverMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Upload Result View (Shows real database and storage data) */}
      {uploadResult ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-2">
                <span>✓</span> Upload & Registration Complete
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {uploadResult.certificate?.certificate_name || 'Certificate Registered'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Issued by <span className="font-semibold text-slate-700">{uploadResult.certificate?.issuer}</span>
              </p>
            </div>

            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                uploadResult.certificate?.status === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : uploadResult.certificate?.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              ● {(uploadResult.certificate?.status || 'MANUAL REVIEW').replace(/_/g, ' ')}
            </span>
          </div>

          {/* SECTION 1: AUTHENTICITY VERIFICATION */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🛡️</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  AUTHENTICITY VERIFICATION
                </h2>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${
                  uploadResult.certificate?.status === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : uploadResult.certificate?.status === 'REJECTED'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                ● {(uploadResult.certificate?.status || uploadResult.verification?.status || 'MANUAL REVIEW').replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block">Status:</span>
                <span className="font-bold text-slate-900">
                  {(uploadResult.certificate?.status || uploadResult.verification?.status || 'MANUAL REVIEW').replace(/_/g, ' ')}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-500 block">Verification Score:</span>
                <span className="font-bold text-indigo-600">
                  {uploadResult.verification?.score ?? uploadResult.certificate?.verification_score ?? 0} / 100
                </span>
              </div>

              <div className="md:col-span-2 pt-1">
                <span className="font-semibold text-slate-500 block mb-0.5">Reason:</span>
                <p className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 font-medium">
                  {uploadResult.verification?.issuerVerification?.reason ||
                   uploadResult.certificate?.verification_evidence?.issuerVerification?.reason ||
                   "Verification could not be completed automatically."}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic pt-1">
              Notice: Authenticity verification strictly evaluates authoritative confirmation from the official issuing organization. Reachable web pages or OCR heuristics never confer authentic status.
            </p>
          </div>

          {/* SECTION 2: DETECTED SKILLS (STRICT SEPARATION) */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  DETECTED SKILLS
                </h2>
              </div>
              {uploadResult.skillAnalysis?.model && (
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                  AI Model: {uploadResult.skillAnalysis.model}
                </span>
              )}
            </div>

            {/* Advisory Note */}
            <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100/70">
              <span className="font-semibold text-slate-700">Important Note:</span> Detected skills are extracted directly from the document text via AI evidence analysis and validated against the institutional skills taxonomy. Skill detection does NOT indicate certificate authenticity.
            </div>

            {/* Detected Taxonomy Skills List */}
            {(() => {
              const taxonomySkills =
                uploadResult.skillAnalysis?.skills ||
                uploadResult.certificate?.skillAnalysis?.skills ||
                [];

              if (taxonomySkills.length === 0) {
                return (
                  <div className="p-4 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-500">
                    No verified taxonomy skills detected from this certificate.
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {taxonomySkills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span className="font-bold text-slate-900 text-sm">{skill.skillName}</span>
                          {skill.category && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {skill.category}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-indigo-600 font-mono">
                          Confidence: {typeof skill.confidence === 'number'
                            ? `${Math.round(skill.confidence <= 1 ? skill.confidence * 100 : skill.confidence)}%`
                            : skill.confidence}
                        </span>
                      </div>

                      {skill.evidence && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-150 text-[11px] text-slate-700">
                          <span className="font-semibold text-slate-500">Evidence: </span>
                          <span className="italic font-mono">"{skill.evidence}"</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* SECTION 3: SKILLS REQUIRING TAXONOMY REVIEW (UNMATCHED SKILLS) */}
          {(() => {
            const unmatched =
              uploadResult.skillAnalysis?.unmatchedSkills ||
              uploadResult.certificate?.skillAnalysis?.unmatchedSkills ||
              [];

            if (!unmatched || unmatched.length === 0) return null;

            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-amber-200/80 pb-2">
                  <span className="text-base">📋</span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    SKILLS REQUIRING TAXONOMY REVIEW
                  </h2>
                </div>

                <p className="text-[11px] text-amber-800">
                  The following skills were explicitly evidenced in the certificate text but do not currently exist in the approved institutional taxonomy:
                </p>

                <div className="space-y-2">
                  {unmatched.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-white border border-amber-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span className="font-mono text-amber-800 font-semibold text-[11px]">
                          Confidence: {typeof item.confidence === 'number'
                            ? `${Math.round(item.confidence <= 1 ? item.confidence * 100 : item.confidence)}%`
                            : item.confidence}
                        </span>
                      </div>
                      {item.evidence && (
                        <div className="bg-slate-50 p-1.5 rounded text-[11px] text-slate-700 italic font-mono">
                          Evidence: "{item.evidence}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Database & Storage Record Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-5 border border-slate-200/80">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Certificate ID</div>
              <div className="font-mono text-xs text-slate-800 mt-1 break-all select-all font-semibold">
                {uploadResult.certificate?.id}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Student ID</div>
              <div className="font-mono text-xs text-slate-800 mt-1 break-all select-all">
                {uploadResult.certificate?.student_id}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">File Type</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {uploadResult.certificate?.file_type || 'PDF'}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Verification Score</div>
              <div className="text-sm font-bold text-indigo-600 mt-0.5">
                {uploadResult.verification?.score ?? uploadResult.certificate?.verification_score ?? 0} / 100
              </div>
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Stored Certificate File URL
              </div>
              {uploadResult.file_url ? (
                <a
                  href={uploadResult.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline break-all"
                >
                  <span>🔗</span>
                  <span>{uploadResult.file_url}</span>
                </a>
              ) : (
                <span className="text-xs text-slate-500">Local storage</span>
              )}
            </div>
          </div>

          {/* Verification Checks Breakdown */}
          {uploadResult.verification?.checks && uploadResult.verification.checks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Automated Verification Engine Checks
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {uploadResult.verification.checks.map((chk, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      chk.passed
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{chk.passed ? '✅' : '⚪'}</span>
                      <span className="font-semibold">{chk.rule}</span>
                    </div>
                    <span className="font-mono font-bold text-xs">
                      +{chk.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Upload Another Certificate
            </button>
            <Link
              to="/certificates"
              className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
            >
              View in My Certificates
            </Link>
            <Link
              to="/portfolio"
              className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
            >
              View Portfolio
            </Link>
          </div>
        </div>
      ) : (
        /* Upload Form View */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Upload Certificate
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Submit your micro-credential to register and verify in PostgreSQL.
            </p>
          </div>

          {/* Error Alert Message */}
          {errorMessage && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div className="font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Certificate Name Field */}
            <div>
              <label
                htmlFor="certificateName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Certificate Name
              </label>
              <input
                id="certificateName"
                type="text"
                required
                disabled={isUploading}
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                placeholder="e.g. Full-Stack Web Development & System Design"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
              />
            </div>

            {/* Issuer Name Field */}
            <div>
              <label
                htmlFor="issuerName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Issuer Name
              </label>
              <input
                id="issuerName"
                type="text"
                required
                disabled={isUploading}
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. MIT Open Learning or Stanford Online"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
              />
            </div>

            {/* File Upload Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                File Upload
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:border-indigo-400 hover:bg-slate-50/80 transition-all">
                <div className="text-3xl mb-2">📄</div>
                <label
                  htmlFor="fileInput"
                  className={`text-sm font-semibold text-indigo-600 hover:text-indigo-800 ${
                    isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <span>Click to browse and choose file</span>
                  <input
                    id="fileInput"
                    type="file"
                    disabled={isUploading}
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">
                  Allowed formats: <span className="font-semibold text-slate-700">PDF, PNG, JPG</span>
                </p>

                {/* Selected File Feedback */}
                {file && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-800 text-xs font-medium border border-indigo-200">
                    <span>📎</span>
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="text-indigo-600 font-normal">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit / Upload Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Uploading certificate...</span>
                  </>
                ) : (
                  <span>Upload Certificate</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default UploadCertificate;

