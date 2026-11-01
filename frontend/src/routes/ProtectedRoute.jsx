import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, normalizeRole } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, rawRole, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = normalizeRole(rawRole || user?.role);
  const normalizedAllowed = allowedRoles.map((r) => normalizeRole(r));

  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole)) {
    // Redirect to the user's appropriate default dashboard
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    if (userRole === 'lender') return <Navigate to="/lender" replace />;
    return <Navigate to="/applicant" replace />;
  }

  return <Outlet />;
}
