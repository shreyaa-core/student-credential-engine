import React from 'react';
import StatusBadge from '../components/StatusBadge';

/**
 * Admin Page Component
 * 
 * Administrative and institutional portal for issuing micro-credentials,
 * managing revocation lists, and inspecting system-wide verification logs.
 */
function Admin() {
  const recentLogs = [
    {
      id: 'log_1',
      certificateTitle: 'Full-Stack Web Development',
      method: 'hash_lookup',
      status: 'verified',
      ip: '192.168.1.10',
      time: '10 mins ago',
    },
    {
      id: 'log_2',
      certificateTitle: 'Cloud DevOps Practitioner',
      method: 'qr_code',
      status: 'expired',
      ip: '10.0.0.4',
      time: '1 hour ago',
    },
    {
      id: 'log_3',
      certificateTitle: 'PostgreSQL Database Architecture',
      method: 'api',
      status: 'verified',
      ip: '172.16.0.22',
      time: '3 hours ago',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Institution & Admin Console</h1>
          <p className="text-sm text-slate-500">
            Issue student credentials, manage revocations, and monitor live verification audit logs.
          </p>
        </div>
        <button
          onClick={() => alert('Credential issuance modal trigger')}
          className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
        >
          + Issue New Credential
        </button>
      </div>

      {/* Verification Audit Logs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900">Live Verification Logs</h2>
          <span className="text-xs text-slate-400">Auto-refreshing</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Credential</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {log.certificateTitle}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-500">
                    {log.method}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400">{log.ip}</td>
                  <td className="py-3 px-4 text-xs text-slate-400">{log.time}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Admin;
