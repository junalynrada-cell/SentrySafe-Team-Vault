'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { TotpEnrollmentFlow } from './TotpEnrollmentFlow';

interface LoginViewProps {
  onShowSignup: () => void;
}

type AuthStage = 'CREDENTIALS' | 'TWO_FACTOR' | 'ENROLLMENT';

export const LoginView: React.FC<LoginViewProps> = ({ onShowSignup }) => {
  const { login, verify2fa, refreshAuth } = useAuth();
  const [authStage, setAuthStage] = useState<AuthStage>('CREDENTIALS');

  // Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isUsingBackupCode, setIsUsingBackupCode] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (res.requiresEnrollment) {
        setAuthStage('ENROLLMENT');
      } else if (res.requiresTwoFactor) {
        setAuthStage('TWO_FACTOR');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isUsingBackupCode) {
      const cleanBackup = backupCode.trim();
      if (!cleanBackup) {
        setError('Please enter your recovery backup code.');
        return;
      }
      setIsLoading(true);
      try {
        await verify2fa(undefined, cleanBackup);
      } catch (err: unknown) {
        setError(
          (err as Error).message || 'Invalid or already used backup code.',
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      const cleanTotp = totpCode.trim();
      if (!cleanTotp || cleanTotp.length !== 6 || !/^\d{6}$/.test(cleanTotp)) {
        setError('Please enter the 6-digit verification code from Google Authenticator.');
        return;
      }
      setIsLoading(true);
      try {
        await verify2fa(cleanTotp);
      } catch (err: unknown) {
        setError((err as Error).message || 'Invalid 6-digit verification code.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBackToLogin = () => {
    setAuthStage('CREDENTIALS');
    setTotpCode('');
    setBackupCode('');
    setIsUsingBackupCode(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-3 sm:p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-md z-10 my-auto">
        {/* Logo / Brand */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 mb-2 shadow-lg shadow-indigo-950/40">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SentrySafe</h1>
          <p className="text-xs text-zinc-500">Zero-Trust Team Vault</p>
        </div>

        {/* Phase 1: Email + Password Credentials */}
        {authStage === 'CREDENTIALS' && (
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40">
            <h2 className="text-sm font-semibold text-zinc-100">Sign in to your account</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Authenticate with your organization credentials
            </p>

            {error && (
              <div className="mb-3.5 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Business Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    id="login-email"
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
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
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

              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40 mt-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3.5 border-t border-zinc-800/60">
              <p className="text-[11px] text-zinc-500 text-center mb-2">
                Don't have an account?
              </p>
              <button
                id="show-signup"
                onClick={onShowSignup}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs sm:text-sm rounded-xl transition-colors"
              >
                Request to Join Organization
              </button>
            </div>
          </div>
        )}

        {/* Phase 2: Google Authenticator TOTP / Backup Code Verification */}
        {authStage === 'TWO_FACTOR' && (
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40">
            <button
              onClick={handleBackToLogin}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <h2 className="text-sm font-semibold text-zinc-100">
              {isUsingBackupCode
                ? 'Backup Code Authentication'
                : 'Two-Factor Authentication'}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {isUsingBackupCode
                ? 'Enter one of your 8-character recovery backup codes.'
                : 'Open Google Authenticator and enter your 6-digit verification code.'}
            </p>

            {error && (
              <div className="mb-3.5 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              {!isUsingBackupCode ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="login-totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                    className="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Recovery Backup Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="login-backup-code"
                      type="text"
                      autoFocus
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX"
                      className="w-full pl-9 pr-4 py-2.5 font-mono text-sm tracking-widest bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 uppercase transition-all"
                    />
                  </div>
                </div>
              )}

              <button
                id="login-totp-verify-btn"
                type="submit"
                disabled={
                  isLoading ||
                  (!isUsingBackupCode && totpCode.trim().length !== 6) ||
                  (isUsingBackupCode && !backupCode.trim())
                }
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-zinc-800/60 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsUsingBackupCode(!isUsingBackupCode);
                    setError(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {isUsingBackupCode
                    ? 'Use Google Authenticator 6-digit code'
                    : 'Lost access to authenticator? Use backup code'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Phase 3: Mandatory TOTP Enrollment (for existing users enrolling for first time) */}
        {authStage === 'ENROLLMENT' && (
          <TotpEnrollmentFlow
            email={email}
            onComplete={() => {
              // Enrollment complete, user is authenticated
            }}
            onCancel={handleBackToLogin}
          />
        )}
      </div>
    </div>
  );
};
