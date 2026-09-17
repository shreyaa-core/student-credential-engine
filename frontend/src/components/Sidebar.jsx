import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Sidebar Component
 * 
 * Side navigation bar for authenticated dashboard views using React Router NavLink.
 */
function Sidebar() {
  const menuItems = [
    { to: '/dashboard', label: 'Overview', icon: '📊' },
    { to: '/certificates', label: 'My Certificates', icon: '📜' },
    { to: '/upload', label: 'Upload Certificate', icon: '📤' },
    { to: '/skills', label: 'Verified Skills', icon: '⚡' },
    { to: '/badges', label: 'Digital Badges', icon: '🏅' },
    { to: '/portfolio', label: 'Public Portfolio', icon: '💼' },
    { to: '/transcript', label: 'Micro-Transcript', icon: '📑' },
    { to: '/verify', label: 'Verify Engine', icon: '🔍' },
    { to: '/admin', label: 'Admin Portal', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Navigation
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Profile quick-info footer */}
      <div className="pt-4 border-t border-slate-100 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
            ST
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-800 truncate">Student User</p>
            <p className="text-[11px] text-slate-400 truncate">student@university.edu</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
