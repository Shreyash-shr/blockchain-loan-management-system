import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import LoanTable, { money } from '../../components/loans/LoanTable';
import Modal from '../../components/common/Modal';
import BlockchainBadge from '../../components/loans/BlockchainBadge';
import LoanTimeline from '../../components/loans/LoanTimeline';
import { api } from '../../services/api';

export default function MyApplicationsPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApps() {
      try {
        const res = await api.get('/applications/me');
        if (res && Array.isArray(res.applications)) {
          setLoans(res.applications);
        } else {
          setLoans([]);
        }
      } catch (err) {
        console.warn('Could not fetch applications:', err.message);
        setLoans([]);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  const handleOpenLoan = async (loan) => {
    try {
      const res = await api.get(`/applications/${loan.id}`);
      setSelectedLoan(res);
    } catch {
      setSelectedLoan({ application: loan, documents: [], verification_checks: [] });
    }
  };

  const filteredLoans = loans.filter((l) => {
    const matchesSearch = `${l.id} ${l.purpose} ${l.status}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">My Loan Applications</h2>
          <p className="mt-1 text-sm text-slate-500">
            View historical submissions, track verification, and inspect lender review notes.
          </p>
        </div>
        <Button onClick={() => navigate('/applicant/apply')}>
          <Plus size={16} /> New Application
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or purpose..."
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft sm:p-6">
        {loading ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500 animate-pulse">Loading loan applications...</p>
          </div>
        ) : (
          <LoanTable loans={filteredLoans} onOpen={handleOpenLoan} role="applicant" />
        )}
      </div>

      {/* Modal */}
      {selectedLoan && (() => {
        const app = selectedLoan.application || selectedLoan;
        const docs = selectedLoan.documents || [];
        const checks = selectedLoan.verification_checks || [];
        const txs = selectedLoan.blockchain_transactions || [];
        const appRef = app.application_number ? `LN-2026-${String(app.application_number).padStart(4, '0')}` : app.id;

        return (
          <Modal
            isOpen={!!selectedLoan}
            onClose={() => setSelectedLoan(null)}
            title={`Loan Application Reference: ${appRef}`}
            subtitle={`Submitted on ${new Date(app.submitted_at || Date.now()).toLocaleDateString('en-IN')}`}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500">Amount</span>
                  <p className="text-base font-bold text-ink mt-0.5">{money(app.requested_amount || app.amount)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500">Purpose</span>
                  <p className="text-base font-bold text-ink mt-0.5">{app.purpose}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500">Tenure</span>
                  <p className="text-base font-bold text-ink mt-0.5">{app.tenure_months || 24} Months</p>
                </div>
              </div>

              {/* Blockchain Verification Badge */}
              <BlockchainBadge
                txHash={app.transaction_hash || (txs[0] && txs[0].transaction_hash)}
                contractAddress={app.contract_address || (txs[0] && txs[0].contract_address)}
                network={app.network || (txs[0] && txs[0].network)}
                status={app.blockchain_status || (txs[0] && txs[0].tx_status) || 'confirmed'}
              />

              {txs.length > 1 && (
                <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">All Blockchain Transactions ({txs.length})</h4>
                  <div className="space-y-1.5 text-xs">
                    {txs.map((tx) => (
                      <div key={tx.id || tx.transaction_hash} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold capitalize text-slate-700">{tx.transaction_type.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{tx.transaction_hash.slice(0, 10)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loan Lifecycle Status Timeline */}
              <LoanTimeline currentStatus={app.status} />

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Verification & Decision</h4>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Current State:</span>{' '}
                  <span className="capitalize font-bold text-brand">{app.status}</span>
                </p>
                {app.admin_remarks && (
                  <p className="text-xs text-slate-600 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                    <span className="font-semibold text-blue-900">Compliance Verification:</span> {app.admin_remarks}
                  </p>
                )}
                {app.lender_decision_reason && (
                  <p className="text-xs text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <span className="font-semibold text-amber-900">Lender Note:</span> {app.lender_decision_reason}
                  </p>
                )}
              </div>

              {docs.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Attached Documents ({docs.length})</h4>
                  <div className="space-y-1.5">
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg">
                        <span className="font-medium text-slate-700 capitalize">{d.document_type.replace('_', ' ')}: {d.original_filename}</span>
                        <span className="text-slate-400 capitalize bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">{d.verification_status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <Button variant="secondary" onClick={() => setSelectedLoan(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
