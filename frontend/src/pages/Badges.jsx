import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BadgeCard from '../components/BadgeCard';

/**
 * Badges Page Component
 * 
 * Fetches real digital badges from Express API (GET /api/badges)
 * backed by the Supabase 'badges' database table.
 * 
 * Features:
 * - Dynamic data fetching via Axios
 * - Displays real badge information using existing BadgeCard component
 * - Loading indicator & Error retry feedback
 * - Live on-demand refresh button
 * - Clean empty state when no badges are recorded in the database
 */
function Badges() {
  const [badges, setBadges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch badges from backend API
  const fetchBadges = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await axios.get('http://localhost:5000/api/badges');
      const data = Array.isArray(response.data) ? response.data : (response.data?.badges || []);
      setBadges(data);
    } catch (err) {
      console.error('Failed to load badges:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load digital badges. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Digital Badges</h1>
          <p className="text-sm text-slate-500">
            Open-standard micro-badges awarded for verified milestones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBadges}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh badges from database"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
          </button>
          <Link
            to="/certificates"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            View Certificates
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
            onClick={fetchBadges}
            className="text-xs underline font-bold hover:text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm font-semibold text-slate-700">Loading digital badges from database...</p>
          <p className="text-xs text-slate-400 mt-1">Querying Supabase badges table</p>
        </div>
      )}

      {/* Badges Grid */}
      {!isLoading && badges.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {badges.map((badge, idx) => (
            <BadgeCard
              key={badge.id || idx}
              name={badge.name}
              criteria={badge.criteria}
              earnedDate={badge.earnedDate || badge.created_at || 'Recently'}
              icon={
                badge.image_url?.startsWith('http') || badge.image_url?.startsWith('data:') ? (
                  <img
                    src={badge.image_url}
                    alt={badge.name}
                    className="w-10 h-10 object-contain rounded-full"
                  />
                ) : (
                  badge.icon || '🏅'
                )
              }
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && badges.length === 0 && (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <span className="text-4xl mb-3 block">🏅</span>
          <h3 className="text-base font-bold text-slate-800">No digital badges awarded yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
            Badges are issued upon cryptographic verification and approval of coursework micro-credentials.
          </p>
          <Link
            to="/upload"
            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Upload Certificate to Earn Badges
          </Link>
        </div>
      )}
    </div>
  );
}

export default Badges;
