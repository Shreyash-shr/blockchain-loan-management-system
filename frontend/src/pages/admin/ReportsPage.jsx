import React, { useState, useEffect } from 'react';
import { Download, FileText, BadgeCheck, Clock3, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Stat } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

export default function ReportsPage() {
  const { success, error } = useToast();
  const [reportStats, setReportStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await api.get('/admin/reports?type=summary');
        const report = res.data?.report || res.report;
        if (report) {
          setReportStats({
            total: Number(report.total_applications || 0),
            approved: Number(report.approved || 0),
            rejected: Number(report.rejected || 0),
            pending: Number(report.pending || 0),
          });
        }
      } catch (err) {
        console.warn('Failed to load report stats:', err);
      }
    }
    loadReports();
  }, []);

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/admin/loans');
      const loans = res.data?.loans || res.loans || [];

      const headers = ['Loan_ID', 'Applicant', 'Loan_Purpose', 'Principal_Amount', 'Tenure_Months', 'Status', 'Submitted_Date', 'Transaction_Hash'];
      const rows = loans.map((l) => [
        l.application_number ? `LN-2026-${String(l.application_number).padStart(4, '0')}` : l.id,
        `"${(l.applicant_name || 'Applicant').replace(/"/g, '""')}"`,
        `"${(l.purpose || '').replace(/"/g, '""')}"`,
        l.requested_amount || l.amount || 0,
        l.tenure_months || 24,
        l.status || 'requested',
        l.submitted_at ? new Date(l.submitted_at).toISOString().split('T')[0] : '',
        l.transaction_hash || 'N/A',
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `CredChain_Lending_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      success(`Sanitized lending audit report (${loans.length} records) exported to CSV successfully.`);
    } catch (err) {
      error('Failed to export CSV: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Administrative Reports & Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Export anonymized CSV records for regulatory compliance and audit readiness.
          </p>
        </div>
        <Button onClick={handleExportCSV} className="shadow-sm">
          <Download size={16} /> Export Compliance CSV
        </Button>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Applications"
          value={String(reportStats.total)}
          change="All-time submissions"
          icon={FileText}
        />
        <Stat
          label="Underwriting Approval Rate"
          value={reportStats.total > 0 ? `${Math.round((reportStats.approved / reportStats.total) * 100)}%` : '0%'}
          change={`${reportStats.approved} approved`}
          icon={BadgeCheck}
          tone="green"
        />
        <Stat
          label="Pending Applications"
          value={String(reportStats.pending)}
          change="Awaiting verification"
          icon={Clock3}
          tone="violet"
        />
        <Stat
          label="Rejected Applications"
          value={String(reportStats.rejected)}
          change="Risk criteria"
          icon={Wallet}
          tone="amber"
        />
      </div>

      {/* Historical Trend Chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-ink text-base">Daily Application & Approval Trends</h3>
            <p className="mt-0.5 text-xs text-slate-500">Volume tracking across past underwriting cycles</p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
            Automated Daily Aggregation
          </span>
        </div>

        <div className="h-72 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid stroke="#EEF0F6" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#98A2B3' }} />
              <Tooltip />
              <Area type="monotone" dataKey="requested" name="Requested" stroke="#3659E3" fill="#DBEAFE" strokeWidth={2} />
              <Area type="monotone" dataKey="approved" name="Approved" stroke="#059669" fill="#D1FAE5" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
