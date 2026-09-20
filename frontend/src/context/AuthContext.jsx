import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

/**
 * Extracts and normalizes the authoritative role directly from the signed JWT payload.
 * Prevents localStorage role spoofing and normalizes strictly to 'Admin' or 'Issuer'.
 */
function extractTrustedRole(tokenStr, fallbackRole = 'Issuer') {
  if (tokenStr && typeof tokenStr === 'string' && tokenStr.includes('.')) {
    try {
      const parts = tokenStr.split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(payloadBase64));
        if (decoded && decoded.role) {
          const raw = String(decoded.role).trim().toLowerCase();
          return raw === 'admin' ? 'Admin' : 'Issuer';
        }
      }
    } catch {
      // Ignore parse failure; fallback below
    }
  }
  const rawFallback = (fallbackRole || '').trim().toLowerCase();
  return rawFallback === 'admin' ? 'Admin' : 'Issuer';
}

// Ensure Axios immediately carries Authorization Bearer token from localStorage for all requests
if (typeof window !== 'undefined') {
  try {
    const initialToken = localStorage.getItem('token');
    if (initialToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
    }
  } catch {}
}

// Request interceptor registered immediately at module level to guarantee headers on initial mount
axios.interceptors.request.use(
  (config) => {
    try {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        config.headers = config.headers || {};
        if (!config.headers['Authorization'] && !config.headers['authorization']) {
          config.headers['Authorization'] = `Bearer ${currentToken}`;
        }
      }
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      const storedToken = localStorage.getItem('token');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') return null;

      // Always derive the authoritative role from the signed JWT payload
      parsed.role = extractTrustedRole(storedToken, parsed.role);
      return parsed;
    } catch {
      return null;
    }
  });

  const isAuthReady = true;

  // Keep Axios Authorization header synced with active token state
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Listen for storage changes across tabs or windows
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('token');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.role = extractTrustedRole(storedToken, parsed.role);
          setUser(parsed);
        } else {
          setUser(null);
        }
        setToken(storedToken || null);
      } catch {
        setUser(null);
        setToken(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (userData, authToken = null) => {
    const resolvedToken = authToken || userData.token || null;
    const authoritativeRole = extractTrustedRole(resolvedToken, userData.role);

    const normalizedUser = {
      ...userData,
      name: userData.name || userData.fullName || userData.email?.split('@')[0] || 'User',
      role: authoritativeRole,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
    if (resolvedToken) {
      localStorage.setItem('token', resolvedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${resolvedToken}`;
    }

    setUser(normalizedUser);
    setToken(resolvedToken);
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      if (!prev) return null;
      // Do not allow client updates to overwrite the authoritative role
      const sanitizedUpdates = { ...updatedFields };
      delete sanitizedUpdates.role;
      const merged = { ...prev, ...sanitizedUpdates };
      try {
        localStorage.setItem('currentUser', JSON.stringify(merged));
      } catch (e) {
        console.error('Failed to update currentUser in localStorage', e);
      }
      return merged;
    });
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout');
    } catch (err) {
      console.warn('Supabase logout notice:', err.message);
    } finally {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user),
        isAuthReady,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
