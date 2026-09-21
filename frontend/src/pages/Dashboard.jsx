import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Issuer & Credential Dashboard Page Component
 * 
 * Connected to live backend Express API (GET /api/dashboard) backed by Supabase tables:
 * - certificates (total, verified, pending)
 * - skills (skills earned count)
 * - badges (badges earned count)
 * 
 * Displays:
 * 1. 5 Real-Time Summary Statistics Cards
 * 2. Recent Certificates from database
 * 3. Latest Badges from database
 * 4. Loading indicator, Error handling with retry, and live Refresh button
 */
function Dashboard() {
  const { user, token } = useAuth();
  const location = useLocation();
  const accessDenied = location.state?.accessDenied;

  const [dashboardData, setDashboardData] = useState({
    totalCertificates: 0,
    verifiedCertificates: 0,
    pendingCertificates: 0,
    skillsEarned: 0,
    badgesEarned: 0,
    totalActivities: 0,
    recentCertificates: [],
    latestBadges: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch real-time dashboard data from backend API
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

      const response = await axios.get('http://localhost:5000/api/dashboard', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      const data = response.data || {};

      setDashboardData({
        totalCertificates: data.totalCertificates ?? data.total_certificates ?? 0,
        verifiedCertificates: data.verifiedCertificates ?? data.verified_certificates ?? 0,
        pendingCertificates: data.pendingCertificates ?? data.pending_certificates ?? 0,
        skillsEarned: data.skillsEarned ?? data.skills_earned ?? 0,
        badgesEarned: data.badgesEarned ?? data.badges_earned ?? 0,
        totalActivities: data.totalActivities ?? data.total_activities ?? 0,
        recentCertificates: Array.isArray(data.recentCertificates) ? data.recentCertificates : [],
        latestBadges: Array.isArray(data.latestBadges) ? data.latestBadges : [],
      });
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to connect to backend server. Ensure backend is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Summary Metrics configuration
  const summaryMetrics = [
    {
      label: 'Total Certificates',
      value: dashboardData.totalCertificates,
      subtitle: 'Recorded in database',
      icon: '📜',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      label: 'Verified Certificates',
      value: dashboardData.verifiedCertificates,
      subtitle: 'Verified & authenticated',
      icon: '✅',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      label: 'Pending Review',
      value: dashboardData.pendingCertificates,
      subtitle: 'Awaiting admin review',
      icon: '⏳',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
    {
      label: 'Skills Earned',
      value: dashboardData.skillsEarned,
      subtitle: 'Verified competencies',
      icon: '⚡',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
    {
      label: 'Badges Earned',
      value: dashboardData.badgesEarned,
      subtitle: 'Digital milestones',
      icon: '🏅',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      borderColor: 'border-indigo-100',
    },
    {
      label: 'Activities Logged',
      value: dashboardData.totalActivities,
      subtitle: 'Co-curricular records',
      icon: '🎯',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600',
      borderColor: 'border-teal-100',
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Access Denied Feedback Banner */}
      {accessDenied && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="text-sm font-bold">Access Restricted</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              You attempted to access a protected area that requires Administrator privileges. You have been redirected to your dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex flex-wrap items-center gap-2.5">
            <span>{user ? `Welcome, ${user.name || user.email?.split('@')[0]}!` : 'Issuer Dashboard'}</span>
            {user?.role && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                {user.role}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time live credentials, verified competencies, and digital achievement badges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh live metrics"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <span>+</span> Upload Certificate
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
            onClick={fetchDashboardData}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State Skeleton / Message */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-2">
          <span className="animate-spin text-sm">⏳</span>
          Loading live database metrics from application database...
        </div>
      )}

      {/* Six Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryMetrics.map((card, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl border ${card.borderColor} p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between`}
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
              <div className="text-3xl font-extrabold text-slate-900 mb-1">
                {isLoading ? '...' : card.value}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {card.subtitle}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Recent Certificates Section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Certificates</h2>
            <p className="text-xs text-slate-500">Latest micro-credentials stored in the application database</p>
          </div>
          <Link
            to="/certificates"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All Certificates →
          </Link>
        </div>

        {dashboardData.recentCertificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {dashboardData.recentCertificates.map((cert) => (
              <div
                key={cert.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors bg-slate-50/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ['APPROVED', 'VERIFIED', 'Verified', 'Approved', 'valid'].includes(cert.status)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      ● {cert.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">
                    {cert.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mb-1">
                    {cert.issuer}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Uploaded: {cert.issueDate}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <Link
                    to="/verify"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Verify Authenticity →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <span className="text-3xl mb-2 block">📄</span>
            <p className="text-sm font-semibold text-slate-700">No certificates in database yet</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-3">
              Upload your first micro-credential to start building your verified profile.
            </p>
            <Link
              to="/upload"
              className="inline-block px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Upload Certificate
            </Link>
          </div>
        )}
      </section>

      {/* Latest Badges Section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Latest Badges</h2>
            <p className="text-xs text-slate-500">Digital achievement badges awarded from the application database</p>
          </div>
          <Link
            to="/badges"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All Badges →
          </Link>
        </div>

        {dashboardData.latestBadges.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {dashboardData.latestBadges.map((badge) => (
              <Link
                key={badge.id}
                to={`/badges/${badge.id}`}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 hover:bg-slate-50 hover:shadow-sm hover:border-indigo-200 transition-all text-center flex flex-col items-center justify-between group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl mb-3 shadow-inner group-hover:scale-105 transition-transform">
                  {badge.icon || '🏅'}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                  {badge.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3 px-1">
                  {badge.criteria}
                </p>
                <div className="w-full pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Earned: {badge.earnedDate}</span>
                  <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    View Badge →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <span className="text-3xl mb-2 block">🏅</span>
            <p className="text-sm font-semibold text-slate-700">No badges awarded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Badges will be awarded upon verification and approval of coursework and certificates.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
