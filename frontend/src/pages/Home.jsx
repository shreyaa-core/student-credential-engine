import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Home Page Component
 * 
 * Landing page introducing the Automated Student Micro-Credential & Skill Verification Engine.
 */
function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          🚀 Next-Gen Credential Engine
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Verify Student Micro-Credentials with Cryptographic Trust
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Automated issuance, blockchain-ready verification, and competency tracking for academic institutions, students, and global employers.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            to="/verify"
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-colors"
          >
            Verify a Credential
          </Link>
          <Link
            to="/register"
            className="px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-sm hover:bg-slate-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Instant Verification</h3>
          <p className="text-sm text-slate-600">
            Verify academic micro-credentials and digital badges instantly using cryptographic hashes and QR codes.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Skill Attestation</h3>
          <p className="text-sm text-slate-600">
            Map coursework and certifications directly to specific technical skills and proficiency levels.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl mb-3">🛡️</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Fraud-Proof Audit Logs</h3>
          <p className="text-sm text-slate-600">
            Every verification is logged into an immutable ledger for compliance and institutional integrity.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Home;
