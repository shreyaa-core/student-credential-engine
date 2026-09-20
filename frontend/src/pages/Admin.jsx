import React, { useState, useEffect } from 'react';
import { getCertificates, updateCertificateStatus } from '../services/adminService';

/**
 * Admin Dashboard Page Component
 * 
 * Administrative management interface for micro-credentials:
 * - Loads real certificate data from backend API (GET /api/admin/certificates)
 * - Statistics Cards (Total Certificates, Verified, Pending Review, Rejected)
 * - Interactive Certificate Table with Approve and Reject actions (PUT /api/admin/certificates/:id/status)
 * - Automatic table refresh after status update
 * - Loading indicator and Error messaging
 * - Styled with Tailwind CSS
 */
function Admin() {
  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Load certificates on component mount
  useEffect(() => {
    fetchCertificates();
  }, []);

  // Fetch all certificates from the backend
  const fetchCertificates = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await getCertificates();
      const certList = Array.isArray(data) ? data : (data?.certificates || []);
      setCertificates(certList);
    } catch (err) {
      console.error('Failed to load certificates:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to connect to backend server. Ensure backend is running on port 5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Approve action
  const handleApprove = async (id, name) => {
    try {
      setActionLoadingId(id);
      await updateCertificateStatus(id, 'VERIFIED', 'Approved and verified by administrator');
      showNotice(`Certificate "${name || id}" has been VERIFIED.`, 'success');
      // Refresh table after status update
      await fetchCertificates();
    } catch (err) {
      console.error('Error approving certificate:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to approve certificate.';
      showNotice(msg, 'danger');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject action
  const handleReject = async (id, name) => {
    try {
      setActionLoadingId(id);
      await updateCertificateStatus(id, 'REJECTED', 'Rejected by administrator');
      showNotice(`Certificate "${name || id}" has been REJECTED.`, 'danger');
      // Refresh table after status update
      await fetchCertificates();
    } catch (err) {
      console.error('Error rejecting certificate:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to reject certificate.';
      showNotice(msg, 'danger');
    } finally {
      setActionLoadingId(null);
    }
  };

  const showNotice = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Compute live statistics dynamically from backend data
  const totalCertificates = certificates.length;
  const verifiedCount = certificates.filter((c) => {
    const s = (c.status || '').toUpperCase();
    return s === 'VERIFIED' || s === 'APPROVED';
  }).length;
  const pendingCount = certificates.filter((c) => {
    const s = (c.status || '').toUpperCase();
    return s === 'PENDING' || s === 'PENDING REVIEW' || s === 'MANUAL REVIEW' || s === 'MANUAL_REVIEW';
  }).length;
  const rejectedCount = certificates.filter((c) => {
    const s = (c.status || '').toUpperCase();
    return s === 'REJECTED';
  }).length;

  // Status badge styling helper
  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'VERIFIED' || s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          {status ? status.replace(/_/g, ' ') : 'Verified'}
        </span>
      );
    }
    if (s === 'PENDING' || s === 'PENDING REVIEW' || s === 'MANUAL REVIEW' || s === 'MANUAL_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          {status ? status.replace(/_/g, ' ') : 'Pending'}
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        {status || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time administrative verification console connected to Supabase backend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCertificates}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh from backend"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
            <span>Refresh</span>
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
            <span>🛡️</span>
            <span>Admin Review</span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Error loading certificates</p>
              <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={fetchCertificates}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Certificates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Certificates
            </span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg">
              📜
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {isLoading ? '...' : totalCertificates}
          </div>
          <p className="text-xs text-slate-400 mt-1">All database submissions</p>
        </div>

        {/* 2. Verified */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Verified
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              ✅
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700">
            {isLoading ? '...' : verifiedCount}
          </div>
          <p className="text-xs text-emerald-600/80 mt-1">Approved & authenticated</p>
        </div>

        {/* 3. Pending Review */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Pending Review
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
              ⏳
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">
            {isLoading ? '...' : pendingCount}
          </div>
          <p className="text-xs text-amber-600/80 mt-1">Awaiting evaluation</p>
        </div>

        {/* 4. Rejected */}
        <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Rejected
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
              ❌
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">
            {isLoading ? '...' : rejectedCount}
          </div>
          <p className="text-xs text-rose-600/80 mt-1">Declined or invalid</p>
        </div>
      </div>

      {/* Certificate Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Certificate Submissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live records from backend Supabase PostgreSQL database.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg self-start sm:self-auto">
            {certificates.length} records loaded
          </span>
        </div>

        {/* Loading Message View */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block animate-spin text-3xl">⏳</div>
            <p className="text-sm font-semibold text-slate-700">
              Loading certificates from backend...
            </p>
            <p className="text-xs text-slate-400">
              Connecting to http://localhost:5000/api/admin/certificates
            </p>
          </div>
        ) : certificates.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center space-y-3">
            <div className="text-4xl">📄</div>
            <p className="text-sm font-semibold text-slate-700">
              No certificate submissions found
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Upload certificates from the upload page to begin processing and reviewing them here.
            </p>
          </div>
        ) : (
          /* Real Data Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Certificate Name</th>
                  <th className="py-3.5 px-4">Issuer</th>
                  <th className="py-3.5 px-4 text-center">Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {certificates.map((cert) => {
                  const certName =
                    cert.certificate_name || cert.certificateName || cert.title || 'Untitled Certificate';
                  const certIssuer = cert.issuer || 'Unknown Issuer';
                  const certScore =
                    cert.verification_score !== undefined
                      ? cert.verification_score
                      : cert.score !== undefined
                      ? cert.score
                      : null;
                  const isUpdating = actionLoadingId === cert.id;

                  return (
                    <tr
                      key={cert.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Certificate Name Column */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-bold text-slate-900">
                          {certName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          ID: {cert.id}
                        </div>
                      </td>

                      {/* Issuer Column */}
                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md text-xs">
                          {certIssuer}
                        </span>
                      </td>

                      {/* Score Column */}
                      <td className="py-4 px-4 text-center">
                        {certScore !== null ? (
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                              certScore >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : certScore >= 50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {certScore} / 100
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            N/A
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-4 px-4">
                        {getStatusBadge(cert.status)}
                      </td>

                      {/* Action Column */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Approve Button */}
                          <button
                            onClick={() => handleApprove(cert.id, certName)}
                            disabled={
                              isUpdating ||
                              (cert.status || '').toUpperCase() === 'APPROVED' ||
                              (cert.status || '').toUpperCase() === 'VERIFIED'
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              (cert.status || '').toUpperCase() === 'APPROVED' ||
                              (cert.status || '').toUpperCase() === 'VERIFIED'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50'
                            }`}
                            title="Approve Certificate"
                          >
                            <span>✓</span>
                            <span>{isUpdating ? 'Saving...' : 'Approve'}</span>
                          </button>

                          {/* Reject Button */}
                          <button
                            onClick={() => handleReject(cert.id, certName)}
                            disabled={
                              isUpdating ||
                              (cert.status || '').toUpperCase() === 'REJECTED'
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              (cert.status || '').toUpperCase() === 'REJECTED'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50'
                            }`}
                            title="Reject Certificate"
                          >
                            <span>✕</span>
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
