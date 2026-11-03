import React from 'react';
import { Blocks, ArrowUpRight } from 'lucide-react';

export const statusStyles = {
  Requested: 'bg-amber-50 text-amber-700 ring-amber-200',
  requested: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Under Review': 'bg-blue-50 text-blue-700 ring-blue-200',
  under_review: 'bg-blue-50 text-blue-700 ring-blue-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  Ongoing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  ongoing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Completed: 'bg-violet-50 text-violet-700 ring-violet-200',
  completed: 'bg-violet-50 text-violet-700 ring-violet-200',
  Repaid: 'bg-slate-100 text-slate-700 ring-slate-200',
  repaid: 'bg-slate-100 text-slate-700 ring-slate-200',
  Verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Needs Review': 'bg-orange-50 text-orange-700 ring-orange-200',
  needs_correction: 'bg-amber-100 text-amber-900 ring-amber-300 font-bold',
  'Needs Correction': 'bg-amber-100 text-amber-900 ring-amber-300 font-bold',
  compliance_verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  compliance_rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function Pill({ children, className = '' }) {
  const style = statusStyles[children] || 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${style} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
      {String(children).replace(/_/g, ' ')}
    </span>
  );
}

export function Stat({ label, value, change, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
        </div>
        {Icon && (
          <span className={`rounded-xl p-3 ${tones[tone] || tones.blue}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
      {change && (
        <p className="mt-4 flex items-center gap-1 text-xs text-slate-500">
          <ArrowUpRight size={14} className="text-emerald-600" />
          <span className="font-semibold text-emerald-600">{change}</span>
        </p>
      )}
    </div>
  );
}

export function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-sm">
        <Blocks size={22} />
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        Cred<span className="text-brand">Chain</span>
      </span>
    </div>
  );
}
