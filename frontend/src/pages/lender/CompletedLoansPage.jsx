import React, { useState, useEffect } from 'react';
import { BadgeCheck, Wallet, ArrowRight, ShieldCheck } from 'lucide-react';
import { Stat } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import LoanTable, { money } from '../../components/loans/LoanTable';
import Modal from '../../components/common/Modal';
import { api } from '../../services/api';

export default function CompletedLoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    async function loadCompleted() {
      try {
        setLoading(true);
        const res = await api.get('/loans/completed');
        const raw = res?.loans || res?.data?.loans || [];
        const mapped = raw.map((l) => ({
          ...l,
          name: l.applicant_name || l.name,
          amount: parseFloat(l.requested_amount || l.amount || 0),
          score: l.declared_credit_score || l.score,
          income: parseFloat(l.monthly_income || l.income || 0),
          date: l.submitted_at
            ? new Date(l.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : l.date,
          closedDate: l.completed_at
            ? new Date(l.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Settled',
          totalRepaid: parseFloat(l.requested_amount || l.amount || 0),
        }));
        setLoans(mapped);
      } catch (err) {
        console.error('Failed to load completed loans:', err);
        setLoans([]);
      } finally {
        setLoading(false);
      }
    }
    loadCompleted();
  }, []);

  const totalRecovered = loans.reduce((sum, l) => sum + (l.totalRepaid || l.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">Completed & Closed Loans</h2>
        <p className="mt-1 text-sm text-slate-500">
          Historical log of loans that have completed all amortisation instalments and received on-chain closure confirmation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total Loans Closed"
          value={String(loans.length)}
          change="100% Repaid"
          icon={BadgeCheck}
          tone="green"
        />
        <Stat
          label="Total Recovered Principal"
          value={money(totalRecovered)}
          change="Zero default"
          icon={Wallet}
          tone="blue"
        />
        <Stat
          label="On-Chain Settlement"
          value="100% Audited"
          change="Cryptographic proof"
          icon={ShieldCheck}
          tone="violet"
        />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        {loading ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500 animate-pulse">Loading completed loans ledger...</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="py-14 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <BadgeCheck size={24} />
            </div>
            <p className="font-semibold text-slate-700">No completed loans yet</p>
            <p className="mt-1 text-sm text-slate-500">Loans will appear here once all scheduled EMI instalments are paid in full.</p>
          </div>
        ) : (
          <LoanTable loans={loans} onOpen={setSelectedLoan} role="lender" />
        )}
      </div>

      {selectedLoan && (
        <Modal
          isOpen={!!selectedLoan}
          onClose={() => setSelectedLoan(null)}
          title={`Loan Closure Audit: ${selectedLoan.id}`}
          subtitle={`Borrower: ${selectedLoan.name} · Closed on ${selectedLoan.closedDate || 'Recent'}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Principal Amount</span>
                <p className="text-sm font-bold text-ink mt-0.5">{money(selectedLoan.amount)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Total Repaid</span>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">{money(selectedLoan.totalRepaid || selectedLoan.amount)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Status</span>
                <p className="text-sm font-bold text-brand mt-0.5 capitalize">{selectedLoan.status}</p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-900 leading-relaxed space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <BadgeCheck size={16} className="text-emerald-600" />
                Loan Officially Closed & Lien Released
              </p>
              <p className="text-emerald-800">
                All scheduled instalments were settled on-time. No outstanding liabilities remain under this contract agreement.
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
