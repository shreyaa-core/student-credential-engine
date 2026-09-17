import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';

/**
 * Verify Page Component
 * 
 * Public verification engine tool allowing employers and academic evaluators to:
 * - Query by Certificate Hash or ID
 * - Check cryptographic signature validity
 * - View verified issuer, recipient, and competency attestation
 */
function Verify() {
  const [hashInput, setHashInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = (e) => {
    e.preventDefault();
    if (!hashInput.trim()) return;

    setIsVerifying(true);
    // Simulate verification check
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult({
        isValid: true,
        title: 'Full-Stack Web Development',
        student: 'Jane Doe',
        issuer: 'MIT Open Learning',
        issueDate: '2026-03-15',
        hash: hashInput,
        status: 'valid',
      });
    }, 600);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Credential Verification Engine</h1>
        <p className="text-sm text-slate-500">
          Enter a certificate hash or credential UUID to verify its authenticity directly against the institutional registry.
        </p>
      </div>

      {/* Verification Search Bar */}
      <form onSubmit={handleVerify} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-3">
        <input
          type="text"
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          placeholder="Enter certificate hash or UUID (e.g. hash_90a1b2c3d4e5f6)"
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
        />
        <button
          type="submit"
          disabled={isVerifying}
          className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : 'Verify Now'}
        </button>
      </form>

      {/* Result Card */}
      {verificationResult && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Credential Verified</h3>
                <p className="text-xs text-slate-500">Cryptographic signature is valid and untampered</p>
              </div>
            </div>
            <StatusBadge status={verificationResult.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase block">Credential</span>
              <span className="font-bold text-slate-800">{verificationResult.title}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase block">Awarded To</span>
              <span className="font-bold text-slate-800">{verificationResult.student}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase block">Issuing Authority</span>
              <span className="font-semibold text-slate-700">{verificationResult.issuer}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase block">Date Issued</span>
              <span className="text-slate-600">{verificationResult.issueDate}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
              Verified Hash Checksum
            </span>
            <code className="text-xs font-mono text-emerald-700 break-all">
              {verificationResult.hash}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

export default Verify;
