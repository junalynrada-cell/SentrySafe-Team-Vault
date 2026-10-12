'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  QrCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  ArrowRight,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface TotpEnrollmentFlowProps {
  onComplete: () => void;
  onCancel?: () => void;
  email?: string;
}

type Step = 'scan' | 'verify' | 'backup';

export const TotpEnrollmentFlow: React.FC<TotpEnrollmentFlowProps> = ({
  onComplete,
  onCancel,
  email,
}) => {
  const { enroll2fa, verifyEnrollment, completeEnrollment } = useAuth();

  const [step, setStep] = useState<Step>('scan');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [manualKey, setManualKey] = useState<string>('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [hasAcknowledgedBackup, setHasAcknowledgedBackup] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize enrollment on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await enroll2fa();
        if (active) {
          setQrCodeUrl(res.qrCodeUrl);
          setManualKey(res.manualKey);
        }
      } catch (err: unknown) {
        if (active) {
          setError((err as Error).message || 'Failed to initialize TOTP enrollment.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [enroll2fa]);

  const handleCopyKey = () => {
    if (!manualKey) return;
    navigator.clipboard.writeText(manualKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = verifyCode.trim();
    if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setError('Please enter the exact 6-digit code from Google Authenticator.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyEnrollment(clean);
      setBackupCodes(res.backupCodes);
      setStep('backup');
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          'Invalid verification code. Please check Google Authenticator and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    const content = [
      '============================================================',
      'SENTRYSAFE TEAM VAULT - TWO-FACTOR BACKUP CODES',
      '============================================================',
      `Account: ${email || 'Authenticated User'}`,
      `Generated: ${new Date().toUTCString()}`,
      '',
      'Keep these backup codes in a safe, offline place.',
      'Each code can only be used ONCE if you lose access',
      'to your Google Authenticator app.',
      '------------------------------------------------------------',
      ...backupCodes.map((code, idx) => `${idx + 1}. ${code}`),
      '============================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sentrysafe-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCompleteFlow = async () => {
    if (!hasAcknowledgedBackup) {
      setError('Please acknowledge that you have saved your backup codes.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await completeEnrollment();
      onComplete();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to complete 2FA setup.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format manual key into 4-character chunks for legibility (e.g. ABCD EFGH ...)
  const formattedKey = manualKey
    ? manualKey.match(/.{1,4}/g)?.join(' ') || manualKey
    : '';

  return (
    <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40 w-full max-w-md">
      {/* Progress Indicators */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 'scan'
                ? 'bg-indigo-600 text-white'
                : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {step !== 'scan' ? <Check className="w-3.5 h-3.5" /> : '1'}
          </div>
          <span className={step === 'scan' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>
            Scan QR
          </span>
        </div>

        <div className="w-8 h-px bg-zinc-800" />

        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 'verify'
                ? 'bg-indigo-600 text-white'
                : step === 'backup'
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {step === 'backup' ? <Check className="w-3.5 h-3.5" /> : '2'}
          </div>
          <span className={step === 'verify' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>
            Verify
          </span>
        </div>

        <div className="w-8 h-px bg-zinc-800" />

        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 'backup' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            3
          </div>
          <span className={step === 'backup' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>
            Backup
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Scan QR Code */}
      {step === 'scan' && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-zinc-100">
              Set Up Two-Factor Authentication
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Scan this QR code using the Google Authenticator app on your mobile device.
            </p>
          </div>

          <div className="flex justify-center p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            {isLoading || !qrCodeUrl ? (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Generating secure key...</span>
              </div>
            ) : (
              <img
                id="totp-qr-code"
                src={qrCodeUrl}
                alt="Google Authenticator QR Code"
                className="w-48 h-48 rounded-lg bg-white p-2 border border-zinc-700 shadow-md"
              />
            )}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors inline-flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{showManualKey ? 'Hide manual setup key' : "Can't scan QR code?"}</span>
            </button>
          </div>

          {showManualKey && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-[11px] font-medium text-zinc-400">
                Manual Setup Key:
              </label>
              <div className="flex items-center justify-between gap-2 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                <span className="font-mono text-xs text-indigo-300 tracking-wider select-all break-all">
                  {formattedKey}
                </span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  title="Copy manual key"
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                >
                  {copiedKey ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                Type: Time-based (TOTP), 6 digits, 30 seconds interval.
              </p>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-1/3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs sm:text-sm rounded-xl transition-colors"
              >
                Back
              </button>
            )}
            <button
              id="totp-added-btn"
              type="button"
              onClick={() => setStep('verify')}
              disabled={isLoading || !qrCodeUrl}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
            >
              <span>I've Added It</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Verify Authenticator Code */}
      {step === 'verify' && (
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-zinc-100">Verify Authenticator</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Enter the 6-digit verification code shown in Google Authenticator.
            </p>
          </div>

          <div>
            <input
              id="totp-verify-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('scan')}
              className="w-1/3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs sm:text-sm rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              id="totp-verify-btn"
              type="submit"
              disabled={isLoading || verifyCode.trim().length !== 6}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Save Backup Codes */}
      {step === 'backup' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Save Your Backup Codes</h2>
            <p className="text-xs text-zinc-400 mt-1">
              These codes can be used to access your vault if you lose access to Google Authenticator. Each code can be used only once.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 p-1.5 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-zinc-300 select-all"
                >
                  <span className="text-zinc-600 text-[10px] w-4">{index + 1}.</span>
                  <span className="text-indigo-300 font-semibold tracking-wider">{code}</span>
                </div>
              ))}
            </div>

            <button
              id="download-backup-codes-btn"
              type="button"
              onClick={handleDownloadBackupCodes}
              className="mt-3 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs rounded-lg flex items-center justify-center gap-2 border border-zinc-700/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Backup Codes (.txt)</span>
            </button>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="acknowledge-backup-codes"
                type="checkbox"
                checked={hasAcknowledgedBackup}
                onChange={(e) => setHasAcknowledgedBackup(e.target.checked)}
                className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-zinc-300 leading-snug">
                I have saved my backup codes in a secure location and understand they will not be displayed again.
              </span>
            </label>
          </div>

          <button
            id="totp-complete-btn"
            type="button"
            onClick={handleCompleteFlow}
            disabled={!hasAcknowledgedBackup || isLoading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Finalizing Setup...</span>
              </>
            ) : (
              <span>Continue to Vault</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
