import React, { useState, useEffect } from 'react';
import {
  getMyActivities,
  createActivity,
  updateActivity,
  deleteActivity
} from '../services/activityService';

const ACTIVITY_TYPES = [
  'Workshop',
  'Hackathon',
  'Seminar',
  'Competition',
  'Project',
  'Internship',
  'Technical Event',
  'Club Activity',
  'Volunteering',
  'Training',
  'Conference',
  'Other'
];

function Activities() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    activity_type: 'Workshop',
    organizer: '',
    activity_date: '',
    evidence_url: '',
    description: ''
  });

  // Delete confirmation modal state
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch activities from API
  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await getMyActivities();
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setErrorMessage(
        err.response?.data?.error ||
        err.message ||
        'Failed to load activities. Please verify the backend server is running.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Handle open create modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      title: '',
      activity_type: 'Workshop',
      organizer: '',
      activity_date: new Date().toISOString().split('T')[0],
      evidence_url: '',
      description: ''
    });
    setIsModalOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle open edit modal
  const handleOpenEdit = (act) => {
    setIsEditing(true);
    setCurrentId(act.id);
    setFormData({
      title: act.title || '',
      activity_type: act.activity_type || 'Workshop',
      organizer: act.organizer || '',
      activity_date: act.activity_date ? act.activity_date.split('T')[0] : '',
      evidence_url: act.evidence_url || '',
      description: act.description || ''
    });
    setIsModalOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submit (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setErrorMessage('Please fill in all required fields (Title and Description).');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isEditing && currentId) {
        const res = await updateActivity(currentId, formData);
        setSuccessMessage('Activity updated and skills recalculated successfully!');
      } else {
        const res = await createActivity(formData);
        const mappedCount = res.activity?.skills?.length || 0;
        setSuccessMessage(
          `Activity recorded successfully! ${
            mappedCount > 0
              ? `${mappedCount} skill(s) automatically mapped to canonical taxonomy.`
              : 'No canonical skills detected in this record.'
          }`
        );
      }

      setIsModalOpen(false);
      await fetchActivities();
    } catch (err) {
      console.error('Error saving activity:', err);
      setErrorMessage(
        err.response?.data?.error ||
        err.message ||
        'Failed to save activity. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete execution
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setIsDeleting(true);
      await deleteActivity(deleteTargetId);
      setDeleteTargetId(null);
      setSuccessMessage('Activity record deleted successfully.');
      await fetchActivities();
    } catch (err) {
      console.error('Error deleting activity:', err);
      setErrorMessage(
        err.response?.data?.error ||
        err.message ||
        'Failed to delete activity. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered activities
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      (act.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.organizer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.skills || []).some((s) =>
        s.skill_name.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesType =
      selectedType === 'All' ||
      (act.activity_type || '').toLowerCase() === selectedType.toLowerCase();

    return matchesSearch && matchesType;
  });

  // Calculate high-level summary metrics
  const totalCount = activities.length;
  const allMappedSkills = new Set();
  activities.forEach((act) => {
    (act.skills || []).forEach((s) => allMappedSkills.add(s.skill_name));
  });
  const uniqueSkillsCount = allMappedSkills.size;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Activity Logs & Skill Mapping
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Record co-curricular workshops, hackathons, and technical projects. Your activities are
            automatically analyzed and mapped to canonical skills with auditable evidence.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <span>+</span> Record Activity
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 text-sm font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Activities
            </span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 text-lg">🎯</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{totalCount}</p>
          <p className="text-xs text-slate-500 mt-1">Logged co-curricular experiences</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Skills Mapped
            </span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600 text-lg">⚡</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{uniqueSkillsCount}</p>
          <p className="text-xs text-slate-500 mt-1">Distinct canonical competencies verified</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Taxonomy Integrity
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 text-lg">🛡️</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-2">100%</p>
          <p className="text-xs text-slate-500 mt-1">Auditable & isolated database taxonomy</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities or skills..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition cursor-pointer"
          >
            <option value="All">All Types</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">Loading activity logs...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mx-auto mb-4">
            🎯
          </div>
          <h3 className="text-lg font-bold text-slate-900">No activity logs found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery || selectedType !== 'All'
              ? 'No activities matched your filter criteria. Try clearing search filters.'
              : 'You have not recorded any co-curricular activities yet. Add workshops, hackathons, or project milestones to demonstrate real-world skills.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition cursor-pointer"
          >
            + Record Your First Activity
          </button>
        </div>
      ) : (
        /* Activities Cards List */
        <div className="space-y-4">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {act.activity_type}
                    </span>
                    {act.activity_date && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        📅 {new Date(act.activity_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    )}
                    {act.organizer && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        🏢 {act.organizer}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {act.title}
                  </h3>

                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {act.description}
                  </p>

                  {act.evidence_url && (
                    <div className="pt-1">
                      <a
                        href={act.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
                      >
                        🔗 View Evidence / Project Repository →
                      </a>
                    </div>
                  )}

                  {/* Mapped Skills Section */}
                  <div className="pt-3 border-t border-slate-100 mt-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Mapped Skills ({act.skills ? act.skills.length : 0})
                    </span>
                    {act.skills && act.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {act.skills.map((sk) => (
                          <div
                            key={sk.skill_id}
                            title={sk.evidence_text ? `Evidence: ${sk.evidence_text}` : ''}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 border border-purple-100 text-purple-800 text-xs font-medium"
                          >
                            <span>⚡</span>
                            <span>{sk.skill_name}</span>
                            <span className="px-1.5 py-0.2 bg-purple-200/60 rounded-md text-[10px] font-bold text-purple-900">
                              {sk.confidence_score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No canonical skills detected in this entry.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 self-end md:self-start">
                  <button
                    onClick={() => handleOpenEdit(act)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(act.id)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Activity Record' : 'Record Co-Curricular Activity'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. AI & Machine Learning Hackathon 2026"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Activity Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="activity_type"
                    value={formData.activity_type}
                    onChange={handleChange}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="activity_date"
                    value={formData.activity_date}
                    onChange={handleChange}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Organizer / Institution
                  </label>
                  <input
                    type="text"
                    name="organizer"
                    value={formData.organizer}
                    onChange={handleChange}
                    placeholder="e.g. Google Developer Student Club"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Evidence Link (URL)
                  </label>
                  <input
                    type="url"
                    name="evidence_url"
                    value={formData.evidence_url}
                    onChange={handleChange}
                    placeholder="https://github.com/... or credential URL"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description & Evidence <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="description"
                  required
                  rows="4"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detail your responsibilities, technical stacks used (e.g. Python, React, PostgreSQL, Deep Learning), and outcomes achieved..."
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 The skill mapper automatically scans for canonical skills like Python, React,
                  Node.js, SQL, Machine Learning, and Deep Learning with confidence $\ge 60\%$.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : isEditing ? (
                    'Update Activity'
                  ) : (
                    'Record Activity'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto mb-3">
              🗑️
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Activity Record?</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              This will remove this activity and its mapped skills. Canonical taxonomy skills in the
              database catalog remain untouched.
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Activities;
