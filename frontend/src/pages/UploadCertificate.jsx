import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { parseCertificate, uploadCertificate } from '../services/certificateService';
import { useAuth } from '../context/AuthContext';

/**
 * UploadCertificate Page Component
 * 
 * Production Flow:
 * 1. User selects certificate file (PDF, PNG, JPG, JPEG).
 * 2. User clicks "Parse Certificate" -> calls POST /api/certificates/parse.
 * 3. Frontend displays an editable review form pre-filled with extracted data:
 *    - Notice: "Please review the extracted certificate details before submitting."
 *    - certificate_name, issuer, certificate_id, issue_date, verification_url
 * 4. User corrects/fills any fields and submits -> calls POST /api/certificates/upload.
 * 5. Complete verification, skill mapping, and PostgreSQL persistence occur.
 */
function UploadCertificate() {
  const { user } = useAuth();

  // Form input states
  const [certificateName, setCertificateName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [certificateId, setCertificateId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [purpose, setPurpose] = useState('');
  const [file, setFile] = useState(null);

  // Parsing and upload states
  const [isParsing, setIsParsing] = useState(false);
  const [isParsed, setIsParsed] = useState(false);
  const [parseNotice, setParseNotice] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsParsed(false);
      setParseNotice(null);
      setErrorMessage(null);
      setCertificateName('');
      setIssuer('');
      setCertificateId('');
      setIssueDate('');
      setVerificationUrl('');
      setPurpose('');
    }
  };

  const handleParse = async () => {
    if (!file) {
      setErrorMessage('Please select a certificate file (PDF, PNG, or JPG) to parse.');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setParseNotice(null);

    try {
      const response = await parseCertificate(file);
      
      // Resolve payload safely regardless of whether response is { success, data: { ... } } or nested axios response
      let data = response;
      if (response && typeof response === 'object') {
        if (response.data && typeof response.data === 'object') {
          if (response.data.data && typeof response.data.data === 'object') {
            data = response.data.data;
          } else {
            data = response.data;
          }
        }
      }

      if (data && typeof data === 'object') {
        const extracted = {
          certificate_name: data.certificate_name || data.certificateName || data.courseName || data.course_name || '',
          issuer: data.issuer || data.issuing_organization || data.institution || '',
          certificate_id: data.certificate_id || data.certificateId || data.credential_id || data.credentialId || '',
          issue_date: data.issue_date || data.issueDate || data.date || '',
          verification_url: data.verification_url || data.verificationUrl || data.url || '',
          purpose: data.purpose || data.description || '',
        };

        if (import.meta.env.DEV) {
          console.log('[CertificateParseDebug] Auto-filled fields:', extracted);
        }

        setCertificateName(extracted.certificate_name);
        setIssuer(extracted.issuer);
        setCertificateId(extracted.certificate_id);
        setIssueDate(extracted.issue_date);
        setVerificationUrl(extracted.verification_url);
        setPurpose(extracted.purpose);
        setIsParsed(true);
        setParseNotice('Please review the extracted certificate details before submitting.');
      } else {
        setErrorMessage(response?.message || 'Failed to extract certificate details. You can enter them manually.');
        setIsParsed(true);
      }
    } catch (err) {
      console.error('Parse error:', err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Could not automatically parse the document. You can still enter details manually.';
      setErrorMessage(serverMessage);
      setIsParsed(true);
    } finally {
      setIsParsing(false);
    }
  };

  const handleReset = () => {
    setCertificateName('');
    setIssuer('');
    setCertificateId('');
    setIssueDate('');
    setVerificationUrl('');
    setPurpose('');
    setFile(null);
    setIsParsed(false);
    setParseNotice(null);
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
      // Send file and reviewed metadata to Express API
      const certificateData = {
        certificate_name: certificateName.trim(),
        issuer: issuer.trim(),
        certificate_id: certificateId.trim(),
        issue_date: issueDate.trim(),
        verification_url: verificationUrl.trim(),
        purpose: purpose.trim(),
        student_id: user?.id,
      };

      const response = await uploadCertificate(file, certificateData);

      if (response && response.success) {
        setUploadResult(response);
      } else {
        setErrorMessage(response?.message || 'Failed to upload and save certificate.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      let serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to connect to the server. Please check backend connection.';

      if (err.response?.status === 409) {
        serverMessage =
          err.response?.data?.message ||
          'This certificate has already been uploaded to your account.';
      }

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

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block">Status:</span>
                <span className="font-bold text-slate-900">
                  {(uploadResult.certificate?.status || uploadResult.verification?.status || 'MANUAL REVIEW').replace(/_/g, ' ')}
                </span>
              </div>

              <div className="pt-1">
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
        /* Upload & Parse Flow */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Upload Certificate
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select your micro-credential to automatically parse its details, review, and register into the database.
            </p>
          </div>

          {/* Error Alert Message */}
          {errorMessage && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div className="font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Notice: Review Extracted Details */}
          {parseNotice && (
            <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-center gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <div className="font-semibold">{parseNotice}</div>
                <div className="text-xs text-blue-700 mt-0.5">
                  Verify or edit any extracted fields before final submission.
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: File Selection Area */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Select Certificate File
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:border-indigo-400 hover:bg-slate-50/80 transition-all">
              <div className="text-3xl mb-2">📄</div>
              <label
                htmlFor="fileInput"
                className={`text-sm font-semibold text-indigo-600 hover:text-indigo-800 ${
                  isParsing || isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <span>{file ? 'Click to change file' : 'Click to browse and choose file'}</span>
                <input
                  id="fileInput"
                  type="file"
                  disabled={isParsing || isUploading}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">
                Allowed formats: <span className="font-semibold text-slate-700">PDF, PNG, JPG, JPEG</span> (Max 10MB)
              </p>

              {/* Selected File Details & Parse Action */}
              {file && (
                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-800 text-xs font-medium border border-indigo-200">
                    <span>📎</span>
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="text-indigo-600 font-normal">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  {!isParsed && (
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={isParsing}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isParsing ? (
                        <>
                          <svg
                            className="animate-spin h-3.5 w-3.5 text-white"
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
                          <span>Reading certificate...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>Parse Certificate</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Editable Review Form (shown once parsed or file selected) */}
          {isParsed && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Review & Submit Details
                </span>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing || isUploading}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                >
                  Re-parse file
                </button>
              </div>

              {/* Certificate Name Field */}
              <div>
                <label
                  htmlFor="certificateName"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Certificate / Course Name <span className="text-rose-500">*</span>
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
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Issuer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="issuerName"
                  type="text"
                  required
                  disabled={isUploading}
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="e.g. Coursera, Stanford Online, or MIT"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
                />
              </div>

              {/* Grid: Certificate ID & Issue Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="certificateId"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                  >
                    Certificate ID / Credential ID
                  </label>
                  <input
                    id="certificateId"
                    type="text"
                    disabled={isUploading}
                    value={certificateId}
                    onChange={(e) => setCertificateId(e.target.value)}
                    placeholder="e.g. CERT-89421 or UUID"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100 font-mono text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issueDate"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                  >
                    Issue Date (YYYY-MM-DD)
                  </label>
                  <input
                    id="issueDate"
                    type="date"
                    disabled={isUploading}
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Verification URL Field */}
              <div>
                <label
                  htmlFor="verificationUrl"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Verification URL
                </label>
                <input
                  id="verificationUrl"
                  type="url"
                  disabled={isUploading}
                  value={verificationUrl}
                  onChange={(e) => setVerificationUrl(e.target.value)}
                  placeholder="https://coursera.org/verify/..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100 text-xs font-mono"
                />
              </div>

              {/* Purpose / Description Field */}
              <div>
                <label
                  htmlFor="purpose"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Purpose / Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="purpose"
                  rows={2}
                  disabled={isUploading}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. For successfully completing the online course..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100 resize-none"
                />
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
          )}
        </div>
      )}
    </div>
  );
}

export default UploadCertificate;
