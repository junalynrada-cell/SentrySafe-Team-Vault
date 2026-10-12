'use client';

import React, { useState } from 'react';
import { AccessRequest } from '../../lib/api';
import { NavTab } from '../layout/Sidebar';
import {
  Search,
  Plus,
} from 'lucide-react';

interface AccessRequestsViewProps {
  requests: AccessRequest[];
  onNavigate: (tab: NavTab) => void;
}

export const AccessRequestsView: React.FC<AccessRequestsViewProps> = ({
  requests,
  onNavigate,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filterStatus === 'ALL' || r.status === filterStatus;
    const matchesSearch =
      r.secret_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.business_reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'PENDING':
        return 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'REJECTED':
        return 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'EXPIRED':
      default:
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Access Requests
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            History of just-in-time access requests and administrative decisions.
          </p>
        </div>

        <button
          onClick={() => onNavigate('secrets')}
          className="min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Access Request</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter requests..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filterStatus === s
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-6 py-4">Secret & Resource</th>
                <th className="px-6 py-4">Requester</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Business Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Requested At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">
                    No access requests found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-zinc-200">
                        {req.secret_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
                        {req.environment} • {req.resource_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-zinc-200">
                        {req.requester_name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {req.requester_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                      {req.requested_duration_minutes}m
                    </td>
                    <td className="px-6 py-4 max-w-xs text-slate-600 dark:text-zinc-300 truncate">
                      {req.business_reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${getStatusBadge(
                          req.status,
                        )}`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
