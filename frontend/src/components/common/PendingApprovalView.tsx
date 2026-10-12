'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, Shield, LogOut, Mail } from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(251,191,36,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.3) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-lg z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/30 mb-4 shadow-xl shadow-amber-950/40">
            <Clock className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SentrySafe</h1>
          <p className="text-sm text-zinc-500 mt-1">Zero-Trust Team Vault</p>
        </div>

        {/* Pending Card */}
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-amber-800/40 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Awaiting Administrator Approval</h2>
              <p className="text-xs text-zinc-500">Your account is pending review</p>
            </div>
          </div>

          {user && (
            <div className="mb-6 p-3.5 bg-zinc-950/60 border border-zinc-800/60 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-semibold text-xs text-zinc-200 shrink-0">
                {(user.name || user.full_name || user.email)
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-200 truncate">
                  {user.name || user.full_name || user.email}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="font-mono truncate">{user.email}</span>
                </div>
              </div>
              <span className="ml-auto shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-950/60 text-amber-300 border-amber-800/60 uppercase">
                PENDING
              </span>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <p className="text-sm text-zinc-300">
              Your account was created successfully. Access to the vault is restricted until an administrator reviews your request and assigns you a role.
            </p>
            <div className="p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Account created</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Your credentials are securely stored with Argon2id hashing.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Admin review in progress</p>
                  <p className="text-xs text-zinc-500 mt-0.5">An administrator will approve your request and assign your role (DEVELOPER, APPROVER, AUDITOR, or ADMIN).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-700/80 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-2.5 h-2.5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500">Vault access</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Once approved, you'll have role-based access to the SentrySafe vault.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zinc-600 text-center sm:text-left">
              Sign back in after approval to access the vault.
            </p>
            <button
              id="pending-logout"
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
