import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Clock3,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import { Stat } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import LoanTimeline from '../../components/loans/LoanTimeline';
import LoanTable, { money } from '../../components/loans/LoanTable';
import Modal from '../../components/common/Modal';
import BlockchainBadge from '../../components/loans/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function ApplicantOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [appsRes, profileRes] = await Promise.allSettled([
          api.get('/applications/me'),
          api.get('/applicants/me'),
        ]);

        if (appsRes.status === 'fulfilled' && appsRes.value?.applications) {
          setLoans(appsRes.value.applications);
        } else {
          setLoans([]);
        }

        if (profileRes.status === 'fulfilled' && profileRes.value?.profile) {
          setProfile(profileRes.value.profile);
        }
      } catch (err) {
        console.warn('Dashboard data load error:', err.message);
        setLoans([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const latestLoan = loans[0] || null;
  const activeLoans = loans.filter((l) => ['approved', 'ongoing'].includes(l.status));
  const outstandingBalance = activeLoans.reduce((sum, l) => sum + Number(l.requested_amount || 0), 0);
  const pendingCount = loans.filter((l) => ['requested', 'under_review'].includes(l.status)).length;

  return (
    <div className="space-y-7">
      {/* Page Title & Action */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Welcome back, {user?.full_name || 'Applicant'}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Applicant Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track your active loan applications, upcoming EMI instalments, and verification statuses.
          </p>
        </div>
        <Button onClick={() => navigate('/applicant/apply')} className="shadow-md">
          <Plus size={17} /> Apply for New Loan
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Outstanding Balance"
          value={money(outstandingBalance)}
          change={activeLoans.length > 0 ? `${activeLoans.length} active loan(s)` : 'No active debt'}
          icon={Wallet}
          tone="blue"
        />
        <Stat
          label="Monthly Income"
          value={profile?.monthly_income ? money(profile.monthly_income) : 'Not Declared'}
          change={profile?.monthly_income ? 'Declared income' : 'Update in application'}
          icon={Clock3}
          tone="amber"
        />
        <Stat
          label="Total Applications"
          value={String(loans.length)}
          change={`${pendingCount} under review`}
          icon={FileText}
          tone="violet"
        />
        <Stat
          label="Credit Profile"
          value={profile?.declared_credit_score ? String(profile.declared_credit_score) : (latestLoan?.declared_credit_score ? String(latestLoan.declared_credit_score) : '—')}
          change="Declared CIBIL"
          icon={CreditCard}
          tone="green"
        />
      </div>

      {/* Main Grid: Lifecycle Timeline & Quick Actions */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <LoanTimeline currentStatus={latestLoan?.status || 'requested'} />

        {/* Quick Actions Panel */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-ink text-base">Quick Actions</h3>
            <p className="mt-0.5 text-xs text-slate-500">Manage your borrow profile and payments.</p>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => navigate('/applicant/apply')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/50 transition group"
              >
                <span className="rounded-xl bg-blue-50 p-2.5 text-brand group-hover:bg-blue-100 transition shrink-0">
                  <Plus size={19} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-sm text-slate-800">Apply for a Loan</b>
                  <small className="mt-0.5 block text-slate-500 truncate">Submit income proofs & requested tenure</small>
                </span>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition" />
              </button>

              <button
                onClick={() => navigate('/applicant/repayments')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/50 transition group"
              >
                <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 group-hover:bg-emerald-100 transition shrink-0">
                  <Wallet size={19} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-sm text-slate-800">Repayment Schedule</b>
                  <small className="mt-0.5 block text-slate-500 truncate">Review upcoming EMI and payment receipts</small>
                </span>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition" />
              </button>

              <button
                onClick={() => navigate('/applicant/documents')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/50 transition group"
              >
                <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700 group-hover:bg-violet-100 transition shrink-0">
                  <FileCheck2 size={19} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-sm text-slate-800">Verification Documents</b>
                  <small className="mt-0.5 block text-slate-500 truncate">Upload KYC, Aadhaar, PAN & salary slips</small>
                </span>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition" />
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-3.5 border border-slate-200/60 text-xs text-slate-500 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <span>All personal documents are encrypted in private storage and strictly restricted to authorized lenders.</span>
          </div>
        </div>
      </div>

      {/* Recent Applications Section */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-ink text-base">My Recent Applications</h3>
            <p className="mt-0.5 text-xs text-slate-500">Live records registered under your account.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/applicant/applications')} className="text-xs">
            View All Applications <ArrowRight size={13} />
          </Button>
        </div>
        <LoanTable loans={loans} onOpen={setSelectedLoan} role="applicant" />
      </div>

      {/* Detail Modal */}
      {selectedLoan && (
        <Modal
          isOpen={!!selectedLoan}
          onClose={() => setSelectedLoan(null)}
          title={`Loan Application ${selectedLoan.application_number ? `LN-2026-${String(selectedLoan.application_number).padStart(4, '0')}` : selectedLoan.id}`}
          subtitle={`Submitted on ${new Date(selectedLoan.submitted_at || Date.now()).toLocaleDateString('en-IN')}`}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Requested Amount</span>
                <p className="text-sm font-bold text-ink mt-1">{money(selectedLoan.requested_amount || selectedLoan.amount)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Purpose</span>
                <p className="text-sm font-bold text-ink mt-1">{selectedLoan.purpose}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Tenure</span>
                <p className="text-sm font-bold text-ink mt-1">{selectedLoan.tenure_months || 24} Months</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Status</span>
                <p className="text-sm font-bold capitalize text-brand mt-1">{selectedLoan.status}</p>
              </div>
            </div>

            {/* Blockchain Audit Badge */}
            <BlockchainBadge
              txHash={selectedLoan.transaction_hash}
              contractAddress={selectedLoan.contract_address}
              network={selectedLoan.network}
              status={selectedLoan.blockchain_status || 'confirmed'}
            />

            <div className="p-4 rounded-xl border border-slate-200">
              <h4 className="font-semibold text-sm text-slate-800">Verification & Review Notice</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your application is currently being verified against declared income and uploaded documents.
                Once an authorized lender approves your terms, an auditable smart contract entry will be initialized.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedLoan(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
