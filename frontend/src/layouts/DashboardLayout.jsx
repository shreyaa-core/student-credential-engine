import React from 'react';
import Sidebar from '../components/Sidebar';

/**
 * DashboardLayout Component
 * 
 * Authenticated workspace layout with the left-hand Sidebar and content container.
 */
function DashboardLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
