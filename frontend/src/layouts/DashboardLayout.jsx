import React, { useState, useEffect, useRef } from 'react';
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
  CheckCheck,
} from 'lucide-react';
import { Logo } from '../components/common/CommonUI';
import { useAuth, normalizeRole } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

export default function DashboardLayout() {
  const { user, role, rawRole, logout } = useAuth();
  const { info, success } = useToast();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function loadNotifs() {
      try {
        const res = await api.get('/notifications');
        if (res && Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
          setUnreadCount(res.unread_count || 0);
        }
      } catch (err) {
        // Silent catch for guest / offline mode
      }
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 25000); // Poll every 25s for updates
    return () => clearInterval(interval);
  }, []);

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (n) => {
    if (!n.is_read) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    if (n.link) {
      setShowNotifs(false);
      navigate(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      success('All notifications marked as read.');
    } catch {}
  };

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
            {/* Interactive Notifications Popover */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs((prev) => !prev)}
                className={`relative rounded-xl border p-2.5 transition ${
                  showNotifs
                    ? 'border-brand bg-blue-50 text-brand'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-brand">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                      >
                        <CheckCheck size={14} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <Bell size={24} className="mx-auto mb-2 opacity-40" />
                        No notifications yet. You're all caught up!
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n)}
                          className={`p-3.5 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3 ${
                            !n.is_read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <span
                            className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                              !n.is_read ? 'bg-brand ring-4 ring-blue-100' : 'bg-slate-300'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                            <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            <span className="mt-1 block text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
