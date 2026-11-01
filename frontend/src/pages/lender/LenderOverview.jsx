import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, BadgeCheck, XCircle, Wallet, ArrowRight } from 'lucide-react';
import { Stat } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import LoanTable from '../../components/loans/LoanTable';
import LoanReviewModal from './LoanReviewModal';
import { api } from '../../services/api';

export default function LenderOverview() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        setLoading(true);
        const res = await api.get('/loans/requests');
        const raw = res?.loans || res?.data?.loans || [];
        const mapped = raw.map((loan) => ({
          ...loan,
          name: loan.applicant_name || loan.name,
          amount: parseFloat(loan.requested_amount || loan.amount || 0),
          score: loan.declared_credit_score || loan.profile_credit_score || loan.score,
          income: parseFloat(loan.profile_monthly_income || loan.income || 0),
          date: loan.submitted_at
            ? new Date(loan.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : loan.date,
          docs: loan.doc_count || loan.docs || 0,
        }));
        setLoans(mapped);
      } catch (err) {
        console.error('Failed to load lender overview:', err);
        setLoans([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, []);

  const handleDecision = async (loanId, newStatus, reason) => {
    try {
      await api.patch(`/loans/${loanId}/decision`, {
        status: newStatus,
        reason,
      });
    } catch {
      // In-memory update
    }
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: newStatus, lender_decision_reason: reason } : l))
    );
  };

  const pendingLoans = loans.filter((l) => ['requested', 'under_review', 'compliance_verified'].includes(l.status));
  const approvedCount = loans.filter((l) => l.status === 'approved').length;
  const rejectedCount = loans.filter((l) => l.status === 'rejected').length;
  const completedCount = loans.filter((l) => ['completed', 'repaid'].includes(l.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Underwriting & Loan Decisions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Authorized lender queue: inspect verified KYC documents, credit scores, and log decisions.
          </p>
        </div>
        <Button onClick={() => navigate('/lender/requests')}>
          View Full Request Queue <ArrowRight size={16} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Pending Underwriting"
          value={String(pendingLoans.length)}
          change="Awaiting decision"
          icon={Clock3}
          tone="amber"
        />
        <Stat
          label="Approved Loans"
          value={String(approvedCount)}
          change="+8.2% this month"
          icon={BadgeCheck}
          tone="green"
        />
        <Stat
          label="Rejected Applications"
          value={String(rejectedCount)}
          change="Risk criteria"
          icon={XCircle}
          tone="rose"
        />
        <Stat
          label="Completed & Repaid"
          value={String(completedCount)}
          change="Settled loans"
          icon={Wallet}
          tone="violet"
        />
      </div>

      {/* Applications Awaiting Review Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        <div className="mb-5 flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
          <div>
            <h3 className="font-bold text-ink text-base">New Applications Awaiting Underwriting</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Click "Review" to verify submitted salary slips, CIBIL score, and authorize approval.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/lender/requests')} className="text-xs">
            Browse All ({loans.length}) <ArrowRight size={13} />
          </Button>
        </div>

        <LoanTable loans={pendingLoans.slice(0, 5)} onOpen={setSelectedLoan} role="lender" />
      </div>

      {/* Review Modal */}
      <LoanReviewModal
        loan={selectedLoan}
        isOpen={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onDecide={handleDecision}
      />
    </div>
  );
}
