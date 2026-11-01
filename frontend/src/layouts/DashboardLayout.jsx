import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Wallet,
  FileCheck2,
  Clock3,
  BadgeCheck,
  Activity,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  LockKeyhole,
  ArrowRight,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { Logo } from '../components/common/CommonUI';
import { useAuth, normalizeRole } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DashboardLayout() {
  const { user, role, rawRole, logout } = useAuth();
  const { info } = useToast();
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavItems = () => {
    const r = normalizeRole(rawRole || user?.role);
    if (r === 'lender') {
      return [
        { path: '/lender', label: 'Overview', icon: LayoutDashboard, end: true },
        { path: '/lender/requests', label: 'Loan Requests', icon: Clock3 },
        { path: '/lender/completed', label: 'Completed Loans', icon: BadgeCheck },
      ];
    }
    if (r === 'admin') {
      return [
        { path: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { path: '/admin/verification', label: 'Doc Verification', icon: FileCheck2 },
        { path: '/admin/settings', label: 'Eligibility Settings', icon: Sliders },
        { path: '/admin/monitoring', label: 'Loan Monitoring', icon: Activity },
        { path: '/admin/reports', label: 'Reports & Analytics', icon: FileText },
        { path: '/admin/users', label: 'User Directory', icon: Users },
      ];
    }
    return [
      { path: '/applicant', label: 'Overview', icon: LayoutDashboard, end: true },
      { path: '/applicant/applications', label: 'My Applications', icon: FileText },
      { path: '/applicant/apply', label: 'Apply for Loan', icon: ArrowRight },
      { path: '/applicant/repayments', label: 'Repayments', icon: Wallet },
      { path: '/applicant/documents', label: 'My Documents', icon: FileCheck2 },
    ];
  };

  const navItems = getNavItems();
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'CC';

  const roleLabel = role === 'Lender' ? 'Lender' : role || 'Applicant';

  return (
    <div className="min-h-screen bg-[#F7F8FC]">
      {/* Mobile Drawer Backdrop */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Logo />
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="mx-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 font-bold text-brand shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.full_name || 'CredChain User'}
              </p>
              <p className="text-xs text-slate-500 capitalize">{roleLabel} Workspace</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map(({ path, label, icon: Icon, end }) => {
              const isActive = end ? location.pathname === path : location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileMenu(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-blue-50 text-brand shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Secure Lending Info Banner */}
          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole size={16} className="text-blue-300" /> Secure Lending
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">
              Zero PII on public ledger. Cryptographic audit trail enabled.
            </p>
            <button
              onClick={() => info('CredChain Architecture: Verified off-chain state committed to ledger.')}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200"
            >
              Security docs <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Bottom Sticky Sign Out Bar */}
        <div className="flex-shrink-0 p-3 border-t border-slate-100 bg-white">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden text-slate-600"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-medium text-slate-400">CredChain / {roleLabel}</p>
              <h1 className="mt-0.5 text-lg font-bold text-ink">
                {roleLabel === 'Lender' ? 'Lender Portal' : roleLabel === 'Admin' ? 'Admin Portal' : 'Applicant Portal'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex items-center">
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              CredChain Secure
            </span>
            <button
              onClick={() => info('All system notifications are up to date.')}
              className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
              title="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {initials}
            </div>
          </div>
        </header>

        {/* Routed Page Container */}
        <main className="mx-auto max-w-[1440px] w-full p-4 sm:p-8 flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 px-8 py-5 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2026 CredChain · Blockchain-audited loan management system</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500" /> Server-side RBAC & Smart Contract Auditing
          </span>
        </footer>
      </div>
    </div>
  );
}
