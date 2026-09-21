import React, { useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Sidebar Component (Slide-out Navigation Drawer)
 * 
 * Accessible off-canvas navigation drawer triggered by the top navbar hamburger button.
 * Supports toggle, auto-close on selection, outside-click backdrop dismissal,
 * and Escape key listener.
 */
function Sidebar({ isOpen, onClose }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Close drawer on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close drawer on route navigation
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname]);

  if (!isOpen) return null;

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
    onClose();
    logout();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="sidebar-drawer-title" role="dialog" aria-modal="true">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <aside className="w-72 sm:w-80 bg-white shadow-2xl border-r border-slate-200 flex flex-col justify-between relative z-10 animate-in slide-in-from-left duration-200">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                🎓
              </span>
              <span id="sidebar-drawer-title" className="text-sm font-bold text-slate-900 tracking-tight">
                Navigation Menu
              </span>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close navigation menu"
              title="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation links list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Workspace
            </div>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            {isAuthenticated && user ? (
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs">
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
                  title="Edit account profile"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate" title={displayEmail}>
                      {displayEmail}
                    </p>
                    <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                      {role}
                    </span>
                  </div>
                </Link>

                {/* Quick Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Sign out"
                >
                  🚪
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Sidebar;
