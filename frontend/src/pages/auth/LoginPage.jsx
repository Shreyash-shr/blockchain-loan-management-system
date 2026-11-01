import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/common/CommonUI';
import Button from '../../components/common/Button';
import { Input, Field } from '../../components/common/FormElements';
import { useAuth, normalizeRole } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState('Applicant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await login(email, password, role);
      if (result.success) {
        const userRole = normalizeRole(result.user.role || role);
        success(`Signed in as ${result.user.full_name || email} (${userRole})`);
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
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Welcome Back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Sign in to CredChain</h2>
            <p className="mt-2 text-sm text-slate-500">Choose your workspace and authenticate securely.</p>
          </div>

          {/* Role Selector Tabs */}
          <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
            {['Applicant', 'Loan Lender', 'Admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  role === r
                    ? 'bg-white text-brand shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'Loan Lender' ? 'Lender' : r}
              </button>
            ))}
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

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer text-xs sm:text-sm">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span>Remember me</span>
              </label>

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
              {isSubmitting ? 'Signing in...' : 'Sign in to Workspace'}
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an applicant account?{' '}
            <Link to="/register" className="font-semibold text-brand hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-brand block mb-0.5">Role-Based Access:</span>
            Lenders and Administrators must use authorized organization credentials. Public registration is open to Applicants only.
          </div>
        </div>
      </div>
    </div>
  );
}
