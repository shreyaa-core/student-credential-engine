import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CertificateCard from '../components/CertificateCard';

/**
 * Certificates Page Component
 * 
 * Fetches real micro-credential records from Express API (GET /api/certificates)
 * backed by the Supabase 'certificates' table.
 * 
 * Features:
 * - Dynamic data fetching via Axios
 * - Search by certificate name or issuer
 * - Status filtering (All, Verified/Approved, Pending, Expired, Revoked)
 * - Renders using the existing CertificateCard component
 * - Loading indicator & Error retry feedback
 * - Empty state feedback when no certificates are in the database
 */
function Certificates() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch certificates from backend API
  const fetchCertificates = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await axios.get('http://localhost:5000/api/certificates');
      const data = Array.isArray(response.data) ? response.data : (response.data?.certificates || []);
      setCertificates(data);
    } catch (err) {
      console.error('Failed to load certificates:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load certificates. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  // Filter certificates based on search query and status dropdown
  const filtered = certificates.filter((cert) => {
    const certTitle = (cert.certificate_name || cert.certificateName || cert.title || '').toLowerCase();
    const certIssuer = (cert.issuer || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = certTitle.includes(query) || certIssuer.includes(query);

    const rawStatus = (cert.status || '').toLowerCase();
    let matchesStatus = true;

    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'valid' || statusFilter === 'verified') {
      matchesStatus = ['approved', 'verified', 'valid'].includes(rawStatus);
    } else if (statusFilter === 'pending') {
      matchesStatus = ['pending', 'pending review', 'manual review', 'manual_review'].includes(rawStatus);
    } else {
      matchesStatus = rawStatus === statusFilter.toLowerCase() || rawStatus.replace(/_/g, ' ') === statusFilter.toLowerCase();
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
          <p className="text-sm text-slate-500">
            View, download, and verify micro-credentials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCertificates}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh certificates from database"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
          </button>
          <Link
            to="/upload"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            + Add Credential
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchCertificates}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <input
          type="text"
          placeholder="Search by title or issuer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="verified">Verified / Approved</option>
          <option value="pending">Pending Review</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm font-semibold text-slate-700">Loading certificates from database...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to Supabase PostgreSQL</p>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((cert, index) => (
            <CertificateCard
              key={cert.id || index}
              id={cert.id}
              certificateName={cert.certificate_name || cert.certificateName || cert.title}
              issuer={cert.issuer}
              date={cert.date || cert.issueDate || cert.createdDate}
              status={cert.status}
              onVerify={() => navigate(`/verify/${cert.id}`)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filtered.length === 0 && (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <span className="text-4xl mb-3 block">📜</span>
          <h3 className="text-base font-bold text-slate-800">
            {search || statusFilter !== 'all' ? 'No matching certificates found' : 'No certificates in database yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting the status filter.'
              : 'Submit and verify your first micro-credential to populate your portfolio.'}
          </p>
          <Link
            to="/upload"
            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Upload Certificate
          </Link>
        </div>
      )}
    </div>
  );
}

export default Certificates;
