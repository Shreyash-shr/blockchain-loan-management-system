import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import { Input, Field } from '../../components/common/FormElements';
import { useAuth, normalizeRole } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const WORKSPACES = {
  applicant: {
    label: 'Applicant',
    headline: 'Sign in as an applicant',
    detail: 'This page accepts applicant accounts only.',
  },
  lender: {
    label: 'Lender',
    headline: 'Sign in as a lender',
    detail: 'This page accepts lender accounts only.',
  },
  admin: {
    label: 'Admin',
    headline: 'Sign in as an administrator',
    detail: 'This page accepts administrator accounts only.',
  },
};

export default function LoginPage() {
  const { role: roleParam } = useParams();
  const workspace = WORKSPACES[roleParam];
  const { login, logout } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!workspace) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await login(email, password, roleParam);
      if (result.success) {
        const userRole = normalizeRole(result.user.role);
        if (userRole !== roleParam) {
          await logout();
          error(`This account does not have ${workspace.label.toLowerCase()} access.`);
          return;
        }
        success(`Signed in as ${result.user.full_name || email}`);
        if (userRole === 'admin') navigate('/admin');
        else if (userRole === 'lender') navigate('/lender');
        else navigate('/applicant');
      }
    } catch (err) {
      error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_.95fr]">
      {/* Brand Hero Panel */}
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-28 -top-20 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Logo light />
          <div className="mt-24 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-200">
              <ShieldCheck size={15} /> Transparent lending. Auditable on-chain.
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
              A smarter way to move <span className="text-blue-400">money forward.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Apply for loans, verify documents securely, and follow every decision with a tamper-evident audit record.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-7">
          <div>
            <p className="text-2xl font-bold">24/7</p>
            <p className="mt-1 text-xs text-slate-400">Encrypted portal</p>
          </div>
          <div>
            <p className="text-2xl font-bold">3 Roles</p>
            <p className="mt-1 text-xs text-slate-400">Granular RBAC</p>
          </div>
          <div>
            <p className="text-2xl font-bold">On-chain</p>
            <p className="mt-1 text-xs text-slate-400">Smart audit log</p>
          </div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">{workspace.label} workspace</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">{workspace.headline}</h2>
            <p className="mt-2 text-sm text-slate-500">{workspace.detail}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email Address" required>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            <div className="flex justify-end text-sm pt-1">
              <button
                type="button"
                onClick={() => info('Password reset instructions will be sent once the email service is connected.')}
                className="font-semibold text-brand text-xs sm:text-sm hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full !py-3.5 text-base mt-2"
            >
              {isSubmitting ? 'Signing in...' : `Sign in as ${workspace.label}`}
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Choose a different workspace
            </Link>
          </p>
          {roleParam === 'applicant' && (
            <p className="mt-3 text-center text-sm text-slate-500">
              Need an applicant account?{' '}
              <Link to="/register" className="font-semibold text-brand hover:underline">
                Create an account
              </Link>
            </p>
          )}

          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-brand block mb-0.5">Role-Based Access:</span>
            Lenders and Administrators must use authorized organization credentials. Public registration is open to Applicants only.
          </div>
        </div>
      </div>
    </div>
  );
}
