import React from 'react';
import { FileCheck2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Pill } from '../common/CommonUI';
import Button from '../common/Button';

export const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function LoanTable({ loans = [], onOpen, role = 'applicant' }) {
  if (!loans.length) {
    return (
      <div className="grid place-items-center py-14 text-center">
        <span className="rounded-2xl bg-slate-100 p-4 text-slate-400">
          <FileCheck2 size={25} />
        </span>
        <p className="mt-4 font-semibold text-slate-700">No applications found</p>
        <p className="mt-1 text-sm text-slate-500">Applications will appear here once submitted.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 font-semibold">Applicant / ID</th>
            <th className="px-4 py-3 font-semibold">Loan Amount</th>
            <th className="px-4 py-3 font-semibold">Credit Score</th>
            <th className="px-4 py-3 font-semibold">Submitted</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loans.map((l) => {
            const score = l.verified_credit_score || l.score || l.declared_credit_score;
            return (
              <tr key={l.id} className="hover:bg-slate-50/70 transition">
                <td className="px-4 py-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {l.applicant_name || l.name || 'Applicant'}
                  </p>
                  <div className="mt-0.5 text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>{l.application_number ? `LN-2026-${String(l.application_number).padStart(4, '0')}` : l.id} · {l.purpose}</span>
                    {l.transaction_hash && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono border border-emerald-200" title={`On-chain Tx: ${l.transaction_hash}`}>
                        <ShieldCheck size={10} className="text-emerald-600" />
                        {l.transaction_hash.slice(0, 6)}...
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                  {money(l.requested_amount || l.amount)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`text-sm font-semibold ${
                      score >= 750
                        ? 'text-emerald-700'
                        : score >= 700
                        ? 'text-amber-700'
                        : score
                        ? 'text-rose-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {score || '—'}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {l.submitted_at
                    ? new Date(l.submitted_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : l.date || 'Recent'}
                </td>
                <td className="px-4 py-4">
                  <Pill>{l.admin_status === 'needs_correction' ? 'Needs Correction' : l.status}</Pill>
                </td>
                <td className="px-4 py-4 text-right">
                  <Button
                    variant="secondary"
                    className="!px-3 !py-2 text-xs"
                    onClick={() => onOpen(l)}
                  >
                    {role === 'lender' && (l.status === 'compliance_verified' || l.status === 'requested') ? 'Review' : 'Details'}
                    <ArrowRight size={13} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
