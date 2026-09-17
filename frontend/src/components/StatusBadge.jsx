import React from 'react';

/**
 * StatusBadge Component
 * 
 * Displays visual indicator tags for credential and verification states:
 * - valid / verified
 * - pending
 * - revoked
 * - expired
 */
function StatusBadge({ status = 'valid' }) {
  const getBadgeStyle = (currentStatus) => {
    switch (currentStatus.toLowerCase()) {
      case 'valid':
      case 'verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
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
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
        status
      )}`}
    >
      ● {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default StatusBadge;
