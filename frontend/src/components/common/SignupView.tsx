'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Mail, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { TotpEnrollmentFlow } from './TotpEnrollmentFlow';

interface SignupViewProps {
  onShowLogin: () => void;
}

export const SignupView: React.FC<SignupViewProps> = ({ onShowLogin }) => {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid business email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      setIsEnrolling(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEnrolling) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-3 sm:p-4">
        <div
          className="fixed inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="w-full max-w-md z-10 my-auto">
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 mb-1.5 shadow-lg shadow-indigo-950/40">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">SentrySafe</h1>
            <p className="text-xs text-zinc-500">Zero-Trust Team Vault</p>
          </div>
          <TotpEnrollmentFlow
            email={email}
            onComplete={() => {
              setIsEnrolling(false);
              setSuccess(true);
            }}
            onCancel={() => setIsEnrolling(false)}
          />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="w-full max-w-md z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 mb-6 shadow-xl shadow-emerald-950/40">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Request Submitted</h2>
          <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
            Your account has been created and is <span className="text-amber-400 font-semibold">pending administrator review</span>. You'll be able to sign in once an Admin approves your membership and assigns your role.
          </p>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 mb-6 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-indigo-400">1</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">Account Created</p>
                <p className="text-xs text-zinc-500 mt-0.5">Your credentials are securely stored.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-amber-400">2</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">Awaiting Admin Approval</p>
                <p className="text-xs text-zinc-500 mt-0.5">An administrator must review and assign your role.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-zinc-400">3</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400">Access Granted</p>
                <p className="text-xs text-zinc-600 mt-0.5">You'll have access based on your assigned role.</p>
              </div>
            </div>
          </div>
          <button
            id="signup-success-login"
            onClick={onShowLogin}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-md z-10 my-auto">
        {/* Logo / Brand */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 mb-1.5 shadow-lg shadow-indigo-950/40">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SentrySafe</h1>
          <p className="text-xs text-zinc-500">Zero-Trust Team Vault</p>
        </div>

        {/* Signup Card */}
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40">
          <button
            onClick={onShowLogin}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>

          <h2 className="text-sm font-semibold text-zinc-100">Request to Join</h2>
          <p className="text-xs text-zinc-500 mb-3.5">
            Create your account. An administrator will review and assign your role before you can access the vault.
          </p>

          {error && (
            <div className="mb-3 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Business Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40 mt-3"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account & Request Access</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
