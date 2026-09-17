import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CertificateCard from '../components/CertificateCard';

/**
 * Certificates Page Component
 * 
 * Displays catalog of micro-credentials with React Router links.
 */
function Certificates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const certificatesList = [
    {
      title: 'Full-Stack Web Development',
      issuer: 'MIT Open Learning',
      issueDate: '2026-03-15',
      certificateHash: 'hash_90a1b2c3d4e5f6',
      status: 'valid',
    },
    {
      title: 'PostgreSQL Database Architecture',
      issuer: 'Database Academy',
      issueDate: '2026-02-10',
      certificateHash: 'hash_5f4e3d2c1b0a98',
      status: 'valid',
    },
    {
      title: 'Solidity Smart Contract Security',
      issuer: 'Blockchain Security Group',
      issueDate: '2025-11-20',
      certificateHash: 'hash_7b8c9d0e1f2a34',
      status: 'valid',
    },
    {
      title: 'Cloud DevOps Practitioner',
      issuer: 'Cloud Standards Institute',
      issueDate: '2024-01-10',
      certificateHash: 'hash_1234abcd5678ef',
      status: 'expired',
    },
  ];

  const filtered = certificatesList.filter((cert) => {
    const matchesSearch =
      cert.title.toLowerCase().includes(search.toLowerCase()) ||
      cert.issuer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cert.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
          <p className="text-sm text-slate-500">
            View, download, and verify your cryptographically signed student micro-credentials.
          </p>
        </div>
        <Link
          to="/upload"
          className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
        >
          + Add Credential
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
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
          className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="valid">Valid</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((cert, index) => (
          <CertificateCard
            key={index}
            {...cert}
            onVerify={() => navigate('/verify')}
          />
        ))}
      </div>
    </div>
  );
}

export default Certificates;
