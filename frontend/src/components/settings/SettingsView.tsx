'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Shield,
  Lock,
  FileCheck,
  CheckCircle2,
  Cpu,
  LogOut,
  Sun,
  Moon,
  Palette,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { lockSession, logout, user, membership } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Security & Policy Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Cryptographic standards, access control policies, and system preferences.
          </p>
        </div>

        <button
          onClick={lockSession}
          aria-label="Lock Vault Session"
          className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <Lock className="w-4 h-4" />
          <span>Lock Vault Session</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Appearance & Theme Section */}
        <div className="p-5 sm:p-6 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Appearance & Theme
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Choose between dark mode and light mode. Dark mode is default for vault operations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Dark Mode Card */}
            <button
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`min-h-[56px] p-4 rounded-xl border text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                theme === 'dark'
                  ? 'bg-zinc-950 border-indigo-500 ring-1 ring-indigo-500 shadow-md text-white'
                  : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-indigo-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    Dark Mode
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-normal">Default</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">High-contrast secure workspace</div>
                </div>
              </div>
              {theme === 'dark' && (
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
              )}
            </button>

            {/* Light Mode Card */}
            <button
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`min-h-[56px] p-4 rounded-xl border text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                theme === 'light'
                  ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500 shadow-md text-slate-900'
                  : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-zinc-800 border border-amber-300 dark:border-zinc-700 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Light Mode
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">Clean, high-visibility contrast</div>
                </div>
              </div>
              {theme === 'light' && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Zero-Trust Architecture */}
        <div className="p-5 sm:p-6 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Zero-Trust Access Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Continuous authentication and zero standing privileges.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Standing Production Access</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> NONE (Zero Standing)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Grant Duration Limit</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                30 Minutes Max (JIT)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Approver Quorum</span>
              <span className="font-mono text-slate-800 dark:text-zinc-300 font-semibold">
                Single Signoff (Configurable)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Automatic Expiration</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enforced Synchronously
              </span>
            </div>
          </div>
        </div>

        {/* Cryptography & Encryption */}
        <div className="p-5 sm:p-6 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-600/20 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cryptographic Standards & Key Management
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Industry-standard authenticated encryption algorithms.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Cipher at Rest</span>
              <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
                AES-256-GCM (Authenticated)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Password Hashing</span>
              <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
                Argon2id (Memory-hard)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Session Token Storage</span>
              <span className="font-mono text-slate-800 dark:text-zinc-300 font-semibold">
                SHA-256 Hashed (HTTP-only)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Master Key Location</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                Server-Side Environment Only
              </span>
            </div>
          </div>
        </div>

        {/* Audit Trail Immutability */}
        <div className="p-5 sm:p-6 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Compliance & Audit Immutability
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Tamper-proof audit infrastructure for SOC 2 and ISO 27001 readiness.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Database Engine</span>
              <span className="font-mono text-slate-800 dark:text-zinc-200 font-semibold">
                PostgreSQL 17 (Supabase)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Immutability Enforcement</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Database Trigger (55000)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Audit Log Deletions</span>
              <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                PROHIBITED (Throws Error)
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">Row-Level Security</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enabled (PostgREST Blocked)
              </span>
            </div>
          </div>
        </div>

        {/* Session Inactivity & Termination */}
        <div className="p-5 sm:p-6 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-200">
              Authenticated Session Termination
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Current user: <span className="text-slate-800 dark:text-zinc-200 font-mono font-medium">{user?.email}</span> ({membership?.role})
            </p>
          </div>

          <button
            onClick={logout}
            aria-label="Terminate Session"
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <LogOut className="w-4 h-4" />
            <span>Terminate Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
