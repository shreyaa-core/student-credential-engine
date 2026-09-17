import React from 'react';

/**
 * BadgeCard Component
 * 
 * Displays an earned digital micro-badge:
 * - Badge icon / visual indicator
 * - Badge name and criteria
 * - Date earned
 */
function BadgeCard({
  name = 'Certified Full-Stack Developer',
  criteria = 'Completed 4 accredited modules and passed cryptographic skill verification.',
  earnedDate = '2026-06-15',
  icon = '🏆',
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-3 shadow-inner">
        {icon}
      </div>
      <h4 className="text-base font-bold text-slate-800 mb-1">{name}</h4>
      <p className="text-xs text-slate-500 mb-3 px-2 line-clamp-2">{criteria}</p>
      <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
        Earned on {earnedDate}
      </span>
    </div>
  );
}

export default BadgeCard;
