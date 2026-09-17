import React from 'react';

/**
 * MainLayout Component
 * 
 * General layout wrapper providing the responsive content container.
 */
function MainLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default MainLayout;
