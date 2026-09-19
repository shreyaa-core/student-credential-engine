import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * 
 * Guards routes against unauthenticated and unauthorized access:
 * 1. If not authenticated -> redirects to /login, preserving original location in state.
 * 2. If allowedRoles is specified -> verifies user role (case-insensitive).
 *    If role is not permitted -> redirects to /dashboard with an alert.
 * 3. Otherwise -> renders protected children components.
 */
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user.role || 'issuer').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return (
        <Navigate
          to="/dashboard"
          state={{
            accessDenied: true,
            requiredRoles: allowedRoles,
            deniedPath: location.pathname,
          }}
          replace
        />
      );
    }
  }

  return children;
}

export default ProtectedRoute;
