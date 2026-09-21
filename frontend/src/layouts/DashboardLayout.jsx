import React from 'react';

/**
 * DashboardLayout Component
 * 
 * Clean, full-width authenticated workspace layout.
 * Navigation drawer is accessible globally via the top navigation bar hamburger menu.
 */
function DashboardLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800">
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
