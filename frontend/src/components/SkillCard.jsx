import React from 'react';

/**
 * SkillCard Component
 * 
 * Displays an individual verified skill or competency with:
 * - Skill name and categorization (e.g. Frontend, Blockchain, Database)
 * - Proficiency level (Beginner, Intermediate, Advanced, Expert)
 * - Associated certificate count
 */
function SkillCard({
  name = 'React.js',
  category = 'Frontend Development',
  level = 'Advanced',
  verifiedCertificatesCount = 2,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-indigo-200 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
          {category}
        </span>
        <span className="text-xs font-medium text-slate-500">{level}</span>
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1">{name}</h4>
      <p className="text-xs text-slate-500">
        Verified in {verifiedCertificatesCount} credential{verifiedCertificatesCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default SkillCard;
