'use client';

import React, { useState } from 'react';
import { TeamMember, api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  CheckCircle2,
  Check,
  AlertCircle,
  Clock,
  UserX,
  Users,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface TeamMembersViewProps {
  members: TeamMember[];
  onRefresh: () => void;
}

type Tab = 'active' | 'pending' | 'removed';

const CANONICAL_ROLES = ['DEVELOPER', 'APPROVER', 'ADMIN', 'AUDITOR'] as const;

export const TeamMembersView: React.FC<TeamMembersViewProps> = ({
  members,
  onRefresh,
}) => {
  const { membership, user } = useAuth();
  const isAdmin = membership?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('DEVELOPER');
  const [approvingMemberId, setApprovingMemberId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<string>('DEVELOPER');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingMembers = members.filter((m) => m.status === 'PENDING');
  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const removedMembers = members.filter((m) => m.status === 'REMOVED');

  const handleUpdateRole = async (memberId: string) => {
    setError(null);
    setIsUpdating(true);
    try {
      await api.members.updateRole(memberId, selectedRole);
      setEditingMemberId(null);
      onRefresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update member role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member? Their active grants and sessions will be revoked. The membership record is preserved for audit purposes.')) {
      return;
    }
    setError(null);
    setIsUpdating(true);
    try {
      await api.members.delete(memberId);
      onRefresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to remove member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveMember = async (memberId: string) => {
    setError(null);
    setIsUpdating(true);
    try {
      await api.members.approve(memberId, approveRole);
      setApprovingMemberId(null);
      onRefresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to approve member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestoreMember = async (memberId: string) => {
    setError(null);
    setIsUpdating(true);
    try {
      await api.members.restore(memberId, approveRole);
      setApprovingMemberId(null);
      onRefresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to restore member');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadgeStyle = (role: string | null) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800/60';
      case 'APPROVER':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60';
      case 'DEVELOPER':
        return 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800/60';
      case 'AUDITOR':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60';
      default:
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700';
    }
  };

  const MemberAvatar: React.FC<{ member: TeamMember }> = ({ member }) => {
    const mName = member.name || member.email;
    const mInitials =
      mName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'M';
    return (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center font-semibold text-xs text-slate-800 dark:text-zinc-200 shrink-0">
          {mInitials}
        </div>
        <div>
          <div className="font-semibold text-slate-900 dark:text-zinc-200 text-xs">{mName}</div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-400 font-mono">{member.email}</div>
        </div>
      </div>
    );
  };

  const tabItems: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: 'active',
      label: 'Active',
      count: activeMembers.length,
      icon: <Users className="w-3.5 h-3.5" />,
    },
    {
      id: 'pending',
      label: 'Pending Approval',
      count: pendingMembers.length,
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      id: 'removed',
      label: 'Removed',
      count: removedMembers.length,
      icon: <UserX className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Team Members &amp; Access Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Organization membership lifecycle, role assignment, and least-privilege entitlement management.
          </p>
        </div>

      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/60 rounded-xl p-1 w-fit">
        {tabItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setEditingMemberId(null);
              setApprovingMemberId(null);
              setError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700'
                : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  tab.id === 'pending'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE MEMBERS TAB ── */}
      {activeTab === 'active' && (
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          {activeMembers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
              No active members found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role Entitlement</th>
                    <th className="px-6 py-4">Active Grants</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Joined At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {activeMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <MemberAvatar member={m} />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingMemberId === m.id ? (
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="min-h-[36px] px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                          >
                            {CANONICAL_ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${getRoleBadgeStyle(m.role)}`}>
                            {m.role ?? 'UNASSIGNED'}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {m.active_grants_count > 0 ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {m.active_grants_count} Active JIT
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-400 text-[11px] font-mono">0 Active</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ACTIVE</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            {editingMemberId === m.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateRole(m.id)}
                                  disabled={isUpdating}
                                  className="min-h-[32px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={() => setEditingMemberId(null)}
                                  className="min-h-[32px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded-lg text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingMemberId(m.id);
                                    setSelectedRole(m.role ?? 'DEVELOPER');
                                  }}
                                  className="min-h-[32px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-lg text-xs font-medium transition-colors"
                                >
                                  Edit Role
                                </button>
                                {m.user_id !== user?.id && (
                                  <button
                                    onClick={() => handleRemoveMember(m.id)}
                                    disabled={isUpdating}
                                    className="min-h-[32px] px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Remove
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING APPROVAL TAB ── */}
      {activeTab === 'pending' && (
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          {pendingMembers.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">No pending membership requests.</p>
              <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">
                New members will appear here after signing up through the registration page.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-50/80 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Applicant</th>
                    <th className="px-6 py-4">Requested</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Approve &amp; Assign Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {pendingMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <MemberAvatar member={m} />
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>PENDING</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            {approvingMemberId === m.id ? (
                              <>
                                <select
                                  value={approveRole}
                                  onChange={(e) => setApproveRole(e.target.value)}
                                  className="min-h-[32px] px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                                >
                                  {CANONICAL_ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleApproveMember(m.id)}
                                  disabled={isUpdating}
                                  className="min-h-[32px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => setApprovingMemberId(null)}
                                  className="min-h-[32px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded-lg text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setApprovingMemberId(m.id);
                                  setApproveRole('DEVELOPER');
                                }}
                                className="min-h-[32px] px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Review &amp; Approve</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REMOVED MEMBERS TAB ── */}
      {activeTab === 'removed' && (
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          {removedMembers.length === 0 ? (
            <div className="p-12 text-center">
              <UserX className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">No removed members.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Previous Role</th>
                    <th className="px-6 py-4">Removed At</th>
                    <th className="px-6 py-4 text-right">Restore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {removedMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors opacity-80">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <MemberAvatar member={m} />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${getRoleBadgeStyle(m.role)}`}>
                          {m.role ?? 'UNASSIGNED'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {m.removed_at ? new Date(m.removed_at).toLocaleDateString() : '—'}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            {approvingMemberId === m.id ? (
                              <>
                                <select
                                  value={approveRole}
                                  onChange={(e) => setApproveRole(e.target.value)}
                                  className="min-h-[32px] px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                                >
                                  {CANONICAL_ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleRestoreMember(m.id)}
                                  disabled={isUpdating}
                                  className="min-h-[32px] px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                                <button
                                  onClick={() => setApprovingMemberId(null)}
                                  className="min-h-[32px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded-lg text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setApprovingMemberId(m.id);
                                  setApproveRole(m.role ?? 'DEVELOPER');
                                }}
                                className="min-h-[32px] px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore Access</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RBAC Policy Reference Card */}
      <div className="p-5 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl space-y-3 shadow-sm">
        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Role Entitlement Matrix</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-zinc-400">
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/60 space-y-1">
            <span className="font-mono font-bold text-blue-700 dark:text-blue-300">DEVELOPER</span>
            <p className="text-[11px]">
              Zero standing access. Can submit 30m temporary requests with justification.
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/60 space-y-1">
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">APPROVER</span>
            <p className="text-[11px]">
              Authorizes incoming temporary access requests. Cannot edit organization settings.
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/60 space-y-1">
            <span className="font-mono font-bold text-purple-700 dark:text-purple-300">ADMIN</span>
            <p className="text-[11px]">
              Full vault management, member role assignments, and secret administration.
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/60 space-y-1">
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">AUDITOR</span>
            <p className="text-[11px]">
              Read-only compliance officer. Inspects immutable logs and denied attempt records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
