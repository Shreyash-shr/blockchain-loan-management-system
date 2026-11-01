import React from 'react';
import { Check, Clock3, AlertCircle } from 'lucide-react';
import { Pill } from '../common/CommonUI';

export default function LoanTimeline({ currentStatus = 'requested' }) {
  const normalizedStatus = (currentStatus || 'requested').toLowerCase();

  const getStepState = (stepIndex) => {
    // 0: Application submitted
    // 1: Verification
    // 2: Lender decision
    // 3: Smart contract
    // 4: Repayment & completion
    if (normalizedStatus === 'rejected') {
      if (stepIndex <= 1) return 'done';
      if (stepIndex === 2) return 'rejected';
      return 'wait';
    }
    if (normalizedStatus === 'requested') {
      if (stepIndex === 0) return 'done';
      if (stepIndex === 1) return 'active';
      return 'wait';
    }
    if (normalizedStatus === 'under_review') {
      if (stepIndex <= 1) return 'done';
      if (stepIndex === 2) return 'active';
      return 'wait';
    }
    if (normalizedStatus === 'approved') {
      if (stepIndex <= 2) return 'done';
      if (stepIndex === 3) return 'active';
      return 'wait';
    }
    if (normalizedStatus === 'ongoing') {
      if (stepIndex <= 3) return 'done';
      return 'active';
    }
    if (normalizedStatus === 'completed' || normalizedStatus === 'repaid') {
      return 'done';
    }
    return 'wait';
  };

  const steps = [
    { title: 'Application submitted', desc: 'Application received and registered in CredChain.' },
    { title: 'Identity & document verification', desc: 'KYC, income, and bank statement review.' },
    { title: 'Lender decision', desc: 'Authorized lender approves terms or requests information.' },
    { title: 'Smart contract commitment', desc: 'Auditable on-chain lifecycle record generated.' },
    { title: 'Repayment & completion', desc: 'Track EMIs until loan is fully repaid and closed.' },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-ink text-base">Loan Lifecycle Timeline</h3>
          <p className="mt-0.5 text-xs text-slate-500">Traceable audit status at every milestone.</p>
        </div>
        <Pill>{currentStatus}</Pill>
      </div>
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          const isDone = state === 'done';
          const isActive = state === 'active';
          const isRejected = state === 'rejected';

          return (
            <div className="relative flex gap-4 pb-6 last:pb-0" key={step.title}>
              <div className="flex flex-col items-center">
                <span
                  className={`z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : isActive
                      ? 'bg-blue-100 text-brand ring-4 ring-blue-50'
                      : isRejected
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <Check size={16} />
                  ) : isRejected ? (
                    <AlertCircle size={16} />
                  ) : isActive ? (
                    <Clock3 size={16} className="animate-pulse" />
                  ) : (
                    idx + 1
                  )}
                </span>
                {idx < steps.length - 1 && (
                  <span
                    className={`absolute top-8 h-full w-px ${
                      isDone ? 'bg-emerald-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <div className="pt-1">
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
