import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Profile Page Component
 * 
 * Manages authenticated user profile data:
 * - Fetches profile via GET /api/profile/me
 * - Updates editable fields via PUT /api/profile/me
 * - Displays "Not specified" for empty/null fields (no fake data)
 * - Keeps email and role strictly read-only
 */
function Profile() {
  const { token, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    full_name: '',
    institution: '',
    last_qualification: '',
    bio: '',
  });

  // Fetch authenticated user's profile
  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('http://localhost:5000/api/profile/me', { headers });

      if (response.data && response.data.profile) {
        const p = response.data.profile;
        setProfile(p);
        setFormData({
          full_name: p.full_name || p.name || '',
          institution: p.institution || '',
          last_qualification: p.last_qualification || '',
          bio: p.bio || '',
        });
      } else {
        throw new Error('Invalid profile response structure.');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Unable to load profile from the server.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  // Compute initials for placeholder avatar
  const getInitials = (nameStr) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/[\s@._-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  // Handle Edit form submission
  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate full name
    const trimmedName = formData.full_name.trim();
    if (!trimmedName) {
      setErrorMessage('Full name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        full_name: trimmedName,
        institution: formData.institution.trim() || null,
        last_qualification: formData.last_qualification.trim() || null,
        bio: formData.bio.trim() || null,
      };

      const response = await axios.put('http://localhost:5000/api/profile/me', payload, { headers });

      if (response.data && response.data.profile) {
        const updated = response.data.profile;
        setProfile(updated);
        setFormData({
          full_name: updated.full_name || updated.name || '',
          institution: updated.institution || '',
          last_qualification: updated.last_qualification || '',
          bio: updated.bio || '',
        });

        // Update AuthContext so navbar/sidebar sync immediately
        if (updateUser) {
          updateUser({
            name: updated.full_name,
            institution: updated.institution,
          });
        }

        setIsEditing(false);
        setSuccessMessage('Profile updated successfully.');

        // Auto-dismiss success message after 4 seconds
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        throw new Error('Unexpected response format from server.');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to save profile changes.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard edits and restore original DB values
  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || profile.name || '',
        institution: profile.institution || '',
        last_qualification: profile.last_qualification || '',
        bio: profile.bio || '',
      });
    }
    setIsEditing(false);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>👤</span> Account Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal details, academic institution, and portfolio bio.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>💼</span> View Portfolio
          </Link>
          {!isEditing && profile && (
            <button
              onClick={() => {
                setIsEditing(true);
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>✏️</span> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
          <h3 className="text-base font-bold text-slate-800">Loading Profile...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Fetching authentic credentials from PostgreSQL
          </p>
        </div>
      )}

      {/* Main Profile Card (View Mode & Edit Mode) */}
      {!isLoading && profile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Banner */}
          <div className="h-28 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]"></div>
          </div>

          <div className="p-6 sm:p-8 pt-0 relative">
            {/* Avatar & Summary */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-14 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                {profile.profile_photo_url ? (
                  <img
                    src={profile.profile_photo_url}
                    alt={profile.full_name || 'Profile'}
                    className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg border-4 border-white">
                    {getInitials(profile.full_name || profile.name)}
                  </div>
                )}
                <div className="pt-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900">
                      {profile.full_name || profile.name || 'User'}
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {profile.role || 'Issuer'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {profile.email}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* VIEW MODE                                                     */}
            {/* ============================================================= */}
            {!isEditing ? (
              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Full Name
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {profile.full_name || profile.name || 'Not specified'}
                    </p>
                  </div>

                  {/* Registered Email (Read-Only) */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Registered Email
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {profile.email || 'Not specified'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                      Read-Only
                    </span>
                  </div>

                  {/* Role (Read-Only) */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Account Role
                      </span>
                      <p className="text-sm font-semibold text-slate-900 capitalize">
                        {profile.role || 'Not specified'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                      Read-Only
                    </span>
                  </div>

                  {/* Institution */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Institution / University
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {profile.institution ? profile.institution : <span className="text-slate-400 font-normal italic">Not specified</span>}
                    </p>
                  </div>

                  {/* Last Qualification */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 md:col-span-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Last Qualification / Degree
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {profile.last_qualification ? profile.last_qualification : <span className="text-slate-400 font-normal italic">Not specified</span>}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Bio / Professional Summary
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {profile.bio ? profile.bio : <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>
              </div>
            ) : (
              /* ============================================================= */
              /* EDIT MODE FORM                                                */
              /* ============================================================= */
              <form onSubmit={handleSave} className="space-y-5 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Full Name Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Registered Email (Disabled) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-500">
                        Registered Email
                      </label>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        🔒 Cannot be changed
                      </span>
                    </div>
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
                    />
                  </div>

                  {/* Role (Disabled) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-500">
                        Account Role
                      </label>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        🔒 Read-only
                      </span>
                    </div>
                    <input
                      type="text"
                      disabled
                      value={profile.role || 'Issuer'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm capitalize cursor-not-allowed"
                    />
                  </div>

                  {/* Institution Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Institution / University
                    </label>
                    <input
                      type="text"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      placeholder="e.g. Stanford University or Tech Institute"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Last Qualification Input */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Last Qualification / Degree
                    </label>
                    <input
                      type="text"
                      value={formData.last_qualification}
                      onChange={(e) => setFormData({ ...formData, last_qualification: e.target.value })}
                      placeholder="e.g. B.S. in Computer Science, High School Diploma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Bio Textarea */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Bio / Professional Summary
                    </label>
                    <textarea
                      rows={4}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Brief summary of your academic or professional background..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
                    />
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin">⏳</span> Saving...
                      </>
                    ) : (
                      <>
                        <span>💾</span> Save Profile
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
