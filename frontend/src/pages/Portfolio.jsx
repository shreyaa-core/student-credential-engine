import React from 'react';
import { useNavigate } from 'react-router-dom';
import CertificateCard from '../components/CertificateCard';
import SkillCard from '../components/SkillCard';

/**
 * Portfolio Page Component
 * 
 * Public shareable portfolio profile page displaying verified credentials.
 */
function Portfolio() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-md">
          JD
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Jane Doe</h1>
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
              ✓ Verified Student Identity
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-2">
            Computer Science & Distributed Systems • Institute of Technology
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Public Verification ID: stu_uuid_94f810aa
          </p>
        </div>
        <button
          onClick={() => alert('Portfolio link copied to clipboard!')}
          className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          📋 Share Portfolio Link
        </button>
      </div>

      {/* Verified Skills */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Verified Competencies</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <SkillCard name="React.js" category="Frontend" level="Advanced" verifiedCertificatesCount={3} />
          <SkillCard name="Node.js & Express" category="Backend" level="Advanced" verifiedCertificatesCount={2} />
          <SkillCard name="PostgreSQL" category="Database" level="Intermediate" verifiedCertificatesCount={2} />
        </div>
      </section>

      {/* Verified Credentials */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Verified Micro-Credentials</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <CertificateCard
            title="Full-Stack Web Development"
            issuer="MIT Open Learning"
            issueDate="2026-03-15"
            certificateHash="hash_90a1b2c3d4e5f6"
            status="valid"
            onVerify={() => navigate('/verify')}
          />
          <CertificateCard
            title="PostgreSQL Database Architecture"
            issuer="Database Academy"
            issueDate="2026-02-10"
            certificateHash="hash_5f4e3d2c1b0a98"
            status="valid"
            onVerify={() => navigate('/verify')}
          />
        </div>
      </section>
    </div>
  );
}

export default Portfolio;
