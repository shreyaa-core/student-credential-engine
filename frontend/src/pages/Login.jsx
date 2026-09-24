import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * Login Page
 *
 * Simple email + password login. No role selector.
 * The backend automatically returns role=Admin for admin@test.in
 * and role=Issuer for all other accounts.
 */
function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) navigate('/portfolio', { replace: true });
  }, [isAuthenticated, navigate]);

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess,    setIsSuccess]    = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // No role field sent — backend derives role from the database
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        email:    email.trim(),
        password: password.trim(),
      });

      if (res.data?.success && res.data?.token) {
        login(res.data.user, res.data.token);
        setIsSuccess(true);

        const returnedRole = (res.data.user?.role || '').toLowerCase();
        const fromPath     = location.state?.from?.pathname;
        const defaultPath  = returnedRole === 'admin' ? '/admin' : '/dashboard';

        setTimeout(() => {
          navigate(fromPath && !fromPath.includes('login') ? fromPath : defaultPath);
        }, 500);
      } else {
        throw new Error(res.data?.message || res.data?.error || 'Authentication failed');
      }
    } catch (err) {
      console.warn('Login error:', err);
      const serverErr =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unable to connect to the server. Please ensure the backend is running.';
      setErrorMessage(serverErr);
      setIsLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-sm">
            🏛️
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sign in to your account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Micro-Credential &amp; Skill Verification Engine
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span>✅</span>
            <span>Signed in! Loading your workspace...</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
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
              required
              disabled={isLoading || isSuccess}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrorMessage(null); }}
              placeholder="e.g. issuer@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isLoading || isSuccess}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMessage(null); }}
                placeholder="••••••••"
                className="w-full pl-4 pr-11 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading || isSuccess}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-colors disabled:opacity-50"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
