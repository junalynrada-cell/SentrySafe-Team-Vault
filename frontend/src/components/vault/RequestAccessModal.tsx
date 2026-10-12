'use client';

import React, { useState, useEffect } from 'react';
import { SecretItem, api } from '../../lib/api';
import {
  X,
  Clock,
  KeyRound,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface RequestAccessModalProps {
  secret: SecretItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted: () => void;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  secret,
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const [durationMinutes] = useState(30);
  const [reason, setReason] = useState(
    'Urgent production database migration troubleshooting for PR #412',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !secret) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A business justification is strictly required by Zero-Trust policy.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await api.requests.create({
        secret_id: secret.id,
        requested_duration_minutes: durationMinutes,
        business_reason: reason.trim(),
      });

      onRequestSubmitted();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit access request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-access-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50 dark:bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 id="request-access-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Request Temporary Access
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Just-in-Time (JIT) Credential Request
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            {/* Target Secret Banner */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {secret.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {secret.owner_team} • {secret.resource_type}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shrink-0">
                {secret.environment}
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Duration Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Requested Grant Duration
              </label>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-zinc-200 font-medium">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>30 Minutes (Standard Security Window)</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                  Auto-Expires
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                Access expires immediately when the 30-minute timer hits zero.
              </p>
            </div>

            {/* Justification input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Business Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                placeholder="Detail the operational task, PR link, or incident ticket..."
                className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none min-h-[80px]"
              />
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                Recorded immutably in compliance audit trail.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-xl text-xs font-medium transition-colors flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              {isSubmitting ? (
                <span>Submitting Request...</span>
              ) : (
                <>
                  <span>Submit Access Request</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
