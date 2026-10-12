'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  X,
  KeyRound,
  Shield,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface CreateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSecretCreated: () => void;
}

export const CreateSecretModal: React.FC<CreateSecretModalProps> = ({
  isOpen,
  onClose,
  onSecretCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('DATABASE_CREDENTIAL');
  const [environment, setEnvironment] = useState('PRODUCTION');
  const [ownerTeam, setOwnerTeam] = useState('Core Infrastructure');
  const [accessLevel, setAccessLevel] = useState('RESTRICTED');
  const [plaintextValue, setPlaintextValue] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Secret name is required.');
      return;
    }
    if (!plaintextValue.trim()) {
      setError('Secret value (password/credential) is required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await api.secrets.create({
        name: name.trim(),
        description: description.trim() || 'Demo database credential',
        resource_type: resourceType,
        environment,
        owner_team: ownerTeam.trim() || 'Core Infrastructure',
        plaintext_value: plaintextValue.trim(),
        requires_approval: requiresApproval,
        access_level: accessLevel,
        tags: [resourceType.toLowerCase(), environment.toLowerCase()],
      });

      onSecretCreated();
      onClose();
      setName('');
      setDescription('');
      setPlaintextValue('');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create secret.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-secret-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-secret-modal-title" className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Create New Secret</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 font-semibold">
                  ADMIN ONLY
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Encrypted at rest with AES-256-GCM hardware key before database storage.
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
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
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
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
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
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
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
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
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
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
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
              placeholder="e.g. Demo database credential"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Plaintext Secret Value */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                Plaintext Secret Value / Password *
              </label>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Will be AES-256-GCM encrypted
              </span>
            </div>
            <input
              type="text"
              value={plaintextValue}
              onChange={(e) => setPlaintextValue(e.target.value)}
              placeholder="e.g. DEMO-PASSWORD-123"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-emerald-700 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
              Use fake demo credentials only (e.g. DEMO-PASSWORD-123). Never use real passwords.
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
              className="min-h-[44px] px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Encrypting & Storing...' : 'Create & Encrypt Secret'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
