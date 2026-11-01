import React, { useState, useEffect } from 'react';
import { Sliders, ShieldCheck, Check, RotateCcw, AlertTriangle, Save, History } from 'lucide-react';
import Button from '../../components/common/Button';
import { Input, Field } from '../../components/common/FormElements';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const defaultPolicy = {
  minCibilScore: 750,
  minAge: 21,
  maxAge: 60,
  minMonthlyIncome: 25000,
  maxExistingLoans: 2,
  maxDtiRatio: 50,
  higherAuthorityRef: 'HA-POLICY-2026-V1',
};

export default function EligibilitySettingsPage() {
  const { success, error, info } = useToast();
  const [policy, setPolicy] = useState(defaultPolicy);
  const [loading, setLoading] = useState(true);

  const [history, setHistory] = useState([
    {
      date: '16 Oct 2026, 08:30 AM',
      by: 'System Administrator',
      change: 'Initial policy baseline: CIBIL >= 750, Age 21–60, Min Income ₹25,000',
    },
  ]);

  const [authorityNote, setAuthorityNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPolicy() {
      try {
        setLoading(true);
        const res = await api.get('/admin/policy-rules');
        const rules = res.data?.policy_rules || res.policy_rules;
        if (rules) {
          setPolicy({
            minCibilScore: rules.min_cibil_score || 750,
            minAge: rules.min_age || 21,
            maxAge: rules.max_age || 60,
            minMonthlyIncome: rules.min_monthly_income || 25000,
            maxExistingLoans: rules.max_existing_loans || 2,
            maxDtiRatio: rules.max_dti_ratio || 50,
            higherAuthorityRef: rules.authority_memo_ref || 'HA-POLICY-2026-V1',
          });
        }
      } catch (err) {
        console.warn('Could not fetch policy rules:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, []);

  const updateField = (key, val) => {
    setPolicy((prev) => ({ ...prev, [key]: Number(val) || val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await api.put('/admin/policy-rules', {
        min_cibil_score: Number(policy.minCibilScore),
        min_age: Number(policy.minAge),
        max_age: Number(policy.maxAge),
        min_monthly_income: Number(policy.minMonthlyIncome),
        max_existing_loans: Number(policy.maxExistingLoans),
        max_dti_ratio: Number(policy.maxDtiRatio),
        authority_memo_ref: authorityNote || policy.higherAuthorityRef || 'ADMIN_UPDATE',
      });
      success('Loan eligibility conditions updated and active across all underwriting queues.');
    } catch (err) {
      console.warn('Failed to save to server:', err.message);
      error(err.message || 'Failed to update policy rules.');
    }

    localStorage.setItem('credchain_policy_rules', JSON.stringify(policy));
    setHistory((prev) => [
      {
        date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        by: 'Admin',
        change: `Updated thresholds: Min CIBIL ${policy.minCibilScore}, Age ${policy.minAge}-${policy.maxAge}, Min Income ₹${Number(policy.minMonthlyIncome).toLocaleString('en-IN')}${
          authorityNote ? ` (Ref: ${authorityNote})` : ''
        }`,
      },
      ...prev,
    ]);

    setIsSaving(false);
  };

  const handleResetDefaults = () => {
    setPolicy(defaultPolicy);
    localStorage.setItem('credchain_policy_rules', JSON.stringify(defaultPolicy));
    info('Eligibility criteria reset to standard corporate defaults.');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Loan Policy & Eligibility Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure automated underwriting thresholds (CIBIL score, age limits, and minimum income requirements).
          </p>
        </div>
        <Button variant="secondary" onClick={handleResetDefaults} className="!text-xs">
          <RotateCcw size={14} /> Reset Defaults
        </Button>
      </div>

      {/* Security Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <strong className="block text-sm font-bold text-blue-950 mb-0.5">
            Higher Authority Policy Management
          </strong>
          Threshold changes directly control automated validation for new applications and guide the Admin Verification checklist. Adjust parameters per executive authorization.
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft space-y-6">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            <Sliders size={18} className="text-brand" />
            <span>Underwriting Criteria Controls</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* CIBIL Score Threshold */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <Field
                label="Minimum CIBIL / Credit Score"
                hint="Default is 750; can be lowered to 700 or adjusted per directive"
                required
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="300"
                    max="900"
                    step="5"
                    value={policy.minCibilScore}
                    onChange={(e) => updateField('minCibilScore', e.target.value)}
                    className="font-bold text-base text-brand"
                  />
                  <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                    {policy.minCibilScore >= 750 ? 'Strict Tier' : 'Relaxed Tier'}
                  </span>
                </div>
              </Field>
              <p className="text-[11px] text-slate-500">
                Applicants with a verified score below {policy.minCibilScore} will be flagged during compliance review.
              </p>
            </div>

            {/* Minimum Net Monthly Income */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <Field
                label="Minimum Monthly Income (₹)"
                hint="Baseline salary/business income threshold"
                required
              >
                <Input
                  type="number"
                  min="5000"
                  step="1000"
                  value={policy.minMonthlyIncome}
                  onChange={(e) => updateField('minMonthlyIncome', e.target.value)}
                  className="font-bold text-base text-slate-800"
                />
              </Field>
              <p className="text-[11px] text-slate-500">
                Current requirement: ₹{Number(policy.minMonthlyIncome).toLocaleString('en-IN')} net earnings per month.
              </p>
            </div>

            {/* Age Limits: Min & Max */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="block text-sm font-medium text-slate-700">Eligible Age Bracket</span>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min Age (Years)" required>
                  <Input
                    type="number"
                    min="18"
                    max="65"
                    value={policy.minAge}
                    onChange={(e) => updateField('minAge', e.target.value)}
                  />
                </Field>
                <Field label="Max Age (Years)" required>
                  <Input
                    type="number"
                    min="25"
                    max="80"
                    value={policy.maxAge}
                    onChange={(e) => updateField('maxAge', e.target.value)}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500">
                Current window: {policy.minAge} to {policy.maxAge} years old.
              </p>
            </div>

            {/* Existing Debt & Max Loans */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="block text-sm font-medium text-slate-700">Debt & Exposure Limits</span>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Active Loans">
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={policy.maxExistingLoans}
                    onChange={(e) => updateField('maxExistingLoans', e.target.value)}
                  />
                </Field>
                <Field label="Max DTI Ratio (%)">
                  <Input
                    type="number"
                    min="20"
                    max="80"
                    value={policy.maxDtiRatio}
                    onChange={(e) => updateField('maxDtiRatio', e.target.value)}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500">
                Maximum {policy.maxExistingLoans} existing loans and {policy.maxDtiRatio}% income debt obligation.
              </p>
            </div>
          </div>

          {/* Authorization Reference */}
          <div className="border-t border-slate-100 pt-5">
            <Field
              label="Higher Authority Authorization Note / Memo Ref"
              hint="Document the board/authority approval number for this policy modification"
            >
              <Input
                value={authorityNote}
                onChange={(e) => setAuthorityNote(e.target.value)}
                placeholder="e.g. Board Resolution #2026/04 - Special SME lending relaxation"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" disabled={isSaving} className="!px-6">
              <Save size={16} />
              {isSaving ? 'Applying Changes...' : 'Save & Publish Rules'}
            </Button>
          </div>
        </div>
      </form>

      {/* Policy Change History */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          <History size={17} className="text-slate-400" />
          <span>Audit Log of Policy Modifications</span>
        </div>

        <div className="space-y-2.5">
          {history.map((h, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 gap-1"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 block">{h.change}</span>
                <span className="text-slate-500">Authorized by: {h.by}</span>
              </div>
              <span className="text-slate-400 text-[11px] shrink-0">{h.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
