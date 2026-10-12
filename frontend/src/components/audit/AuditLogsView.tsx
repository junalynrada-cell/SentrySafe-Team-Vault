'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../lib/api';
import {
  Search,
  Lock,
  Terminal,
} from 'lucide-react';

interface AuditLogsViewProps {
  logs: AuditLog[];
  stats: {
    total_events: number;
    denied_events: number;
    admin_overrides: number;
    auto_expired_count: number;
    secret_reveals: number;
  };
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, stats }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Close inspector modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.actor_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction =
      selectedAction === 'ALL' || log.action === selectedAction;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SECRET_REVEALED':
        return 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'DENIED_ACCESS':
        return 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'ACCESS_APPROVED':
      case 'ACCESS_GRANTED':
        return 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
      case 'ACCESS_REQUEST':
        return 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'ACCESS_EXPIRED':
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700';
      case 'PERMISSION_CHANGED':
        return 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
      default:
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/50';
      case 'DENIED':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/50';
      case 'AUTOMATIC':
        return 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800/50';
      default:
        return 'text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
            <span>Immutable Audit Logs</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
              PostgreSQL Trigger Protected
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Append-only tamper-evident event log. UPDATE and DELETE actions are cryptographically prohibited.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-600 dark:text-zinc-400">
          <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Zero-Trust Compliance Engine</span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-medium">
            Total Audit Events
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {stats.total_events}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-400">Recorded in audit database</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-medium">
            Denied Access Attempts
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
            {stats.denied_events}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-400">Blocked unauthorized requests</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-medium">
            Secret Reveal Operations
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {stats.secret_reveals}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-400">Decrypted under valid grants</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-medium">
            Automatic Expirations
          </div>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">
            {stats.auto_expired_count}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-400">Enforced 30m cutoffs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by actor email, action, secret..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
          {[
            'ALL',
            'SECRET_REVEALED',
            'ACCESS_REQUEST',
            'ACCESS_APPROVED',
            'DENIED_ACCESS',
            'ACCESS_EXPIRED',
          ].map((act) => (
            <button
              key={act}
              onClick={() => setSelectedAction(act)}
              className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedAction === act
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300'
              }`}
            >
              {act === 'ALL' ? 'All Events' : act.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-6 py-4 font-mono text-slate-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 dark:text-zinc-200">
                        {log.actor_email}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${getActionBadge(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-zinc-200">
                        {log.resource_name}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                        {log.resource_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${getStatusBadge(
                          log.status,
                        )}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="min-h-[30px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-lg text-xs font-medium transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Log Inspector Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-3">
              <h3 id="inspector-modal-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Audit Record Inspector</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                aria-label="Close Inspector"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800/60 font-mono">
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">EVENT ID</span>
                  <span className="text-slate-800 dark:text-zinc-300 text-[11px] truncate block">
                    {selectedLog.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">ACTION</span>
                  <span className="text-indigo-600 dark:text-indigo-300 text-[11px]">
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">ACTOR</span>
                  <span className="text-slate-800 dark:text-zinc-300 text-[11px] truncate block">
                    {selectedLog.actor_email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">STATUS</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                    {selectedLog.status}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-700 dark:text-zinc-400 font-semibold block mb-1.5">
                  Payload Metadata (JSON)
                </span>
                <pre className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] font-mono text-slate-800 dark:text-zinc-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/80 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-transparent rounded-xl text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
