'use client';

import React from 'react';
import { SecretItem } from '../../lib/api';
import {
  X,
  Shield,
  KeyRound,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface SecretDetailsModalProps {
  secret: SecretItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestAccess: (secret: SecretItem) => void;
  onRevealSecret: (secretId: string, secretName: string) => void;
}

export const SecretDetailsModal: React.FC<SecretDetailsModalProps> = ({
  secret,
  isOpen,
  onClose,
  onRequestAccess,
  onRevealSecret,
}) => {
  if (!isOpen || !secret) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {secret.name}
              </h3>
              <p className="text-xs text-zinc-400">
                Resource Specification & Access Policy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Description */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Description
            </div>
            <p className="text-xs text-zinc-300">
              {secret.description || 'Enterprise production credential protected by Zero-Trust policy.'}
            </p>
          </div>

          {/* Masked Preview */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">Encrypted Value Preview</span>
              <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                <Lock className="w-3.5 h-3.5" />
                AES-256-GCM
              </span>
            </div>
            <div className="font-mono text-sm text-zinc-300 tracking-wider">
              {secret.masked_preview}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Environment
              </div>
              <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                {secret.environment}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Resource Type
              </div>
              <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                {secret.resource_type}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Owner Team
              </div>
              <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                {secret.owner_team}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Last Rotated
              </div>
              <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                {secret.last_rotated_at
                  ? new Date(secret.last_rotated_at).toLocaleDateString()
                  : 'Automated policy active'}
              </div>
            </div>
          </div>

          {/* Policy Compliance Box */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2">
            <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Zero-Trust Access Policy</span>
            </div>
            <ul className="text-[11px] text-zinc-400 space-y-1.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero standing access: Plaintext is NEVER delivered without active grant.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Requires Approver role signoff with auditable business justification.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Grants auto-expire strictly after 30 minutes. Plaintext access cuts off immediately.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
          >
            Close
          </button>

          {secret.has_active_grant ? (
            <button
              onClick={() => {
                onClose();
                onRevealSecret(secret.id, secret.name);
              }}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
            >
              <Eye className="w-4 h-4" />
              <span>Reveal Plaintext</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onRequestAccess(secret);
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/40"
            >
              <Clock className="w-4 h-4" />
              <span>Request Temporary Access</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
