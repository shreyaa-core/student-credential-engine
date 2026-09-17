import React, { useState, useEffect } from 'react';
import { getTestMessage } from './services/api';

/**
 * App Component
 * 
 * Demonstrates connection between React frontend and Express backend.
 * Fetches and displays message from GET /api/test.
 */
function App() {
  const [backendMessage, setBackendMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch test message from Express backend on component mount
    getTestMessage()
      .then((data) => {
        setBackendMessage(data.message);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error connecting to backend:', err);
        setError('Cannot connect to backend. Please ensure the Express server is running on http://localhost:5000');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800">
      <main className="max-w-md w-full bg-white shadow-sm rounded-xl p-8 border border-slate-200 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Student Micro-Credential Verification Engine
        </h1>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Frontend connected:
          </h2>

          {loading && (
            <p className="text-slate-500">Connecting to backend...</p>
          )}

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          {backendMessage && (
            <p className="text-xl font-bold text-emerald-600">
              {backendMessage}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
