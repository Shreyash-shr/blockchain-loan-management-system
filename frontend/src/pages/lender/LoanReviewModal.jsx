import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  User,
  Banknote,
  FileCheck2,
  Undo2,
  Eye,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { Pill } from '../../components/common/CommonUI';
import { money } from '../../components/loans/LoanTable';
import BlockchainBadge from '../../components/loans/BlockchainBadge';
import { useToast } from '../../context/ToastContext';

export default function LoanReviewModal({ loan, isOpen, onClose, onDecide, onReturn }) {
  const { success, error } = useToast();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!loan) return null;

  const appNum = loan.application_number
    ? `LN-2026-${String(loan.application_number).padStart(4, '0')}`
    : loan.id;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onDecide(loan.id, 'approved', 'Approved based on verified income and credit criteria');
      success(`Loan ${appNum} successfully approved! Smart-contract event queued.`);
      onClose();
    } catch (err) {
      error(err.message || 'Failed to approve application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      error('Please provide a specific rejection reason for the audit trail.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onDecide(loan.id, 'rejected', rejectReason.trim());
      success(`Loan ${appNum} has been rejected with recorded reason.`);
      onClose();
    } catch (err) {
      error(err.message || 'Failed to record rejection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToAdmin = async () => {
    if (!returnReason.trim()) {
      error('Please provide a specific reason explaining what needs admin re-verification.');
      return;
    }
    if (!onReturn) {
      error('Return action not configured.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onReturn(loan.id, returnReason.trim());
      success(`Loan ${appNum} returned to Admin for re-verification.`);
      onClose();
    } catch (err) {
      error(err.message || 'Failed to return loan application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scoreVal = Number(loan.score || loan.declared_credit_score || loan.verified_credit_score) || 0;
  const isCibilGood = scoreVal >= 750;
  const isCibilModerate = scoreVal >= 700 && scoreVal < 750;
  const isCibilLow = scoreVal > 0 && scoreVal < 700;

  const checklist = [
    { name: 'PAN card identity check', status: 'verified', valid: true },
    { name: 'Aadhaar / Address verification', status: 'verified', valid: true },
    { name: '6-Month bank statement analysis', status: !isCibilLow ? 'verified' : 'failed', valid: !isCibilLow },
    { name: 'Declared vs. verified income match', status: 'verified', valid: true },
    { name: 'Salary slip consistency', status: 'verified', valid: true },
    { name: 'Fraud & AML check', status: 'verified', valid: true },
  ];

  const isRejected = loan.status === 'rejected' || loan.admin_status === 'rejected';
  const isVerified = loan.admin_status === 'verified' || loan.status === 'compliance_verified';

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Application Underwriting Review: ${appNum}`}
      subtitle={`Applicant: ${loan.name || loan.applicant_name} · Requested on ${loan.date || 'Recent'}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500">Requested Principal</span>
            <p className="text-base font-bold text-ink mt-0.5">{money(loan.requested_amount || loan.amount)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500">Monthly Income</span>
            <p className="text-base font-bold text-ink mt-0.5">{money(loan.income || loan.declared_monthly_income || 65000)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500">Credit Score (CIBIL)</span>
            <p className={`text-base font-bold mt-0.5 ${
              isCibilGood
                ? 'text-emerald-700'
                : isCibilModerate
                ? 'text-amber-600'
                : isCibilLow
                ? 'text-rose-600'
                : 'text-slate-500'
            }`}>
              {scoreVal || '—'}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500">Documents Attached</span>
            <p className="text-base font-bold text-ink mt-0.5">{loan.docs || 6}/7 Verified</p>
          </div>
        </div>

        {/* Dynamic Admin Compliance / Rejection Banner */}
        {isRejected ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-900">
                <XCircle size={16} className="text-rose-600" />
                Underwriting & Compliance Notice
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                Rejected
              </span>
            </div>
            <p className="text-sm font-semibold text-rose-950">
              {loan.lender_decision_reason || loan.admin_remarks || 'Application did not meet underwriting thresholds.'}
            </p>
            {isCibilLow && (
              <p className="text-xs text-rose-800">
                Warning: Applicant CIBIL score ({scoreVal}) is below the institutional eligibility threshold (750).
              </p>
            )}
          </div>
        ) : isVerified ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                Admin Compliance Certification
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Verified by Admin
              </span>
            </div>
            <p className="text-sm font-semibold text-emerald-950">
              &ldquo;All documents are verified and conditions are met successfully.&rdquo;
            </p>
            <p className="text-xs text-emerald-800 leading-relaxed">
              <span className="font-semibold">Admin Remarks:</span>{' '}
              {loan.admin_remarks ||
                'Applicant passed all KYC inspections (PAN, Aadhaar, 6-month bank statement, salary slips) and satisfies eligibility policy. Cleared for lender loan disbursement decision.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Clock3 size={16} className="text-amber-600" />
                Compliance Verification Status
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Pending Admin Inspection
              </span>
            </div>
            <p className="text-sm font-semibold text-amber-950">
              Application is awaiting administrative compliance and document sign-off.
            </p>
          </div>
        )}

        {/* Blockchain Transaction Verification Badge */}
        <BlockchainBadge
          txHash={loan.transaction_hash}
          contractAddress={loan.contract_address}
          network={loan.network}
          status={loan.blockchain_status || 'confirmed'}
        />

        {/* Applicant Profile Information */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <User size={15} className="text-brand" />
            <span>Applicant & Underwriting Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Purpose</span>
              <span className="font-semibold text-slate-800">{loan.purpose || 'Personal expenses'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Requested Tenure</span>
              <span className="font-semibold text-slate-800">{loan.tenure_months || 24} Months</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Existing Debt Obligations</span>
              <span className="font-semibold text-slate-800">None / Low EMI burden</span>
            </div>
          </div>
        </div>

        {/* Attached Verification Proofs */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FileCheck2 size={15} className="text-emerald-600" />
              <span>Admin Verified Document Proofs ({loan.documents ? loan.documents.length : 6})</span>
            </div>
            <Pill>{loan.status}</Pill>
          </div>

          {loan.documents && loan.documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {loan.documents.map((doc) => (
                <div
                  key={doc.id || doc.key || doc.document_type}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 transition"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 capitalize truncate">
                      {(doc.document_type || doc.label || 'Document').replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {doc.original_filename || doc.filename || 'uploaded_proof.pdf'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        label: (doc.document_type || doc.label || 'Document').replace(/_/g, ' '),
                        filename: doc.original_filename || doc.filename,
                        status: doc.verification_status || 'valid',
                      })
                    }
                    className="flex items-center gap-1 text-xs font-medium text-brand hover:underline p-1 shrink-0"
                  >
                    <Eye size={13} /> View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {checklist.map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between text-xs p-2.5 rounded-lg border ${
                    item.valid
                      ? 'text-slate-700 bg-emerald-50/50 border-emerald-100'
                      : 'text-rose-800 bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`grid h-5 w-5 place-items-center rounded-full shrink-0 ${
                      item.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {item.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    </span>
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                      item.valid
                        ? 'text-emerald-700 bg-emerald-100/80'
                        : 'text-rose-700 bg-rose-100'
                    }`}>
                      {item.valid ? 'Valid' : 'Failed Policy'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          label: item.name,
                          filename: `${item.name.toLowerCase().replace(/\s+/g, '_')}_verified.pdf`,
                          status: item.valid ? 'valid' : 'invalid',
                        })
                      }
                      className="text-brand hover:underline p-0.5 shrink-0"
                      title="Inspect Proof"
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400 pt-1">
            * Read-only Document Store: Lenders have read-only inspection access without modification permissions.
          </p>
        </div>

        {/* Return to Admin Form (if opened) */}
        {showReturnInput && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Undo2 size={16} className="text-amber-700" />
              <span>Return Application to Admin for Re-verification</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Specify what was missed, documents needing re-check, or discrepancies for the compliance officer to resolve.
            </p>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="State clear reason (e.g. Bank statement duration insufficient, signature mismatch)..."
              className="w-full rounded-xl border border-amber-300 p-3 text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                className="!text-xs !py-1.5"
                onClick={() => setShowReturnInput(false)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="!text-xs !py-1.5 !bg-amber-600 !text-white hover:!bg-amber-700 border-none shadow-xs"
                onClick={handleReturnToAdmin}
                disabled={isSubmitting}
              >
                Confirm Return to Admin
              </Button>
            </div>
          </div>
        )}

        {/* Rejection Reason Form (if opened) */}
        {showRejectInput && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
              <AlertTriangle size={16} />
              <span>Mandatory Rejection Reason</span>
            </div>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State clear reasons for rejection (e.g. debt-to-income ratio exceeds threshold, unverified bank statements)..."
              className="w-full rounded-xl border border-rose-200 p-3 text-xs outline-none focus:ring-2 focus:ring-rose-400 bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                className="!text-xs !py-1.5"
                onClick={() => setShowRejectInput(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="!text-xs !py-1.5"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Close
          </Button>

          {['requested', 'under_review', 'compliance_verified'].includes(loan.status) ? (
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
              {!showRejectInput && !showReturnInput && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowReturnInput(true);
                      setShowRejectInput(false);
                    }}
                    disabled={isSubmitting}
                    className="!text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
                  >
                    <Undo2 size={14} /> Return to Admin
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setShowRejectInput(true);
                      setShowReturnInput(false);
                    }}
                    disabled={isSubmitting}
                    className="!text-xs"
                  >
                    <XCircle size={14} /> Reject Loan
                  </Button>
                </>
              )}
              <Button onClick={handleApprove} disabled={isSubmitting}>
                <CheckCircle2 size={16} /> Approve Loan Terms
              </Button>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              Decision already logged as <span className="capitalize text-slate-800">{loan.status}</span>
            </span>
          )}
        </div>
      </div>
    </Modal>

    {/* Read-Only Document Inspection Preview Lightbox Modal */}
    {previewDoc && (
      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={`Inspection Preview: ${previewDoc.label}`}
        subtitle={`Attached Proof: ${previewDoc.filename}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="h-72 w-full rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center border border-slate-800">
            <FileCheck2 size={44} className="text-brand mb-3" />
            <p className="font-semibold text-sm">{previewDoc.label}</p>
            <p className="text-xs text-slate-400 mt-1">{previewDoc.filename}</p>
            <p className="text-[11px] text-slate-500 max-w-sm mt-3">
              Protected Document Store: Content verified by Admin compliance team. Read-only view for authorized lender audit.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-slate-500">Admin verification status: <strong className="capitalize text-emerald-700">{previewDoc.status}</strong></span>
            <Button variant="secondary" onClick={() => setPreviewDoc(null)}>
              Close Preview
            </Button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
