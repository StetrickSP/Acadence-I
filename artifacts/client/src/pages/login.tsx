import { useState } from 'react';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useCustomAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const { currentUser, login } = useCustomAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in → go to dashboard
  if (currentUser) {
    navigate('/dashboard');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    // Small artificial delay for UX
    setTimeout(() => {
      const result = login(email, password);
      if (result.ok) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed.');
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'rgb(248, 250, 252)', fontFamily: '"DM Sans", sans-serif' }}
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mb-4 shadow-md">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="heading-font text-3xl font-bold text-slate-900 leading-none mb-1">
              Acadence
            </h1>
            <p className="text-sm text-slate-500 mt-1">Faculty &amp; Student Portal</p>
            <span
              className="text-xs px-3 py-1 rounded-full mt-3 font-medium"
              style={{ background: 'rgb(204, 251, 241)', color: 'rgb(15, 118, 110)' }}
            >
              Semester 2 · 2025–2026
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                data-testid="input-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              data-testid="button-signin"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: loading ? '#5eead4' : '#0f766e' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Demo Credentials
            </p>
            <div className="space-y-1 text-xs text-slate-500">
              <p>
                <span className="font-semibold text-slate-600">Instructor:</span>{' '}
                teacher@gmail.com &nbsp;/&nbsp; 1111
              </p>
              <p>
                <span className="font-semibold text-slate-600">Student:</span>{' '}
                [email enrolled by instructor] &nbsp;/&nbsp; [Student ID]
              </p>
              <p className="text-slate-400 mt-1">
                e.g. nva@university.edu &nbsp;/&nbsp; STU001
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
