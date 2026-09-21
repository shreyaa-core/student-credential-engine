import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import SkillCard from '../components/SkillCard';

/**
 * Skills Page Component
 * 
 * Fetches real verified skills data from Express API (GET /api/skills)
 * backed by Supabase tables: 'skills' and 'certificate_skills'.
 * 
 * Features:
 * - Dynamic data fetching via Axios
 * - Renders using the existing SkillCard component
 * - Loading indicator & Error retry feedback
 * - Live on-demand refresh button
 * - Clean empty state when no skills exist in database yet
 */
function Skills() {
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch skills from backend API
  const fetchSkills = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await axios.get('http://localhost:5000/api/skills');
      const data = Array.isArray(response.data) ? response.data : (response.data?.skills || []);
      setSkills(data);
    } catch (err) {
      console.error('Failed to load skills:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load verified skills. Ensure backend server is running on http://localhost:5000.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verified Skills Matrix</h1>
          <p className="text-sm text-slate-500">
            Competencies extracted and verified from coursework, assessments, and application credential records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSkills}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh skills from database"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Refresh
          </button>
          <Link
            to="/upload"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            + Verify New Skill
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
            onClick={fetchSkills}
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
          <p className="text-sm font-semibold text-slate-700">Loading verified skills from database...</p>
          <p className="text-xs text-slate-400 mt-1">Querying database skills and certificate_skills records</p>
        </div>
      )}

      {/* Skills Grid */}
      {!isLoading && skills.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill, idx) => (
            <SkillCard
              key={skill.id || idx}
              name={skill.name}
              category={skill.category}
              level={skill.level || skill.proficiency_level}
              verifiedCertificatesCount={skill.verifiedCertificatesCount ?? skill.verified_certificates_count ?? 0}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && skills.length === 0 && (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <span className="text-4xl mb-3 block">⚡</span>
          <h3 className="text-base font-bold text-slate-800">No verified skills recorded yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
            Skills are automatically extracted, mapped, and verified upon approving micro-credentials.
          </p>
          <Link
            to="/upload"
            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Upload Certificate to Earn Skills
          </Link>
        </div>
      )}
    </div>
  );
}

export default Skills;
