'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, KeyRound, ShieldAlert, ArrowRight } from 'lucide-react';

export const SessionLockModal: React.FC = () => {
  const { isLocked, user, unlockSession, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLocked) {
      setPassword('');
      setError(null);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const ok = await unlockSession(password);
      if (!ok) {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('An error occurred during unlock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-950/40">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Vault Session Locked
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Zero-Trust automatic inactivity lock engaged. Reauthenticate as{' '}
            <span className="text-zinc-200 font-medium">{user?.email}</span> to continue.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-center gap-2 text-left">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="text-left">
            <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="Enter password..."
              />
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              Default demo password: Password123!
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-950/50 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span>Unlocking Vault...</span>
            ) : (
              <>
                <span>Unlock Vault</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80">
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
          >
            Sign out and terminate session
          </button>
        </div>
      </div>
    </div>
  );
};
