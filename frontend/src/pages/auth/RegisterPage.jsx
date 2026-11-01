import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { Logo } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import { Input, Field } from '../../components/common/FormElements';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      error('Password must be at least 8 characters long');
      return;
    }

    if (!termsAccepted) {
      error('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register({
        fullName,
        email,
        phone,
        password,
      });

      if (result.success) {
        success('Applicant account registered successfully!');
        navigate('/applicant');
      }
    } catch (err) {
      error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_.95fr]">
      {/* Hero Side */}
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-28 -top-20 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Logo light />
          <div className="mt-20 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-200">
              <ShieldCheck size={15} /> Transparent Borrowing
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
              Get funded with <span className="text-blue-400">clarity and confidence.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Create your applicant profile, upload identity and income proofs safely, and track approval decisions in real time.
            </p>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 pt-6 text-xs text-slate-400">
          CredChain ensures personal information is encrypted at rest and never exposed to public networks.
        </div>
      </div>

      {/* Form Side */}
      <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Applicant Registration</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Create an Account</h2>
            <p className="mt-2 text-sm text-slate-500">
              Register as an applicant to apply for loans and track instalments.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full Name (as per official ID)" required>
              <Input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
              />
            </Field>

            <Field label="Email Address" required>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aarav@example.com"
              />
            </Field>

            <Field label="Phone Number" required>
              <Input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Password" required>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars"
                />
              </Field>

              <Field label="Confirm Password" required>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </Field>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 pt-2 cursor-pointer leading-5">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>
                I agree to the <span className="text-brand font-semibold">Terms of Service</span> and consent to identity and credit eligibility checks under applicable privacy regulations.
              </span>
            </label>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full !py-3.5 text-base mt-3"
            >
              {isSubmitting ? 'Registering...' : 'Complete Registration'}
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 flex items-center gap-2">
            <Lock size={14} className="text-slate-400 shrink-0" />
            <span>Are you a Lender or Administrator? Reach out to your CredChain organization admin for provisioning.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
