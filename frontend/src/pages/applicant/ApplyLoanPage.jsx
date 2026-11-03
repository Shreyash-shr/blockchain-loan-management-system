import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Banknote, Fingerprint, ArrowRight, ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';
import { Input, Select, Field } from '../../components/common/FormElements';
import DocumentUploader from '../../components/loans/DocumentUploader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

export default function ApplyLoanPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    dob: '',
    age: '',
    gender: '',
    email: user?.email || '',
    phone: '',
    monthlyIncome: '',
    declaredCreditScore: '',
    existingLoans: 'None',
    existingEmi: '',
    amount: '',
    purpose: 'Personal expenses',
    tenure: '24',
  });

  const [uploads, setUploads] = useState({});
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'dob' && value) {
        const d = new Date(value);
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
          age--;
        }
        updated.age = age >= 0 ? String(age) : '';
      }
      return updated;
    });
  };

  const handleFileSelect = (key, file) => {
    if (file.size > 10 * 1024 * 1024) {
      error(`File ${file.name} exceeds the 10 MB limit.`);
      return;
    }
    setUploads((prev) => ({ ...prev, [key]: file }));
  };

  React.useEffect(() => {
    async function loadExistingProfile() {
      try {
        const res = await api.get('/applicants/me');
        if (res && res.profile) {
          const p = res.profile;
          setForm((prev) => ({
            ...prev,
            fullName: p.full_name || prev.fullName,
            email: p.email || prev.email,
            phone: p.phone || prev.phone,
            dob: p.date_of_birth ? p.date_of_birth.split('T')[0] : prev.dob,
            gender: p.gender || prev.gender,
            monthlyIncome: p.monthly_income ? String(p.monthly_income) : prev.monthlyIncome,
            declaredCreditScore: p.declared_credit_score ? String(p.declared_credit_score) : prev.declaredCreditScore,
            existingLoans: p.existing_loan_details || prev.existingLoans,
            existingEmi: p.existing_monthly_emi ? String(p.existing_monthly_emi) : prev.existingEmi,
          }));
          if (p.date_of_birth) {
            updateField('dob', p.date_of_birth.split('T')[0]);
          }
        }
      } catch (err) {
        console.warn('Could not load profile:', err.message);
      }
    }
    loadExistingProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!consent) {
      error('Please confirm accurate information and consent to verification.');
      return;
    }

    if (Number(form.amount) <= 0) {
      error('Please enter a valid requested loan amount.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update applicant profile details
      await api.patch('/applicants/me', {
        full_name: form.fullName || undefined,
        phone: form.phone || undefined,
        date_of_birth: form.dob || undefined,
        gender: form.gender || undefined,
        monthly_income: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        declared_credit_score: form.declaredCreditScore ? Number(form.declaredCreditScore) : undefined,
        existing_loan_details: form.existingLoans || undefined,
        existing_monthly_emi: form.existingEmi ? Number(form.existingEmi) : undefined,
      });

      // 2. Submit loan application
      const appRes = await api.post('/applications', {
        requested_amount: Number(form.amount),
        purpose: form.purpose,
        tenure_months: Number(form.tenure),
      });

      const application = appRes.application;

      // 3. Upload attached documents linked to this application
      const uploadEntries = Object.entries(uploads);
      for (const [docKey, file] of uploadEntries) {
        const fileData = new FormData();
        fileData.append('file', file);
        fileData.append('document_type', docKey);
        fileData.append('application_id', application.id);
        await api.post('/documents', fileData);
      }

      const appRef = application?.application_number
        ? `LN-2026-${String(application.application_number).padStart(4, '0')}`
        : 'Application';

      success(`Loan application ${appRef} submitted successfully with ${uploadEntries.length} documents!`);
      navigate('/applicant/applications');
    } catch (err) {
      error(err.message || 'Failed to submit loan application. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const docs = [
    { key: 'pan', label: 'PAN Card', required: true },
    { key: 'aadhaar', label: 'Aadhaar Card', required: true },
    { key: 'address', label: 'Address Proof (Utility Bill / Govt ID)', required: true },
    { key: 'bank', label: 'Bank Statement (Last 6 Months)', required: true },
    { key: 'salary', label: 'Salary Slips (Last 3–6 Months)', required: true },
    { key: 'photo', label: 'Passport Photograph', required: true },
    { key: 'signature', label: 'Official Signature Sample', required: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">New Loan Application</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete the personal, financial, and loan term fields. Attach supporting verification proofs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Personal Details */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-5">
            <Users size={18} className="text-brand" />
            <span>1. Personal Information</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full Name" required hint="As printed on government ID">
              <Input
                required
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="Aarav Sharma"
              />
            </Field>

            <Field label="Date of Birth" required>
              <Input
                required
                type="date"
                value={form.dob}
                onChange={(e) => updateField('dob', e.target.value)}
              />
            </Field>

            <Field label="Calculated Age">
              <Input
                type="number"
                value={form.age}
                readOnly
                placeholder="Auto-calculated from DOB"
                className="bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </Field>

            <Field label="Gender" required>
              <Select
                required
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </Select>
            </Field>

            <Field label="Email Address" required>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Phone Number" required>
              <Input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Financial Profile */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-5">
            <Banknote size={18} className="text-emerald-600" />
            <span>2. Financial Information (Declared)</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Monthly Net Income (₹)" required hint="Verified against bank statements">
              <Input
                required
                type="number"
                min="0"
                value={form.monthlyIncome}
                onChange={(e) => updateField('monthlyIncome', e.target.value)}
                placeholder="e.g. 75000"
              />
            </Field>

            <Field label="Credit / CIBIL Score" hint="Self-declared (300–900)">
              <Input
                type="number"
                min="300"
                max="900"
                value={form.declaredCreditScore}
                onChange={(e) => updateField('declaredCreditScore', e.target.value)}
                placeholder="e.g. 760"
              />
            </Field>

            <Field label="Existing Active Loans">
              <Select
                value={form.existingLoans}
                onChange={(e) => updateField('existingLoans', e.target.value)}
              >
                <option value="None">None</option>
                <option value="Personal Loan">Personal Loan</option>
                <option value="Home Loan">Home Loan</option>
                <option value="Auto / Vehicle Loan">Auto / Vehicle Loan</option>
                <option value="Multiple Active Loans">Multiple Active Loans</option>
              </Select>
            </Field>

            <Field label="Current Monthly EMI (₹)" hint="Total existing debt outflow">
              <Input
                type="number"
                min="0"
                value={form.existingEmi}
                onChange={(e) => updateField('existingEmi', e.target.value)}
                placeholder="e.g. 15000"
              />
            </Field>
          </div>
        </div>

        {/* Section 3: Loan Request Terms */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-5">
            <ShieldCheck size={18} className="text-blue-600" />
            <span>3. Requested Loan Terms</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Requested Amount (₹)" required>
              <Input
                required
                type="number"
                min="10000"
                step="5000"
                value={form.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                placeholder="e.g. 350000"
              />
            </Field>

            <Field label="Loan Purpose" required>
              <Select
                value={form.purpose}
                onChange={(e) => updateField('purpose', e.target.value)}
              >
                <option value="Home renovation">Home renovation</option>
                <option value="Education">Education</option>
                <option value="Medical expenses">Medical expenses</option>
                <option value="Business expansion">Business expansion</option>
                <option value="Vehicle purchase">Vehicle purchase</option>
                <option value="Personal expenses">Personal expenses</option>
              </Select>
            </Field>

            <Field label="Preferred Tenure" required>
              <Select
                value={form.tenure}
                onChange={(e) => updateField('tenure', e.target.value)}
              >
                <option value="6">6 Months</option>
                <option value="12">12 Months (1 Year)</option>
                <option value="24">24 Months (2 Years)</option>
                <option value="36">36 Months (3 Years)</option>
                <option value="60">60 Months (5 Years)</option>
              </Select>
            </Field>
          </div>
        </div>

        {/* Section 4: Document Uploads */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            <Fingerprint size={18} className="text-indigo-600" />
            <span>4. Supporting Verification Documents</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Accepted formats: PDF, JPG, PNG (Max 10 MB per file). All files are encrypted at rest in protected storage.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <DocumentUploader
                key={doc.key}
                docKey={doc.key}
                label={doc.label}
                required={doc.required}
                file={uploads[doc.key]}
                onFileSelect={handleFileSelect}
              />
            ))}
          </div>
        </div>

        {/* Consent & Submission */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-soft space-y-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 rounded border-slate-300 text-brand focus:ring-brand shrink-0"
            />
            <span className="text-xs leading-5 text-slate-600">
              I certify that all details submitted above are true and complete. I authorize CredChain and affiliated licensed lenders to verify my identity, credit bureau history, and bank transactions for the purpose of underwriting this loan application.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/applicant')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="!px-6">
              {isSubmitting ? 'Submitting Application...' : 'Submit Loan Application'}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
