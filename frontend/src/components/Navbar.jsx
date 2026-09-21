import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

/**
 * Navbar Component
 * 
 * Clean, reactive navigation bar for the Student Credential Engine.
 * Supports active top navigation highlighting, dynamic user credentials,
 * and a slide-out hamburger navigation drawer for authenticated users.
 */
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const links = isAuthenticated
    ? [
        { label: 'Portfolio', path: '/portfolio' },
        { label: 'Profile', path: '/profile' },
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Certificates', path: '/certificates' },
        { label: 'Skills', path: '/skills' },
        { label: 'Badges', path: '/badges' },
        { label: 'Verify Credential', path: '/verify' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'Verify Credential', path: '/verify' },
      ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleVerifyCredentialClick = (e) => {
    if (e) e.preventDefault();
    if (isOpen) setIsOpen(false);
    if (isAuthenticated) {
      navigate('/verify');
    } else {
      navigate('/login', { state: { from: { pathname: '/verify' } } });
    }
  };

  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger Button (Authenticated) & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated && (
              <button
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                type="button"
                className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
                aria-label="Toggle navigation drawer"
                title="Open navigation menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <Link to={isAuthenticated ? '/portfolio' : '/'} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                🎓
              </span>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                Student Credential Engine
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => {
              if (link.label === 'Verify Credential' && !isAuthenticated) {
                return (
                  <Link
                    key={link.label}
                    to="/login"
                    state={{ from: { pathname: '/verify' } }}
                    onClick={handleVerifyCredentialClick}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {link.label}
                  </Link>
                );
              }
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === '/'}
                  className={({ isActive }) =>
                    `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              );
            })}

            {/* Authenticated User Status vs Login / Register Buttons */}
            {isAuthenticated && user ? (
              <div className="ml-4 pl-4 border-l border-slate-200 flex items-center gap-3">
                {/* User Avatar & Name */}
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                  title={`View profile (${user.email})`}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                    {userInitial}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-slate-800 leading-none truncate max-w-[120px]">
                      {user.name || user.email?.split('@')[0]}
                    </p>
                    <span className="inline-block mt-0.5 text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                      {user.role || 'Issuer'}
                    </span>
                  </div>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {links.map((link) => {
            if (link.label === 'Verify Credential' && !isAuthenticated) {
              return (
                <Link
                  key={link.label}
                  to="/login"
                  state={{ from: { pathname: '/verify' } }}
                  onClick={handleVerifyCredentialClick}
                  className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                  }`
                }
              >
                {link.label}
              </NavLink>
            );
          })}

          {/* Mobile Auth Section */}
          <div className="pt-3 mt-2 border-t border-slate-100">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                    {userInitial}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{user.email}</p>
                    <span className="text-[10px] font-semibold text-indigo-600 uppercase">
                      {user.role || 'Issuer'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-center px-4 py-2 rounded-lg text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-out Navigation Drawer for Authenticated Users */}
      {isAuthenticated && (
        <Sidebar isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      )}
    </nav>
  );
}

export default Navbar;
