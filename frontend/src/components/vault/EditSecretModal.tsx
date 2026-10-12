'use client';

import React, { useState, useEffect } from 'react';
import { api, SecretItem } from '../../lib/api';
import {
  X,
  KeyRound,
  Shield,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface EditSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: SecretItem | null;
  onSecretUpdated: () => void;
}

export const EditSecretModal: React.FC<EditSecretModalProps> = ({
  isOpen,
  onClose,
  secret,
  onSecretUpdated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('DATABASE_CREDENTIAL');
  const [environment, setEnvironment] = useState('PRODUCTION');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [accessLevel, setAccessLevel] = useState('RESTRICTED');
  const [requiresApproval, setRequiresApproval] = useState(true);
  /** Replacement secret value — empty means "preserve existing encrypted value" */
  const [newPlaintextValue, setNewPlaintextValue] = useState('');
  const [showNewValue, setShowNewValue] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when secret changes (never pre-fill the secret value)
  useEffect(() => {
    if (secret) {
      setName(secret.name);
      setDescription(secret.description || '');
      setResourceType(secret.resource_type);
      setEnvironment(secret.environment);
      setOwnerTeam(secret.owner_team);
      setAccessLevel(secret.access_level);
      setRequiresApproval(secret.requires_approval);
      setNewPlaintextValue('');
      setShowNewValue(false);
      setError(null);
    }
  }, [secret]);

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
    if (!name.trim()) {
      setError('Secret name is required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Build only the changed fields
      const payload: Parameters<typeof api.secrets.update>[1] = {
        name: name.trim(),
        description: description.trim(),
        resource_type: resourceType as SecretItem['resource_type'],
        environment: environment as SecretItem['environment'],
        owner_team: ownerTeam.trim(),
        access_level: accessLevel,
        requires_approval: requiresApproval,
      };

      // Only include plaintext_value if the admin explicitly typed something
      if (newPlaintextValue.trim()) {
        payload.plaintext_value = newPlaintextValue.trim();
      }

      await api.secrets.update(secret.id, payload);

      onSecretUpdated();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update secret.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-secret-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="edit-secret-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2"
              >
                <span>Edit Secret</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 font-semibold">
                  ADMIN ONLY
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Metadata changes are saved immediately. Secret value is only updated if you provide a replacement.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security notice */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800/60 flex items-center gap-2 shrink-0">
          <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-zinc-500">
            Existing encrypted value is <strong className="text-slate-700 dark:text-zinc-300">not exposed</strong> when opening Edit. Leave &ldquo;Replace Secret Value&rdquo; empty to preserve it.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Secret Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Database"
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>

            {/* Owner Team */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Owner Team *
              </label>
              <input
                type="text"
                value={ownerTeam}
                onChange={(e) => setOwnerTeam(e.target.value)}
                placeholder="e.g. Core Infrastructure"
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Resource Type */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Resource Type
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="DATABASE_CREDENTIAL">Database Credential</option>
                <option value="API_KEY">API Key</option>
                <option value="SERVICE_TOKEN">Service Token</option>
                <option value="CLOUD_CREDENTIAL">Cloud Credential</option>
              </select>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="STAGING">STAGING</option>
                <option value="DEVELOPMENT">DEVELOPMENT</option>
              </select>
            </div>

            {/* Access Level */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Access Policy
              </label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary production database credential"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Requires Approval toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl">
            <input
              type="checkbox"
              id="edit-requires-approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="edit-requires-approval" className="text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
              Requires Approval for access
            </label>
          </div>

          {/* Replace Secret Value — SECURITY: deliberately empty by default */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                Replace Secret Value
              </label>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Leave empty to preserve existing
              </span>
            </div>
            <div className="relative">
              <input
                type={showNewValue ? 'text' : 'password'}
                value={newPlaintextValue}
                onChange={(e) => setNewPlaintextValue(e.target.value)}
                placeholder="Enter new value to replace encrypted secret…"
                autoComplete="new-password"
                className="w-full min-h-[40px] px-3 py-2 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-emerald-700 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewValue((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                aria-label={showNewValue ? 'Hide value' : 'Show value'}
              >
                {showNewValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
              If provided, will be AES-256-GCM re-encrypted before storage. Use demo values only.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0">
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
              className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
