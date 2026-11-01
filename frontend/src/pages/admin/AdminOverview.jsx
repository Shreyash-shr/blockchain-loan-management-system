import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  BadgeCheck,
  XCircle,
  Wallet,
  Users,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Stat } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import { api } from '../../services/api';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalApplications: 0,
    approvedLoans: 0,
    rejectedLoans: 0,
    completedLoans: 0,
    ongoingLoans: 0,
    requestedLoans: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await api.get('/admin/dashboard');
        const dashboard = res.data?.dashboard || res.dashboard;
        if (dashboard) {
          const apps = dashboard.applications || {};
          setStats({
            totalApplications: Number(apps.total) || 0,
            approvedLoans: Number(apps.approved) || 0,
            rejectedLoans: Number(apps.rejected) || 0,
            completedLoans: Number(apps.completed) || 0,
            ongoingLoans: Number(apps.ongoing) || 0,
            requestedLoans: Number(apps.requested) || 0,
          });
          if (Array.isArray(dashboard.daily_stats) && dashboard.daily_stats.length > 0) {
            setChartData(
              dashboard.daily_stats.map((d) => ({
                day: d.date || d.day || '',
                approved: Number(d.approved) || 0,
                requested: Number(d.requested) || 0,
              }))
            );
          }
        }
      } catch {
        // API unavailable – keep zero defaults
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const total = stats.approvedLoans + stats.requestedLoans + stats.ongoingLoans + stats.rejectedLoans || 1;
  const pct = (v) => `${Math.round((v / total) * 100)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Administrative Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time platform metrics: track loan velocity, approval rates, and ledger settlement events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/admin/reports')}>
            View Analytics Reports
          </Button>
          <Button onClick={() => navigate('/admin/monitoring')}>
            Loan Monitoring <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Applications"
          value={String(stats.totalApplications)}
          change="+12.8% vs last month"
          icon={FileText}
          tone="blue"
        />
        <Stat
          label="Approved by Lenders"
          value={String(stats.approvedLoans)}
          change="+8.2% acceptance"
          icon={BadgeCheck}
          tone="green"
        />
        <Stat
          label="Underwriting Rejections"
          value={String(stats.rejectedLoans)}
          change="12.5% rejection rate"
          icon={XCircle}
          tone="rose"
        />
        <Stat
          label="Completed & Closed"
          value={String(stats.completedLoans)}
          change="+14.6% portfolio"
          icon={Wallet}
          tone="violet"
        />
      </div>

      {/* Charts & Distribution */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Recharts Area Chart */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-ink text-base">Application & Underwriting Velocity</h3>
              <p className="mt-0.5 text-xs text-slate-500">Daily requested loans vs. lender approvals</p>
            </div>
            <span className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Last {chartData.length || 0} Days
            </span>
          </div>

          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="approvedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3659E3" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3659E3" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF0F6" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#98A2B3' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="requested"
                  name="Requested"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stroke="#3659E3"
                  strokeWidth={2.5}
                  fill="url(#approvedFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex gap-6 text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-full bg-brand inline-block" />
              Approved Applications
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-full bg-slate-400 inline-block" />
              Requested Applications
            </span>
          </div>
        </section>

        {/* Portfolio Distribution */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-ink text-base">Loan Status Distribution</h3>
            <p className="mt-0.5 text-xs text-slate-500">Current active portfolio breakdown</p>

            <div className="mt-6 space-y-4">
              {[
                ['Approved', stats.approvedLoans, pct(stats.approvedLoans), 'bg-emerald-500'],
                ['Requested', stats.requestedLoans, pct(stats.requestedLoans), 'bg-amber-400'],
                ['Ongoing', stats.ongoingLoans, pct(stats.ongoingLoans), 'bg-blue-500'],
                ['Rejected', stats.rejectedLoans, pct(stats.rejectedLoans), 'bg-rose-400'],
              ].map(([status, count, pct, barColor]) => (
                <div key={status}>
                  <div className="mb-1.5 flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 font-medium">{status}</span>
                    <span className="font-semibold text-slate-800">
                      {count} <span className="text-xs font-normal text-slate-400">({pct})</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="secondary"
            className="mt-6 w-full text-xs"
            onClick={() => navigate('/admin/monitoring')}
          >
            Inspect Individual Loans <ArrowRight size={14} />
          </Button>
        </section>
      </div>
    </div>
  );
}
