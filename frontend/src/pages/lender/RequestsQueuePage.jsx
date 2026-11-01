import React, { useState, useEffect } from 'react';
import { Search, Filter, Clock3 } from 'lucide-react';
import { Input, Select } from '../../components/common/FormElements';
import LoanTable from '../../components/loans/LoanTable';
import LoanReviewModal from './LoanReviewModal';
import { api } from '../../services/api';

export default function RequestsQueuePage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    async function loadLoans() {
      try {
        const res = await api.get('/loans/requests');
        const raw = res.data?.loans || res.data?.applications || res.loans || [];
        const mapped = raw.map(loan => ({
          ...loan,
          name: loan.applicant_name || loan.name,
          amount: parseFloat(loan.requested_amount || loan.amount),
          score: loan.declared_credit_score || loan.profile_credit_score || loan.score,
          income: parseFloat(loan.profile_monthly_income || loan.income || 0),
          date: loan.submitted_at ? new Date(loan.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : loan.date,
          docs: loan.doc_count || loan.docs || 0,
        }));
        setLoans(mapped);
      } catch {
        // API error — keep empty state
      } finally {
        setLoading(false);
      }
    }
    loadLoans();
  }, []);

  const handleOpenLoan = async (loan) => {
    try {
      const res = await api.get(`/loans/${loan.id}`);
      const detail = res.data?.loan || res.loan || res.data || {};
      const docs = res.data?.documents || res.documents || [];
      setSelectedLoan({
        ...loan,
        ...detail,
        documents: docs,
      });
    } catch {
      setSelectedLoan(loan);
    }
  };

  const handleDecision = async (loanId, newStatus, reason) => {
    try {
      await api.patch(`/loans/${loanId}/decision`, {
        status: newStatus,
        reason,
      });
    } catch {
      // Prototype update
    }
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: newStatus, lender_decision_reason: reason } : l))
    );
  };

  const handleReturn = async (loanId, reason) => {
    await api.patch(`/loans/${loanId}/return`, { reason });
    // Application is returned to admin, so remove it from lender's immediate pending queue
    setLoans((prev) => prev.filter((l) => l.id !== loanId));
  };

  const filteredLoans = loans.filter((l) => {
    const term = `${l.id} ${l.name} ${l.purpose}`.toLowerCase();
    const matchesSearch = term.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'pending'
        ? ['requested', 'under_review', 'compliance_verified'].includes(l.status.toLowerCase())
        : l.status.toLowerCase() === statusFilter.toLowerCase());
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">Loan Applications Queue</h2>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter by underwriting status, and inspect borrower profiles and verification proofs.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, ID, or purpose..."
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Applications</option>
            <option value="pending">Pending Underwriting</option>
            <option value="compliance_verified">Compliance Verified</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>

      {/* Loan Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Clock3 size={18} className="animate-spin" />
            <span className="text-sm">Loading loan requests...</span>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No loan requests in queue. Applications will appear here after admin verification.
          </div>
        ) : (
          <LoanTable loans={filteredLoans} onOpen={handleOpenLoan} role="lender" />
        )}
      </div>

      {/* Review Modal */}
      <LoanReviewModal
        loan={selectedLoan}
        isOpen={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onDecide={handleDecision}
        onReturn={handleReturn}
      />
    </div>
  );
}
