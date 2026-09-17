import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Navbar Component
 * 
 * Clean, reusable navigation bar for the Student Credential Engine.
 * Built with Tailwind CSS and React Router Link.
 */
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: 'Home', path: '/' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Certificates', path: '/certificates' },
    { label: 'Skills', path: '/skills' },
    { label: 'Badges', path: '/badges' },
    { label: 'Portfolio', path: '/portfolio' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Project Name & Brand Logo */}
          <Link to="/" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              🎓
            </span>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Student Credential Engine
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {/* Login Link */}
            <Link
              to="/login"
              className="ml-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Login
            </Link>
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
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center px-4 py-2.5 rounded-lg text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
