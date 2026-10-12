'use client';

import React, { useState } from 'react';
import { AccessRequest, api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  ShieldAlert,
} from 'lucide-react';

interface ApprovalQueueViewProps {
  queue: AccessRequest[];
  onActionComplete: () => void;
}

export const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  queue,
  onActionComplete,
}) => {
  const { membership } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(
    queue[0] || null,
  );
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = membership?.role === 'APPROVER';

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setError(null);
    setIsProcessing(true);
    try {
      await api.requests.approve(
        selectedRequest.id,
        notes || 'Approved. Granted 30-minute temporary access.',
      );
      setNotes('');
      onActionComplete();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setError(null);
    setIsProcessing(true);
    try {
      await api.requests.reject(
        selectedRequest.id,
        notes || 'Rejected by approver.',
      );
      setNotes('');
      onActionComplete();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Approval Queue
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 font-semibold">
              {queue.length} PENDING
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Incoming credential requests requiring Approver authorization.
          </p>
        </div>

      </div>

      {/* Role permission alert if not authorized */}
      {!isAuthorized && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-center gap-3 text-xs text-amber-900 dark:text-amber-300">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold">Approver Role Required:</span>{' '}
            You are currently authenticated as{' '}
            <span className="font-mono font-bold text-amber-800 dark:text-amber-200">
              {membership?.role}
            </span>
            . Only users with the APPROVER role can approve or reject access requests.
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two-Column Queue & Detail Layout */}
      {queue.length === 0 ? (
        <div className="p-8 sm:p-16 text-center bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            Approval Queue Is Clean
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
            There are currently no pending access requests requiring review. Submit a request from the Secrets Vault to trigger an approval item.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): Queue List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
              Pending Requests ({queue.length})
            </div>

            {queue.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50/50 dark:bg-zinc-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-900/80 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-900 dark:text-zinc-100 truncate">
                      {req.secret_name}
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shrink-0 font-medium">
                      PENDING
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>{req.requester_name}</span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2 line-clamp-1 italic">
                    &ldquo;{req.business_reason}&rdquo;
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    <span>{req.requested_duration_minutes}m duration</span>
                    <span>{new Date(req.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column (7 cols): Request Detail & Action Panel */}
          {selectedRequest && (
            <div className="lg:col-span-7 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-5">
                {/* Header detail */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-zinc-800/80 pb-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                      Request Inspection
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                      {selectedRequest.secret_name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {selectedRequest.environment} • {selectedRequest.resource_type}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-mono">
                      Requested Duration
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {selectedRequest.requested_duration_minutes} Minutes
                    </div>
                  </div>
                </div>

                {/* Requester Identity */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Requester Identity
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const rName =
                        selectedRequest.requester_name ||
                        selectedRequest.requester_email ||
                        'Requester';
                      const rInitials =
                        rName
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'R';
                      return (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700/60 flex items-center justify-center font-semibold text-xs text-slate-800 dark:text-zinc-200 shrink-0">
                            {rInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                              {rName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono truncate">
                              {selectedRequest.requester_email}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Business Justification */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Business Justification
                  </div>
                  <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                    {selectedRequest.business_reason}
                  </p>
                </div>

                {/* Risk Evaluation */}
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl space-y-1.5">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Zero-Trust Policy Assessment</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Target is a high-sensitivity resource. Approving generates an active 30-minute temporary grant. All reveals and plaintext access will be audited immutably.
                  </div>
                </div>

                {/* Reviewer Notes Field */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                    Approval / Rejection Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter condition notes for audit trail..."
                    disabled={!isAuthorized}
                    className="w-full min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  onClick={handleReject}
                  disabled={!isAuthorized || isProcessing}
                  className="min-h-[44px] px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Request</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={!isAuthorized || isProcessing}
                  className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Processing...' : 'Approve & Grant Access'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
