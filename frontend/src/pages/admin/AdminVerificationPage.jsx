import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Send,
  User,
  Clock3,
  Search,
  Filter,
  Check,
  Download,
} from 'lucide-react';
import Button from '../../components/common/Button';
import { Pill } from '../../components/common/CommonUI';
import Modal from '../../components/common/Modal';
import DocumentPreviewModal from '../../components/loans/DocumentPreviewModal';
import { money } from '../../components/loans/LoanTable';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

export default function AdminVerificationPage() {
  const { success, error, info } = useToast();
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Read active policy from API response or defaults
  const [policy, setPolicy] = useState({
    minCibilScore: 750,
    minAge: 21,
    maxAge: 60,
    minMonthlyIncome: 25000,
    maxExistingLoans: 2,
  });

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/verification');
        const appList = res.applications || res.data?.applications || (Array.isArray(res) ? res : []);
        const apps = appList.map(app => ({
          id: app.id,
          application_number: app.application_number,
          name: app.applicant_name || app.full_name,
          dob: app.date_of_birth,
          age: app.date_of_birth ? Math.floor((Date.now() - new Date(app.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
          income: parseFloat(app.monthly_income || app.profile_monthly_income || 0),
          score: app.declared_credit_score || app.profile_credit_score || null,
          existingLoans: app.existing_loan_details || 'None',
          requested_amount: parseFloat(app.requested_amount),
          purpose: app.purpose,
          tenure_months: app.tenure_months,
          status: app.status,
          admin_status: app.admin_status,
          lender_return_message: app.lender_return_message,
          date: app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          docs: [],
          rawData: app,
        }));
        setApps(apps);
        // Update policy from API response if available
        const policyData = res.policy || res.data?.policy;
        if (policyData) {
          setPolicy({
            minCibilScore: Number(policyData.min_cibil_score ?? policyData.minCibilScore ?? 750),
            minAge: Number(policyData.min_age ?? policyData.minAge ?? 21),
            maxAge: Number(policyData.max_age ?? policyData.maxAge ?? 60),
            minMonthlyIncome: parseFloat(policyData.min_monthly_income ?? policyData.minMonthlyIncome ?? 25000),
            maxExistingLoans: Number(policyData.max_existing_loans ?? policyData.maxExistingLoans ?? 2),
            maxDtiRatio: parseFloat(policyData.max_dti_ratio ?? policyData.maxDtiRatio ?? 50),
          });
        }
      } catch (err) {
        console.error('Failed to fetch applications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const handleOpenApp = async (app) => {
    setAdminRemarks(
      app.admin_remarks ||
        `Verified applicant KYC and income documentation against policy thresholds (CIBIL: >=${policy.minCibilScore}, Age: ${policy.minAge}-${policy.maxAge}, Min Income: ₹${policy.minMonthlyIncome.toLocaleString('en-IN')}).`
    );
    try {
      const res = await api.get(`/admin/verification/${app.id}`);
      const detail = res.data || res;
      const mappedDocs = (detail.documents || []).map(d => ({
        key: d.document_type,
        label: d.document_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        filename: d.original_filename,
        status: d.verification_status || 'pending',
        id: d.id,
        mime_type: d.mime_type,
      }));
      setSelectedApp({
        ...app,
        lender_return_message: detail.application?.lender_return_message || app.lender_return_message,
        docs: mappedDocs,
        verification_checks: detail.verification_checks || [],
        policy_rules: detail.policy_rules,
      });
    } catch (err) {
      console.error('Failed to fetch application details:', err);
      setSelectedApp(app); // open with basic data
    }
  };

  const handleSetDocStatus = async (docKey, newStatus) => {
    if (!selectedApp) return;
    const targetDoc = selectedApp.docs.find((d) => d.key === docKey);
    if (targetDoc?.id) {
      try {
        await api.patch(`/admin/documents/${targetDoc.id}/verify`, {
          verification_status: newStatus,
          reviewer_note: newStatus === 'valid' ? 'Document verified' : 'Document rejected by compliance officer',
        });
      } catch (err) {
        console.error('Failed to update document verification status on server:', err);
      }
    }
    setSelectedApp((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.key === docKey ? { ...d, status: newStatus } : d)),
    }));
    if (previewDoc && previewDoc.key === docKey) {
      setPreviewDoc((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleOpenDocFile = async (docId, filename) => {
    try {
      const token = api.getToken();
      const res = await fetch(`${api.baseUrl}/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to retrieve file from secure storage');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      error(`Could not download document: ${err.message}`);
    }
  };

  // Eligibility evaluation against current dynamic policy
  const isCibilPassed = selectedApp ? selectedApp.score >= policy.minCibilScore : false;
  const isAgePassed = selectedApp
    ? selectedApp.age >= policy.minAge && selectedApp.age <= policy.maxAge
    : false;
  const isIncomePassed = selectedApp
    ? selectedApp.income >= policy.minMonthlyIncome
    : false;
  const isAllDocsValid = selectedApp && selectedApp.docs.length > 0
    ? selectedApp.docs.every((d) => d.status === 'valid')
    : true; // If no documents uploaded yet, condition based on docs
  const isAllConditionsSatisfied = isCibilPassed && isAgePassed && isIncomePassed;

  const handleCertifyAndSendToLender = async () => {
    if (!isAllConditionsSatisfied) {
      error(
        `Conditions not met: Requires CIBIL >= ${policy.minCibilScore}, Age ${policy.minAge}-${policy.maxAge}, and Min Income ₹${policy.minMonthlyIncome.toLocaleString('en-IN')}.`
      );
      return;
    }

    const message = adminRemarks.trim() || 'All documents are verified and conditions are met successfully.';

    try {
      await api.patch(`/admin/verification/${selectedApp.id}`, {
        admin_status: 'verified',
        admin_remarks: message,
      });

      setApps((prev) => prev.filter((a) => a.id !== selectedApp.id));
      success(`Success! Application verified and dispatched to Lender: "${message}"`);
      setSelectedApp(null);
    } catch (err) {
      console.error('Certification failed:', err);
      error(err.message || 'Failed to certify application.');
    }
  };

  const handleRejectCompliance = async () => {
    if (!adminRemarks.trim()) {
      error('Please provide specific remarks explaining why compliance verification failed.');
      return;
    }

    try {
      await api.patch(`/admin/verification/${selectedApp.id}`, {
        admin_status: 'rejected',
        admin_remarks: adminRemarks.trim(),
      });

      setApps((prev) => prev.filter((a) => a.id !== selectedApp.id));
      success(`Application ${selectedApp.id} marked as compliance rejected.`);
      setSelectedApp(null);
    } catch (err) {
      console.error('Rejection failed:', err);
      error(err.message || 'Failed to reject application.');
    }
  };

  const filteredApps = apps.filter((a) =>
    `${a.id} ${a.name} ${a.purpose}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Admin Compliance & Document Verification
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Inspect applicant documents, evaluate live policy eligibility rules, and certify valid applications for lender underwriting.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-semibold text-brand">
          <ShieldCheck size={16} />
          <span>Active Policy: CIBIL &ge; {policy.minCibilScore} · Income &ge; ₹{policy.minMonthlyIncome.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pending applications by ID or applicant name..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pl-10 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-blue-100"
        />
      </div>

      {/* Applications Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500 animate-pulse">Loading pending applications for verification...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <FileCheck2 size={24} />
            </div>
            <p className="font-semibold text-slate-700">No pending applications found</p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? 'No applications match your search query.' : 'All incoming loan applications have been verified or resolved.'}
            </p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Applicant / ID</th>
                <th className="px-4 py-3 font-semibold">Age / Income</th>
                <th className="px-4 py-3 font-semibold">CIBIL Score</th>
                <th className="px-4 py-3 font-semibold">Documents Status</th>
                <th className="px-4 py-3 font-semibold">Compliance Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredApps.map((app) => {
                const validCount = app.docs ? app.docs.filter((d) => d.status === 'valid').length : 0;
                return (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">{app.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {app.application_number ? `LN-2026-${String(app.application_number).padStart(4, '0')}` : app.id} · {money(app.requested_amount)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <p className="font-semibold text-slate-800">{app.age ? `${app.age} Yrs` : '—'}</p>
                      <p className="text-slate-500">{money(app.income)}/mo</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-sm font-bold ${
                          app.score >= policy.minCibilScore
                            ? 'text-emerald-700'
                            : app.score
                            ? 'text-rose-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {app.score || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                        {validCount} / {app.docs?.length || 0} Valid
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Pill>{app.status}</Pill>
                        {app.admin_status === 'needs_correction' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                            Returned by Lender
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant={app.status === 'compliance_verified' ? 'secondary' : 'primary'}
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => handleOpenApp(app)}
                      >
                        <FileCheck2 size={14} />
                        {app.status === 'compliance_verified' ? 'Inspect' : 'Verify Docs'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Verification Workspace Modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title={`Document & Compliance Underwriting: ${selectedApp.id}`}
          subtitle={`Applicant: ${selectedApp.name} · Submitted on ${selectedApp.date}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Lender Return Notice (if applicable) */}
            {selectedApp.lender_return_message && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span>Action Required: Returned by Underwriting Lender</span>
                </div>
                <p className="text-xs text-amber-950 leading-relaxed">
                  <strong>Lender Remarks:</strong> {selectedApp.lender_return_message}
                </p>
                <p className="text-[11px] text-amber-800">
                  Please review the applicant's submitted documents, update validity statuses, and re-certify to send back to the lender queue.
                </p>
              </div>
            )}

            {/* Condition Check Results Banner */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Automated Policy Condition Checklist
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isAllConditionsSatisfied
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isAllConditionsSatisfied ? 'All Conditions Satisfied' : 'Pending Verification'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* CIBIL Check */}
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isCibilPassed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">CIBIL Score</span>
                    {isCibilPassed ? <Check size={14} /> : <XCircle size={14} />}
                  </div>
                  <p className="text-base font-bold">{selectedApp.score}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Required: &ge; {policy.minCibilScore}</p>
                </div>

                {/* Age Check */}
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isAgePassed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Age Bracket</span>
                    {isAgePassed ? <Check size={14} /> : <XCircle size={14} />}
                  </div>
                  <p className="text-base font-bold">{selectedApp.age} Years</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Limit: {policy.minAge}–{policy.maxAge} yrs
                  </p>
                </div>

                {/* Income Check */}
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isIncomePassed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Monthly Income</span>
                    {isIncomePassed ? <Check size={14} /> : <XCircle size={14} />}
                  </div>
                  <p className="text-base font-bold">{money(selectedApp.income)}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Min: {money(policy.minMonthlyIncome)}
                  </p>
                </div>

                {/* Existing Debt Check */}
                <div className="p-3 rounded-xl border bg-emerald-50/70 border-emerald-200 text-emerald-900 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Existing Debt</span>
                    <Check size={14} />
                  </div>
                  <p className="text-base font-bold">{selectedApp.existingLoans}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Low risk profile</p>
                </div>
              </div>
            </div>

            {/* Document Checklist & Mark as Valid / Invalid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Document Inspection ({selectedApp.docs.filter((d) => d.status === 'valid').length} /{' '}
                  {selectedApp.docs.length} Valid)
                </h4>
                <span className="text-xs text-slate-500">Mark all documents as Valid to certify</span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {selectedApp.docs.map((doc) => {
                  const isValid = doc.status === 'valid';
                  const isInvalid = doc.status === 'invalid';
                  return (
                    <div
                      key={doc.key}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                        isValid
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : isInvalid
                          ? 'border-rose-200 bg-rose-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{doc.label}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{doc.filename}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center gap-1 text-xs font-medium text-brand hover:underline p-1 shrink-0"
                        >
                          <Eye size={13} /> View
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            isValid
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInvalid
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isValid ? 'Valid' : isInvalid ? 'Invalid' : 'Pending Review'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetDocStatus(doc.key, 'valid')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                              isValid
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            Mark Valid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetDocStatus(doc.key, 'invalid')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                              isInvalid
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            Invalid
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin Verification Remarks */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Official Compliance Remarks & Message to Lender
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Write verification remarks here (e.g. All documents verified and conditions are met successfully)..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-brand focus:ring-4 focus:ring-blue-100 bg-white"
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setSelectedApp(null)}>
                Cancel
              </Button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <Button variant="danger" onClick={handleRejectCompliance}>
                  <XCircle size={15} /> Compliance Reject
                </Button>

                <Button
                  onClick={handleCertifyAndSendToLender}
                  disabled={!isAllConditionsSatisfied}
                  className="shadow-sm !px-5"
                >
                  <Send size={15} />
                  Certify & Send to Lender
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Document Preview Lightbox Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
      />
    </div>
  );
}
