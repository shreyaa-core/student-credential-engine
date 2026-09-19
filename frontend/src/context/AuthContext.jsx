import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

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
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Keep Axios Authorization header synced with active token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Set up request interceptor as a failsafe to always read active token
  useEffect(() => {
    const interceptorId = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, []);

  // Listen for storage changes across tabs or windows
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('token');
        setUser(storedUser ? JSON.parse(storedUser) : null);
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
    const rawRole = (userData.role || '').trim().toLowerCase();
    const resolvedRole = rawRole === 'admin' ? 'Admin' : 'Issuer';

    const normalizedUser = {
      ...userData,
      name: userData.name || userData.fullName || userData.email?.split('@')[0] || 'User',
      role: resolvedRole,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    const resolvedToken = authToken || userData.token || null;

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
      const merged = { ...prev, ...updatedFields };
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
