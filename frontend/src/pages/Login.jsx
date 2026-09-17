import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Login Page Component
 * 
 * Simple, clean UI for student/user login.
 * Built with Tailwind CSS, strictly containing Email, Password fields, and a Login button.
 */
function Login() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-sm">
            🎓
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sign in to your account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access your student micro-credentials and verified records
          </p>
        </div>

        {/* Login Form UI */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="student@university.edu"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Login Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Login
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 text-xs text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
