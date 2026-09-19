import React from 'react';
import { Link } from 'react-router-dom';

/**
 * CertificateCard Component
 * 
 * Reusable card displaying micro-credential details:
 * - Certificate Name
 * - Issuer
 * - Date
 * - Status
 * - Real verification link
 */
function CertificateCard({
  id,
  certificateName = 'Full-Stack Web Development & System Design',
  title, // backwards compatibility fallback
  issuer = 'MIT Open Learning',
  date = 'March 15, 2026',
  issueDate, // backwards compatibility fallback
  status = 'Verified',
  onVerify,
}) {
  const displayName = certificateName || title;
  const displayDate = date || issueDate;
  const verifyLink = id ? `/verify/${id}` : '/verify';

  // Compute status badge colors using Tailwind CSS
  const getStatusStyles = (currentStatus) => {
    switch (currentStatus?.toLowerCase()) {
      case 'verified':
      case 'valid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
      case 'pending review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'revoked':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'expired':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        {/* Top bar: Icon and Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            📜
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyles(
              status
            )}`}
          >
            ● {status}
          </span>
        </div>

        {/* Certificate Name */}
        <h3 className="text-base font-bold text-slate-900 line-clamp-2 mb-1.5">
          {displayName}
        </h3>

        {/* Issuer */}
        <p className="text-sm font-medium text-slate-600 mb-2">
          Issued by: <span className="text-slate-800">{issuer}</span>
        </p>
      </div>

      {/* Date & Footer */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>Date: {displayDate}</span>
        {onVerify ? (
          <button
            type="button"
            onClick={onVerify}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            View Credential →
          </button>
        ) : (
          <Link
            to={verifyLink}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View Credential →
          </Link>
        )}
      </div>

    </div>
  );
}

export default CertificateCard;
