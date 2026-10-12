'use client';

import React from 'react';
import { DashboardStats, SecretItem } from '../../lib/api';
import { NavTab } from '../layout/Sidebar';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  CheckSquare,
  Clock,
  ShieldCheck,
  ArrowRight,
  Eye,
  ExternalLink,
  Activity,
  AlertTriangle,
  Users,
  ShieldAlert,
  Plus,
  Lock,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface DashboardViewProps {
  stats: DashboardStats | null;
  onNavigate: (tab: NavTab) => void;
  onRequestAccess: (secret: SecretItem) => void;
  onRevealSecret: (secretId: string, secretName: string) => void;
  onViewSecretDetails: (secret: SecretItem) => void;
  onOpenCreateSecret?: () => void;
}

const formatCountdown = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigate,
  onRequestAccess,
  onRevealSecret,
  onViewSecretDetails,
  onOpenCreateSecret,
}) => {
  const { membership } = useAuth();
  const role = membership?.role || 'DEVELOPER';

  // 1. DEVELOPER DASHBOARD
  if (role === 'DEVELOPER') {
    const activeGrants = stats?.user_active_grants || [];
    const primaryActiveGrant = activeGrants[0];
    const myRequests = stats?.my_recent_requests || [];

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        {/* Active Grant Banner if developer has active temporary access */}
        {primaryActiveGrant ? (
          <div className="bg-gradient-to-r from-emerald-50 via-white to-white dark:from-emerald-950/80 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-500/40 rounded-2xl p-4 sm:p-6 shadow-xl shadow-emerald-950/10 dark:shadow-emerald-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-medium">
                    ACTIVE TEMPORARY GRANT
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                    {primaryActiveGrant.environment}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {primaryActiveGrant.secret_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Authorized for timed Just-in-Time access. Plaintext reveal is cryptographically audited.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-medium">
                  Time Remaining
                </div>
                <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  {formatCountdown(primaryActiveGrant.seconds_remaining)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    onRevealSecret(
                      primaryActiveGrant.secret_id,
                      primaryActiveGrant.secret_name,
                    )
                  }
                  className="min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <Eye className="w-4 h-4" />
                  <span>Reveal Secret</span>
                </button>

                <button
                  onClick={() => onNavigate('active-access')}
                  className="min-h-[44px] px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-transparent flex items-center justify-center"
                  title="View Full Active Grant Details"
                  aria-label="View Active Grant Details"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong className="text-slate-900 dark:text-zinc-200">Zero Standing Privilege Active:</strong> All secrets require an approved temporary Just-in-Time request before reveal.
              </span>
            </div>
            <button
              onClick={() => onNavigate('secrets')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium whitespace-nowrap min-h-[36px] flex items-center"
            >
              Browse Vault →
            </button>
          </div>
        )}

        {/* Developer Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div
            onClick={() => onNavigate('active-access')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Active Grants</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.user_active_grants?.length || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Timed</span> access sessions
            </div>
          </div>

          <div
            onClick={() => onNavigate('requests')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">My Requests</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.my_requests_count ?? (myRequests.length || 0)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Personal JIT request history</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate('secrets')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Vault Secrets</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.total_secrets || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-purple-600 dark:text-purple-400 font-medium">AES-256-GCM</span> encrypted
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Access Window</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
              30m Max
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Auto-revocation enforced</span>
            </div>
          </div>
        </div>

        {/* Developer Main Content: Permitted Secrets + My Recent Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column (2 cols): Permitted Secrets */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Permitted Secrets Vault</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Protected organizational credentials available for Just-in-Time temporary access.
                </p>
              </div>
              <button
                onClick={() => onNavigate('secrets')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
              >
                <span>View All Secrets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {(stats?.recent_secrets || []).map((sec) => {
                const hasGrant = (stats?.user_active_grants || []).some(
                  (g) => g.secret_id === sec.id && g.status === 'ACTIVE' && g.seconds_remaining > 0,
                );

                return (
                  <div
                    key={sec.id}
                    className="p-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center text-slate-700 dark:text-zinc-300 shrink-0">
                        <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{sec.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            {sec.environment}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 dark:text-zinc-500 mt-1 truncate">
                          {sec.masked_preview}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                      <button
                        onClick={() => onViewSecretDetails(sec)}
                        className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-transparent"
                      >
                        Details
                      </button>
                      {hasGrant ? (
                        <button
                          onClick={() => onRevealSecret(sec.id, sec.name)}
                          className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Reveal</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onRequestAccess(sec)}
                          className="min-h-[36px] px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          Request Access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column (1 col): Developer's Recent Requests */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>My Recent Requests</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Personal temporary access requests.</p>
              </div>
              <button
                onClick={() => onNavigate('requests')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
              >
                <span>All Requests</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
              {myRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                  No requests submitted yet. Select a secret to request access.
                </div>
              ) : (
                myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                        {req.secret_name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                            : req.status === 'PENDING'
                            ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400 truncate italic">
                      &ldquo;{req.business_reason}&rdquo;
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono flex items-center justify-between">
                      <span>{req.requested_duration_minutes}m duration</span>
                      <span>{new Date(req.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. APPROVER DASHBOARD
  if (role === 'APPROVER') {
    const pendingQueue = stats?.pending_queue || [];

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        {/* Approver Header Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div
            onClick={() => onNavigate('queue')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Pending Approvals</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.pending_requests || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              {(stats?.metrics?.pending_requests || 0) > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Action Required
                </span>
              ) : (
                <span className="text-slate-500 dark:text-zinc-400">Queue is clear</span>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Active Org Grants</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.active_grants_count || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">In progress</span> across team
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Auto-Expirations</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.auto_expired_count || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Cutoffs enforced automatically</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Review Policy</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
              30m Window
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Strict least privilege</span>
            </div>
          </div>
        </div>

        {/* Approver Main Content: Pending Queue List + Guidelines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column (2 cols): Pending Requests */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Requests Awaiting Your Review</span>
                  {pendingQueue.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 font-semibold">
                      {pendingQueue.length} PENDING
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Incoming Just-in-Time temporary access requests requiring Approver authorization.
                </p>
              </div>
              <button
                onClick={() => onNavigate('queue')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
              >
                <span>Open Approval Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="p-8 sm:p-12 text-center bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Queue Is Clear</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
                  There are currently no access requests requiring review. Requests submitted by Developers appear here immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-white dark:bg-zinc-900/60 border border-amber-300 dark:border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{req.secret_name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                          {req.environment}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                          {req.requested_duration_minutes}m
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-zinc-400">
                        Requester: <strong className="text-slate-900 dark:text-zinc-200">{req.requester_name}</strong> ({req.requester_email})
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 italic truncate">
                        &ldquo;{req.business_reason}&rdquo;
                      </p>
                    </div>

                    <button
                      onClick={() => onNavigate('queue')}
                      className="w-full sm:w-auto min-h-[38px] px-4 py-2 bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Review in Queue</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (1 col): Approver Zero-Trust Protocol */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Reviewer Protocol</h3>
            <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 text-xs shadow-sm">
              <div className="space-y-1">
                <span className="font-semibold text-slate-900 dark:text-zinc-200 block">Separation of Duties</span>
                <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Approvers cannot approve their own requests. The backend enforces HTTP 403 Forbidden on any self-approval attempts.
                </p>
              </div>

              <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-zinc-800/80">
                <span className="font-semibold text-slate-900 dark:text-zinc-200 block">Time-Bound Approvals</span>
                <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                  All approvals generate temporary grants strictly constrained to a 30-minute cutoff. Secrets become inaccessible immediately upon expiration.
                </p>
              </div>

              <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-zinc-800/80">
                <span className="font-semibold text-slate-900 dark:text-zinc-200 block">Audited Decisions</span>
                <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Every approval and rejection is appended to the immutable audit trail with reviewer identity, timestamp, and optional review notes.
                </p>
              </div>

              <button
                onClick={() => onNavigate('queue')}
                className="w-full min-h-[44px] py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-transparent rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <span>Go to Approval Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. ADMIN DASHBOARD
  if (role === 'ADMIN') {
    const teamMembers = stats?.team_roster_summary || [];

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        {/* Admin Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Administrative Management</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Vault secrets encryption, organization members, and role-based access control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {onOpenCreateSecret && (
              <button
                onClick={onOpenCreateSecret}
                className="min-h-[40px] px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Secret</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('members')}
              className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-transparent rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Manage Members</span>
            </button>
          </div>
        </div>

        {/* Admin Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div
            onClick={() => onNavigate('secrets')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Encrypted Secrets</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.total_secrets || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-purple-600 dark:text-purple-400 font-medium">AES-256-GCM</span> hardware encrypted
            </div>
          </div>

          <div
            onClick={() => onNavigate('members')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Team Members</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.members_count || teamMembers.length}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">RBAC</span> governed users
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Active Org Grants</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.active_grants_count || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">JIT sessions</span> in progress
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Access Architecture</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
              RBAC + JIT
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Zero standing developer access</span>
            </div>
          </div>
        </div>

        {/* Admin Main Content: Secrets Overview (with Direct Reveal) + Team Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column (2 cols): Vault Secrets */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Secrets Vault Overview</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Manage organization credentials. Administrative reveals are authorized and audited.
                </p>
              </div>
              <button
                onClick={() => onNavigate('secrets')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
              >
                <span>Manage All Secrets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {(stats?.recent_secrets || []).map((sec) => (
                <div
                  key={sec.id}
                  className="p-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center text-slate-700 dark:text-zinc-300 shrink-0">
                      <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{sec.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                          {sec.environment}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          • {sec.owner_team}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 dark:text-zinc-500 mt-1 truncate">
                        {sec.masked_preview}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button
                      onClick={() => onViewSecretDetails(sec)}
                      className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-transparent"
                    >
                      Details
                    </button>
                    {/* Admin direct reveal: Audited under ADMIN_SECRET_ACCESS */}
                    <button
                      onClick={() => onRevealSecret(sec.id, sec.name)}
                      className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (1 col): Team Members Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Team Roster</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Current RBAC assignments.</p>
              </div>
              <button
                onClick={() => onNavigate('members')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
              >
                <span>All Members</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
              {teamMembers.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 truncate">
                      {m.full_name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                      {m.email}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                      m.role === 'ADMIN'
                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800/60'
                        : m.role === 'APPROVER'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                        : m.role === 'DEVELOPER'
                        ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800/60'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. AUDITOR DASHBOARD
  if (role === 'AUDITOR') {
    const recentActivity = stats?.recent_activity || [];

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        {/* Auditor Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div
            onClick={() => onNavigate('audit')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Total Audit Events</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {stats?.metrics?.total_audit_events || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Append-only database records</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate('audit')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Denied Attempts</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {stats?.metrics?.denied_events || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-rose-600 dark:text-rose-400 font-medium">HTTP 403</span> blocked violations
            </div>
          </div>

          <div
            onClick={() => onNavigate('audit')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Secret Reveals</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats?.metrics?.secret_reveals || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Decryptions under authorized grants</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate('audit')}
            className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Auto-Expirations</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 tracking-tight">
              {stats?.metrics?.auto_expired_count || 0}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Synchronous cutoff events</span>
            </div>
          </div>
        </div>

        {/* Auditor Main Content: Audit Activity Stream (Full Width) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Audit Activity Stream</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Feed of authentication, access request, approval, and secret reveal events.
              </p>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors min-h-[36px]"
            >
              <span>Full Audit Trail</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No audit logs recorded yet.
              </div>
            ) : (
              recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 rounded-xl space-y-1.5 transition-colors hover:border-slate-300 dark:hover:border-zinc-700/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 truncate">
                      {act.action}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                        act.status === 'SUCCESS'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                          : act.status === 'DENIED'
                          ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {act.actor_email} • {act.resource_name}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
