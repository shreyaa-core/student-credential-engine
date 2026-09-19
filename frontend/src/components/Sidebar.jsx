import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Sidebar Component
 * 
 * Side navigation bar for authenticated dashboard views using React Router NavLink.
 * Displays dynamic logged-in credentials (Issuer / Admin) in the bottom profile area.
 */
function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const rawMenuItems = [
    { to: '/dashboard', label: 'Overview', icon: '📊' },
    { to: '/profile', label: 'My Profile', icon: '👤' },
    { to: '/certificates', label: 'My Certificates', icon: '📜' },
    { to: '/upload', label: 'Upload Certificate', icon: '📤' },
    { to: '/skills', label: 'Verified Skills', icon: '⚡' },
    { to: '/badges', label: 'Digital Badges', icon: '🏅' },
    { to: '/portfolio', label: 'Public Portfolio', icon: '💼' },
    { to: '/transcript', label: 'Micro-Transcript', icon: '📑' },
    { to: '/verify', label: 'Verify Engine', icon: '🔍' },
    { to: '/admin', label: 'Admin Portal', icon: '⚙️', adminOnly: true },
  ];

  const menuItems = rawMenuItems.filter((item) => !item.adminOnly || isAdmin);

  // Helper to compute initials from email or name
  const getInitials = () => {
    if (!user) return 'GU';
    const source = user.name || user.email || 'User';
    const parts = source.trim().split(/[\s@._-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.substring(0, 2).toUpperCase();
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Guest User';
  const displayEmail = user?.email || 'Not logged in';
  const role = user?.role || 'Issuer';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

      {/* Dynamic Profile credentials footer */}
      <div className="pt-4 border-t border-slate-100 px-1">
        {isAuthenticated && user ? (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
            <Link
              to="/profile"
              className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
              title="Edit account profile"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                {getInitials()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {displayName}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 truncate" title={displayEmail}>
                  {displayEmail}
                </p>
                <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                  {role}
                </span>
              </div>
            </Link>

            {/* Quick Logout Button */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer shrink-0"
              title="Sign out"
            >
              🚪
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default Sidebar;
