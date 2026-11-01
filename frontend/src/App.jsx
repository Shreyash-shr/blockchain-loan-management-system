import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, normalizeRole } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Applicant Pages
import ApplicantOverview from './pages/applicant/ApplicantOverview';
import MyApplicationsPage from './pages/applicant/MyApplicationsPage';
import ApplyLoanPage from './pages/applicant/ApplyLoanPage';
import ApplicantRepayments from './pages/applicant/ApplicantRepayments';
import ApplicantDocuments from './pages/applicant/ApplicantDocuments';

// Lender Pages
import LenderOverview from './pages/lender/LenderOverview';
import RequestsQueuePage from './pages/lender/RequestsQueuePage';
import CompletedLoansPage from './pages/lender/CompletedLoansPage';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminVerificationPage from './pages/admin/AdminVerificationPage';
import EligibilitySettingsPage from './pages/admin/EligibilitySettingsPage';
import LoanMonitoringPage from './pages/admin/LoanMonitoringPage';
import ReportsPage from './pages/admin/ReportsPage';
import UserManagementPage from './pages/admin/UserManagementPage';

function RootRedirect() {
  const { user, rawRole, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Initializing CredChain...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeRole(rawRole || user?.role);
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'lender') return <Navigate to="/lender" replace />;
  return <Navigate to="/applicant" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Root & Public Routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Applicant Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['applicant']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/applicant" element={<ApplicantOverview />} />
                <Route path="/applicant/applications" element={<MyApplicationsPage />} />
                <Route path="/applicant/apply" element={<ApplyLoanPage />} />
                <Route path="/applicant/repayments" element={<ApplicantRepayments />} />
                <Route path="/applicant/documents" element={<ApplicantDocuments />} />
              </Route>
            </Route>

            {/* Lender Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['lender']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/lender" element={<LenderOverview />} />
                <Route path="/lender/requests" element={<RequestsQueuePage />} />
                <Route path="/lender/completed" element={<CompletedLoansPage />} />
              </Route>
            </Route>

            {/* Admin Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/verification" element={<AdminVerificationPage />} />
                <Route path="/admin/settings" element={<EligibilitySettingsPage />} />
                <Route path="/admin/monitoring" element={<LoanMonitoringPage />} />
                <Route path="/admin/reports" element={<ReportsPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
              </Route>
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}