import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Home Page Component
 * 
 * Landing page introducing the Automated Student Micro-Credential & Skill Verification Engine.
 * Features clickable highlights navigating to Verify, Skills, and Admin audit consoles.
 */
function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleVerifyNavigation = (e) => {
    if (e) e.preventDefault();
    if (user) {
      navigate('/verify');
    } else {
      navigate('/login', { state: { from: { pathname: '/verify' } } });
    }
  };

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          🚀 Next-Gen Credential Engine
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Verify Micro-Credentials with Cryptographic Trust
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Automated issuance, blockchain-ready verification, and competency tracking for academic institutions, issuers, and global employers.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            to={user ? '/verify' : '/login'}
            state={user ? undefined : { from: { pathname: '/verify' } }}
            onClick={handleVerifyNavigation}
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Verify credentials
          </Link>
          <Link
            to="/register"
            className="px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-sm hover:bg-slate-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </section>

      {/* Highlights Grid - Interactive Feature Cards */}
      <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* 1. Instant Verification */}
        <Link
          to={user ? '/verify' : '/login'}
          state={user ? undefined : { from: { pathname: '/verify' } }}
          onClick={handleVerifyNavigation}
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 transition-all flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">🔍</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Instant Verification
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Verify academic micro-credentials and digital badges instantly using cryptographic hashes and QR codes.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
            <span>Verify credentials now</span>
            <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* 2. Skill Attestation */}
        <Link
          to="/skills"
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 transition-all flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">⚡</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Skill Attestation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Map coursework and certifications directly to specific technical skills and proficiency levels.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
            <span>View skills matrix</span>
            <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* 3. Fraud-Proof Audit Logs */}
        <Link
          to="/admin"
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 transition-all flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">🛡️</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Fraud-Proof Audit Logs
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every verification is logged into an immutable ledger for compliance and institutional integrity.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
            <span>Open admin console</span>
            <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      </section>
    </div>
  );
}

export default Home;
