import React, { useState } from 'react';

/**
 * UploadCertificate Page Component
 * 
 * Clean form interface for submitting a certificate.
 * Fields:
 * - Certificate Title
 * - Issuer Name
 * - Certificate Type
 * - Upload File (Allowed: PDF, PNG, JPG)
 * Button:
 * - Upload Certificate
 * Only UI - does not upload files yet.
 */
function UploadCertificate() {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6 border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Upload Certificate
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit your micro-credential or certificate details for verification.
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {/* Certificate Title */}
          <div>
            <label
              htmlFor="certificateTitle"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Certificate Title
            </label>
            <input
              id="certificateTitle"
              type="text"
              placeholder="e.g. Full-Stack Web Development"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Issuer Name */}
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
              placeholder="e.g. MIT Open Learning or Stanford Online"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Certificate Type */}
          <div>
            <label
              htmlFor="certificateType"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Certificate Type
            </label>
            <select
              id="certificateType"
              defaultValue=""
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
            >
              <option value="" disabled>
                Select Certificate Type
              </option>
              <option value="micro-credential">Micro-Credential</option>
              <option value="course-completion">Course Completion</option>
              <option value="academic-degree">Academic Degree / Diploma</option>
              <option value="professional-certification">Professional Certification</option>
              <option value="skill-badge">Skill Badge</option>
            </select>
          </div>

          {/* Upload File */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Upload File
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:border-indigo-400 hover:bg-slate-50/80 transition-all">
              <div className="text-3xl mb-2">📄</div>
              <label
                htmlFor="fileInput"
                className="cursor-pointer text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <span>Click to browse and upload</span>
                <input
                  id="fileInput"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">
                Allowed formats: <span className="font-semibold text-slate-700">PDF, PNG, JPG</span>
              </p>

              {/* Selected File Feedback */}
              {selectedFile && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                  <span>📎</span>
                  <span className="truncate max-w-xs">{selectedFile.name}</span>
                  <span className="text-emerald-600 font-normal">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Upload Certificate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UploadCertificate;
