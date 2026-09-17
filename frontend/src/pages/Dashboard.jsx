import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Student Dashboard Page Component
 * 
 * Overview page for students featuring:
 * - 4 Summary Statistic Cards
 * - Recent Certificates section
 * - Latest Badges section
 * Uses dummy data and Tailwind CSS.
 */
function Dashboard() {
  // 1. Four Summary Metric Cards Data
  const summaryMetrics = [
    {
      label: 'Total Certificates',
      value: '12',
      change: '+2 this semester',
      icon: '📜',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      label: 'Verified Certificates',
      value: '10',
      change: '83% authenticity rate',
      icon: '✅',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      label: 'Pending Review',
      value: '2',
      change: 'Verification in progress',
      icon: '⏳',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
    {
      label: 'Skills Earned',
      value: '28',
      change: 'Across 6 disciplines',
      icon: '⚡',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
  ];

  // 2. Dummy Data for Recent Certificates
  const recentCertificates = [
    {
      id: 'cert-1',
      title: 'Full-Stack Web Development & System Design',
      issuer: 'MIT Open Learning',
      issueDate: 'March 15, 2026',
      status: 'Verified',
      hash: '0x7f4a...92b1',
    },
    {
      id: 'cert-2',
      title: 'PostgreSQL Relational Database Architecture',
      issuer: 'Stanford Online Academy',
      issueDate: 'February 28, 2026',
      status: 'Verified',
      hash: '0x3c2e...88f4',
    },
    {
      id: 'cert-3',
      title: 'Cloud Security & Infrastructure as Code',
      issuer: 'Cloud Standards Board',
      issueDate: 'January 18, 2026',
      status: 'Pending Review',
      hash: '0x99dd...10a7',
    },
  ];

  // 3. Dummy Data for Latest Badges
  const latestBadges = [
    {
      id: 'badge-1',
      name: 'React Champion',
      icon: '⚛️',
      category: 'Frontend',
      earnedDate: 'March 2026',
      criteria: 'Demonstrated mastery of modern component architecture and state management.',
    },
    {
      id: 'badge-2',
      name: 'Database Architect',
      icon: '🗄️',
      category: 'Backend',
      earnedDate: 'February 2026',
      criteria: 'Completed verified coursework in schema design and performance optimization.',
    },
    {
      id: 'badge-3',
      name: 'Security Sentinel',
      icon: '🛡️',
      category: 'Security',
      earnedDate: 'January 2026',
      criteria: 'Achieved accreditation in cryptographic hashing and public-key infrastructure.',
    },
    {
      id: 'badge-4',
      name: 'Cloud Pioneer',
      icon: '☁️',
      category: 'DevOps',
      earnedDate: 'December 2025',
      criteria: 'Successfully deployed and monitored containerized microservices.',
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Student Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back! Monitor your micro-credentials, verified skills, and digital achievement badges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <span>+</span> Upload Certificate
          </Link>
        </div>
      </div>

      {/* Four Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summaryMetrics.map((card, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl border ${card.borderColor} p-5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
              <div
                className={`w-9 h-9 rounded-lg ${card.bgColor} ${card.textColor} flex items-center justify-center text-lg`}
              >
                {card.icon}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {card.value}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {card.change}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Recent Certificates Section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Certificates</h2>
            <p className="text-xs text-slate-500">Your latest micro-credentials submitted and verified</p>
          </div>
          <Link
            to="/certificates"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All Certificates →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {recentCertificates.map((cert) => (
            <div
              key={cert.id}
              className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      cert.status === 'Verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    ● {cert.status}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {cert.hash}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">
                  {cert.title}
                </h3>
                <p className="text-xs text-slate-600 font-medium mb-1">
                  {cert.issuer}
                </p>
                <p className="text-[11px] text-slate-400">
                  Issued: {cert.issueDate}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                <Link
                  to="/verify"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Verify Authenticity
                </Link>
                <span className="text-xs text-slate-400">PDF Available</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest Badges Section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Latest Badges</h2>
            <p className="text-xs text-slate-500">Digital milestone badges awarded across coursework</p>
          </div>
          <Link
            to="/badges"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All Badges →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {latestBadges.map((badge) => (
            <div
              key={badge.id}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:shadow-sm text-center flex flex-col items-center justify-between"
            >
              <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl mb-3 shadow-inner">
                {badge.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {badge.name}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mb-2">
                {badge.category}
              </span>
              <p className="text-xs text-slate-500 line-clamp-2 mb-3 px-1">
                {badge.criteria}
              </p>
              <span className="text-[11px] text-slate-400 font-medium">
                Awarded {badge.earnedDate}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
