import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Landmark, UserRound } from 'lucide-react';
import { Logo } from '../../components/common/CommonUI';

const WORKSPACES = [
  {
    role: 'applicant',
    title: 'Applicant',
    description: 'Apply for a loan, upload documents, and track repayments.',
    icon: UserRound,
  },
  {
    role: 'lender',
    title: 'Lender',
    description: 'Review verified applications and record lending decisions.',
    icon: Landmark,
  },
  {
    role: 'admin',
    title: 'Admin',
    description: 'Verify documents, set eligibility rules, and monitor the portfolio.',
    icon: ShieldCheck,
  },
];

export default function LoginChooser() {
  return (
    <div className="min-h-screen bg-[#F7F8FC] px-5 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <Logo />
        <div className="mt-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">CredChain</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Choose your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
            Each workspace signs in on its own page. Signing out of one tab leaves the other workspaces signed in.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WORKSPACES.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <Link
                key={workspace.role}
                to={`/login/${workspace.role}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition hover:border-brand hover:ring-4 hover:ring-blue-100"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand">
                  <Icon size={20} />
                </span>
                <h2 className="mt-5 text-lg font-bold text-ink">{workspace.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{workspace.description}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  Sign in
                  <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
