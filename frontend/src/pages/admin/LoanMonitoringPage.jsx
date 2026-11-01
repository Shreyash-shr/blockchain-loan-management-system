import React, { useState, useEffect } from 'react';
import { Search, Filter, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { Input, Select } from '../../components/common/FormElements';
import LoanTable, { money } from '../../components/loans/LoanTable';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import BlockchainBadge from '../../components/loans/BlockchainBadge';
import { api } from '../../services/api';

export default function LoanMonitoringPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    async function loadLoans() {
      try {
        const res = await api.get('/admin/loans');
        const raw = res.data?.loans || res.loans || [];
        const mapped = raw.map(loan => ({
          ...loan,
          name: loan.applicant_name || loan.name,
          amount: parseFloat(loan.requested_amount || loan.amount),
          score: loan.declared_credit_score || loan.score,
          income: parseFloat(loan.monthly_income || loan.profile_monthly_income || loan.income || 0),
          date: loan.submitted_at ? new Date(loan.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : loan.date,
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

  const filteredLoans = loans.filter((l) => {
    const term = `${l.id} ${l.name} ${l.purpose} ${l.status}`.toLowerCase();
    const matchesSearch = term.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">System Loan Monitoring</h2>
        <p className="mt-1 text-sm text-slate-500">
          Admin surveillance: inspect real-time application pipelines, decisions, and on-chain status across all borrowers.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, applicant name, or purpose..."
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-60">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses ({loans.length})</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
      </div>

      {/* Loan Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Activity size={18} className="animate-spin" />
            <span className="text-sm">Loading loan records...</span>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No loan records found. Loan applications will appear here once submitted.
          </div>
        ) : (
          <LoanTable loans={filteredLoans} onOpen={setSelectedLoan} role="admin" />
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedLoan && (
        <Modal
          isOpen={!!selectedLoan}
          onClose={() => setSelectedLoan(null)}
          title={`Administrative Audit: ${selectedLoan.application_number ? `LN-2026-${String(selectedLoan.application_number).padStart(4, '0')}` : selectedLoan.id}`}
          subtitle={`Applicant: ${selectedLoan.name || selectedLoan.applicant_name || 'Verified Borrower'} · Date: ${selectedLoan.date || 'Recent'}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Principal</span>
                <p className="text-sm font-bold text-ink mt-0.5">{money(selectedLoan.amount)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Monthly Income</span>
                <p className="text-sm font-bold text-ink mt-0.5">{money(selectedLoan.income)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Credit Score</span>
                <p className={`text-sm font-bold mt-0.5 ${
                  (selectedLoan.score || 0) >= 750
                    ? 'text-emerald-700'
                    : (selectedLoan.score || 0) >= 700
                    ? 'text-amber-600'
                    : selectedLoan.score
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }`}>
                  {selectedLoan.score || '—'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500">Status</span>
                <p className="text-sm font-bold text-brand mt-0.5 capitalize">{selectedLoan.status}</p>
              </div>
            </div>

            {/* Blockchain Audit Badge */}
            <BlockchainBadge
              txHash={selectedLoan.transaction_hash}
              contractAddress={selectedLoan.contract_address}
              network={selectedLoan.network}
              status={selectedLoan.blockchain_status || 'confirmed'}
            />

            <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wide">
                <ShieldCheck size={15} className="text-brand" />
                <span>Security & Immutability Audit</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Administrators have read-only audit visibility over lending decisions. In accordance with CredChain security policy, financial decisions cannot be unilaterally modified without authorized lender underwriting.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedLoan(null)}>
                Close Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
