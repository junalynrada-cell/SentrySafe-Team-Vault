'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from '../layout/Sidebar';
import {
  X,
  ShieldAlert,
  ArrowRight,
  Check,
  Shield,
  Layers,
} from 'lucide-react';

interface QuickUserSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
}

interface DemoAccount {
  name: string;
  email: string;
  role: 'DEVELOPER' | 'APPROVER' | 'ADMIN' | 'AUDITOR';
  description: string;
  keyAction: string;
  recommendedTab: NavTab;
  badgeColor: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Charlie Developer',
    email: 'developer@sentrysafe.io',
    role: 'DEVELOPER',
    description:
      'Standard engineer. Has zero standing production access. Requests temporary 30-min JIT grants with justification.',
    keyAction: 'Request Access & Reveal Secret',
    recommendedTab: 'secrets',
    badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
  },
  {
    name: 'Bob Approver',
    email: 'approver@sentrysafe.io',
    role: 'APPROVER',
    description:
      'Engineering Lead / SecOps. Reviews incoming temporary access requests and approves or rejects with audit notes.',
    keyAction: 'Review Approval Queue',
    recommendedTab: 'queue',
    badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
  },
  {
    name: 'Alice Admin',
    email: 'admin@sentrysafe.io',
    role: 'ADMIN',
    description:
      'Vault Administrator. Manages team members, access policies, secret creation/rotation, and system configuration.',
    keyAction: 'Manage Secrets & Members',
    recommendedTab: 'dashboard',
    badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
  },
  {
    name: 'Dana Auditor',
    email: 'auditor@sentrysafe.io',
    role: 'AUDITOR',
    description:
      'Compliance & Audit officer. Read-only access to immutable audit trails, denied attempts, and security logs.',
    keyAction: 'Inspect Immutable Audit Trail',
    recommendedTab: 'audit',
    badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
  },
];

export const QuickUserSwitcher: React.FC<QuickUserSwitcherProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { user, login } = useAuth();
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSwitch = async (account: DemoAccount) => {
    try {
      setSwitchingEmail(account.email);
      setErrorMessage(null);
      // Correction 2: Performs real server authentication POST /api/auth/login
      await login(account.email, 'Password123!');
      onNavigate(account.recommendedTab);
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to authenticate switch session');
    } finally {
      setSwitchingEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <span>Quick Role & Account Switcher</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                  Real Auth Session
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Select an account to authenticate an active demo session and navigate to its primary workflow.
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

        {/* Error message if any */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Demo Account Grid */}
        <div className="p-6 overflow-y-auto space-y-3">
          {DEMO_ACCOUNTS.map((account) => {
            const isCurrent = user?.email === account.email;
            const isSwitching = switchingEmail === account.email;

            return (
              <div
                key={account.email}
                className={`p-4 rounded-xl border transition-all ${isCurrent
                    ? 'bg-indigo-950/20 border-indigo-500/50 shadow-sm shadow-indigo-950/30'
                    : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-950'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center font-semibold text-xs text-zinc-200 shrink-0 mt-0.5">
                      {account.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">
                          {account.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${account.badgeColor}`}
                        >
                          {account.role}
                        </span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {account.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>Workflow:</span>
                        <span className="text-zinc-300 font-medium">
                          {account.keyAction}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Switch Action */}
                  <button
                    onClick={() => handleSwitch(account)}
                    disabled={account.role !== 'ADMIN' || isSwitching}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${isCurrent
                        ? 'bg-zinc-800 text-zinc-500 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-950/40 active:scale-95'
                      }`}
                  >
                    {isSwitching ? (
                      <span>Authenticating...</span>
                    ) : isCurrent ? (
                      <span>Current User</span>
                    ) : (
                      <>
                        <span>Switch User</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40 text-[11px] text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Every switch initiates a real server login (POST /api/auth/login) with Argon2id check.</span>
          </div>
          <span className="font-mono text-zinc-400">Password: Password123!</span>
        </div>
      </div>
    </div>
  );
};
