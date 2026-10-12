'use client';

import React, { useState, useEffect } from 'react';
import { ActiveGrant, api } from '../../lib/api';
import { NavTab } from '../layout/Sidebar';
import {
  KeyRound,
  Eye,
  StopCircle,
  Lock,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface MyActiveAccessViewProps {
  activeGrants: ActiveGrant[];
  onRevealSecret: (secretId: string, secretName: string) => void;
  onGrantRevoked: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const MyActiveAccessView: React.FC<MyActiveAccessViewProps> = ({
  activeGrants,
  onRevealSecret,
  onGrantRevoked,
  onNavigate,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const displayedGrants = activeGrants.map((g) => {
    const remaining = Math.max(0, g.seconds_remaining - elapsed);
    const isExpired = remaining <= 0 || g.status === 'EXPIRED';
    return {
      ...g,
      seconds_remaining: remaining,
      is_expired: isExpired,
    };
  });

  const handleRevoke = async (grantId: string) => {
    if (
      !confirm(
        'Are you sure you want to end temporary access early? Plaintext access will be revoked immediately and audited.',
      )
    ) {
      return;
    }
    setIsRevoking(true);
    try {
      await api.grants.revoke(grantId, 'User ended access early from My Active Access view');
      onGrantRevoked();
    } catch (err) {
      console.error('Failed to revoke grant', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Active Access
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Live just-in-time credential sessions granted to your authenticated session.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs font-mono text-emerald-800 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="truncate">Continuous Expiration Enforcement (Backend Authoritative)</span>
        </div>
      </div>

      {/* Main Content */}
      {displayedGrants.length === 0 ? (
        <div className="p-8 sm:p-16 text-center bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-200">
              No Active Temporary Access
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
              You do not have any active temporary grants. Under Zero-Trust policy, access is only granted on an auditable, timed basis.
            </p>
          </div>
          <button
            onClick={() => onNavigate('secrets')}
            className="min-h-[44px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Clock className="w-4 h-4" />
            <span>Browse Secrets Vault</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedGrants.map((grant) => {
            const totalDurationSecs = (grant.granted_duration_minutes || 30) * 60;
            const progressPercent = Math.min(
              100,
              Math.max(0, (grant.seconds_remaining / totalDurationSecs) * 100),
            );

            return (
              <div
                key={grant.id}
                className={`bg-white dark:bg-zinc-900/80 border rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl space-y-6 relative overflow-hidden transition-all ${
                  grant.is_expired
                    ? 'border-rose-300 dark:border-rose-800/60'
                    : 'border-emerald-300 dark:border-emerald-500/40'
                }`}
              >
                {/* Glowing top line */}
                <div
                  className={`absolute top-0 left-0 h-1 transition-all duration-1000 ${
                    grant.is_expired
                      ? 'bg-rose-500 dark:bg-rose-600 w-full'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: grant.is_expired ? '100%' : `${progressPercent}%` }}
                />

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  {/* Left: Secret identity */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        grant.is_expired
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400'
                          : 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <KeyRound className="w-6 h-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium ${
                            grant.is_expired
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800/60'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                          }`}
                        >
                          {grant.is_expired ? 'EXPIRED' : 'ACTIVE'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                          {grant.environment}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono truncate">
                          • {grant.owner_team}
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {grant.secret_name}
                      </h3>

                      <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-1 truncate">
                        Encrypted Preview: {grant.masked_preview}
                      </div>
                    </div>
                  </div>

                  {/* Right: Digital Countdown & Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 w-full lg:w-auto justify-between lg:justify-end">
                    {/* Digital Countdown Timer */}
                    <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 sm:px-5 py-3 text-center sm:text-right w-full sm:w-auto">
                      <div className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-zinc-500">
                        {grant.is_expired ? 'Access Status' : 'Access Window Remaining'}
                      </div>
                      <div
                        className={`text-2xl sm:text-3xl font-mono font-bold tracking-widest mt-0.5 ${
                          grant.is_expired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {grant.is_expired ? '00:00' : formatCountdown(grant.seconds_remaining)}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                        {grant.is_expired ? 'Access Expired' : 'MM:SS until revocation'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <button
                        onClick={() =>
                          onRevealSecret(grant.secret_id, grant.secret_name)
                        }
                        className={`min-h-[44px] px-5 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                          grant.is_expired
                            ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/60 dark:hover:bg-rose-800 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-700/60'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>
                          {grant.is_expired ? 'Reveal (Verify 403 Denial)' : 'Reveal Secret'}
                        </span>
                      </button>

                      {!grant.is_expired && (
                        <button
                          onClick={() => handleRevoke(grant.id)}
                          disabled={isRevoking}
                          className="min-h-[44px] px-4 py-3 bg-slate-100 hover:bg-rose-50 dark:bg-zinc-950 dark:hover:bg-rose-950/40 border border-slate-200 hover:border-rose-300 dark:border-zinc-800 dark:hover:border-rose-800/60 text-slate-600 hover:text-rose-700 dark:text-zinc-400 dark:hover:text-rose-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                          title="End Access Now (Revoke Grant Early)"
                        >
                          <StopCircle className="w-4 h-4" />
                          <span>End Access Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {!grant.is_expired ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                      <span>Active Session Progress</span>
                      <span>{Math.round(progressPercent)}% time remaining</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-zinc-950 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>
                      Temporary access has expired. The backend enforces <code>expires_at &gt; NOW()</code> synchronously and will reject unauthorized reveal attempts with HTTP 403 Forbidden.
                    </span>
                  </div>
                )}

                {/* Footer metadata */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                  <div>
                    Granted: {new Date(grant.granted_at).toLocaleTimeString()} • Expires:{' '}
                    {new Date(grant.expires_at).toLocaleTimeString()}
                  </div>
                  <div>
                    Reveal Count:{' '}
                    <span className="text-slate-800 dark:text-zinc-300 font-semibold">
                      {grant.revealed_count} times
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
