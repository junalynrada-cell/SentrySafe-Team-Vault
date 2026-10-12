'use client';

import React, { useState, useEffect } from 'react';
import { api, SecretItem } from '../../lib/api';
import { X, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';

interface DeleteSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: SecretItem | null;
  onSecretDeleted: () => void;
}

export const DeleteSecretModal: React.FC<DeleteSecretModalProps> = ({
  isOpen,
  onClose,
  secret,
  onSecretDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever secret changes
  useEffect(() => {
    if (secret) {
      setError(null);
      setIsDeleting(false);
    }
  }, [secret]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDeleting]);

  if (!isOpen || !secret) return null;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      await api.secrets.delete(secret.id);
      onSecretDeleted();
      onClose();
    } catch (err: unknown) {
      // Keep the modal open and show the error — do not crash
      setError((err as Error).message || 'Failed to delete secret. Please try again.');
      setIsDeleting(false);
    }
  };

  const envLabel = secret.environment;
  const envColor =
    envLabel === 'PRODUCTION'
      ? 'text-rose-600 dark:text-rose-400'
      : envLabel === 'STAGING'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-600 dark:text-zinc-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-secret-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="delete-secret-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white tracking-tight"
              >
                Delete Secret?
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              <p>
                You are about to permanently delete{' '}
                <strong className="font-semibold">&ldquo;{secret.name}&rdquo;</strong>.
              </p>
              <p>
                Environment:{' '}
                <span className={`font-mono font-semibold ${envColor}`}>{envLabel}</span>
              </p>
              <p className="text-rose-600/80 dark:text-rose-400/80">
                All active access grants and pending requests for this secret will be revoked immediately.
              </p>
            </div>
          </div>

          {/* Error state — shown if deletion fails */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Secret info summary (no plaintext) */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500">Type</span>
              <span className="text-slate-700 dark:text-zinc-300 font-mono">{secret.resource_type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500">Team</span>
              <span className="text-slate-700 dark:text-zinc-300">{secret.owner_team}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500">Access Level</span>
              <span className="text-slate-700 dark:text-zinc-300 font-mono">{secret.access_level}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 pb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-xl text-xs font-medium transition-colors flex items-center justify-center disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="min-h-[44px] px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Secret'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
