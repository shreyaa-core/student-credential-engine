import React from 'react';
import StatusBadge from '../components/StatusBadge';

/**
 * Transcript Page Component
 * 
 * Formal Academic Micro-Transcript view summarizing all completed modules,
 * issued credentials, cumulative credits, and cryptographic integrity hashes.
 */
function Transcript() {
  const records = [
    {
      code: 'CS-301',
      course: 'Advanced React & Component Patterns',
      credits: '3.0',
      grade: 'A',
      term: 'Spring 2026',
      status: 'valid',
    },
    {
      code: 'CS-340',
      course: 'Relational Database Architecture (PostgreSQL)',
      credits: '4.0',
      grade: 'A+',
      term: 'Spring 2026',
      status: 'valid',
    },
    {
      code: 'CS-410',
      course: 'Distributed Systems & Micro-Services',
      credits: '3.5',
      grade: 'A',
      term: 'Fall 2025',
      status: 'valid',
    },
    {
      code: 'SEC-205',
      course: 'Cryptographic Protocols & PKI',
      credits: '3.0',
      grade: 'A-',
      term: 'Fall 2025',
      status: 'valid',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-600 block mb-1">
            Official Micro-Transcript
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Student Academic Record</h1>
          <p className="text-xs text-slate-500 mt-0.5">Institution: Tech Global University</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-400">Cumulative GPA</p>
          <p className="text-2xl font-black text-slate-900">3.92</p>
          <p className="text-[11px] text-emerald-600 font-semibold">13.5 Verified Credits</p>
        </div>
      </div>

      {/* Transcript Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400">
              <th className="py-3 px-3">Course Code</th>
              <th className="py-3 px-3">Module Name</th>
              <th className="py-3 px-3">Credits</th>
              <th className="py-3 px-3">Grade</th>
              <th className="py-3 px-3">Term</th>
              <th className="py-3 px-3">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((rec, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-700">
                  {rec.code}
                </td>
                <td className="py-3 px-3 font-medium text-slate-800">{rec.course}</td>
                <td className="py-3 px-3 text-slate-600">{rec.credits}</td>
                <td className="py-3 px-3 font-bold text-slate-900">{rec.grade}</td>
                <td className="py-3 px-3 text-slate-500 text-xs">{rec.term}</td>
                <td className="py-3 px-3">
                  <StatusBadge status={rec.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
        <span>Transcript Root Hash: <code>0x98fbc10492...e13</code></span>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
        >
          🖨️ Export PDF
        </button>
      </div>
    </div>
  );
}

export default Transcript;
