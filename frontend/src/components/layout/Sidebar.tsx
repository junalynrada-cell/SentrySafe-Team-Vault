'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  KeyRound,
  FileText,
  CheckSquare,
  Clock,
  ShieldAlert,
  Users,
  Settings,
  Lock,
  X,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'secrets'
  | 'requests'
  | 'queue'
  | 'active-access'
  | 'audit'
  | 'members'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingRequestsCount: number;
  activeGrantsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingRequestsCount,
  activeGrantsCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { membership, lockSession } = useAuth();

  // Close on Escape key
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      roleRequired: null,
    },
    {
      id: 'secrets' as NavTab,
      label: 'Secrets Vault',
      icon: KeyRound,
      badge: null,
      roleRequired: null,
    },
    {
      id: 'requests' as NavTab,
      label: 'Access Requests',
      icon: FileText,
      badge: null,
      roleRequired: null,
    },
    {
      id: 'queue' as NavTab,
      label: 'Approval Queue',
      icon: CheckSquare,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40',
      roleRequired: ['APPROVER'],
    },
    {
      id: 'active-access' as NavTab,
      label: 'My Active Access',
      icon: Clock,
      badge: activeGrantsCount > 0 ? `${activeGrantsCount} Active` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40',
      roleRequired: null,
    },
    {
      id: 'members' as NavTab,
      label: 'Team Members',
      icon: Users,
      badge: null,
      roleRequired: null,
    },
    {
      id: 'audit' as NavTab,
      label: 'Security Activity / Audit Logs',
      icon: ShieldAlert,
      badge: null,
      roleRequired: ['ADMIN', 'AUDITOR'],
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
      roleRequired: null,
    },
  ];

  const roleNavMap: Record<string, NavTab[]> = {
    ADMIN: ['dashboard', 'secrets', 'members', 'audit', 'settings'],
    DEVELOPER: ['dashboard', 'secrets', 'requests', 'active-access', 'settings'],
    APPROVER: ['dashboard', 'queue', 'settings'],
    AUDITOR: ['dashboard', 'audit', 'settings'],
  };

  const userRole = membership?.role || 'DEVELOPER';
  const allowedTabs = roleNavMap[userRole] || ['dashboard', 'settings'];
  const visibleNavItems = navItems.filter((item) => allowedTabs.includes(item.id));

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderContent = (isMobile: boolean = false) => (
    <div className="flex flex-col justify-between h-full">
      {/* Top section */}
      <div>
        {/* Brand & Organization */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-950/20 shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>SentrySafe</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-normal">
                  v1.0
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
                {membership?.org_name || 'Acme Corporation'}
              </div>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 -mr-1 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Role Identity Indicator */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800/60 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-mono font-medium">Role:</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            {userRole}
          </span>
        </div>

        {/* Navigation Items (Strictly Role-Specific) */}
        <nav className="p-3 space-y-1" aria-label="Main Navigation">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            {userRole} Navigation
          </div>
          {visibleNavItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 sm:py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-sm shadow-indigo-950/10'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: User Lock */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-800/80 space-y-2">
        {/* Inactivity Lock Trigger */}
        <button
          onClick={() => {
            lockSession();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 bg-slate-50 dark:bg-zinc-900/40 hover:bg-amber-50 dark:hover:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl text-xs font-medium transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Vault Session</span>
        </button>

        {/* Security badge footer */}
        <div className="px-3 py-1 text-[11px] text-slate-400 dark:text-zinc-500 text-center font-mono">
          AES-256-GCM • Zero-Trust
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800/80 flex-col justify-between h-screen sticky top-0 select-none z-40 shrink-0">
        {renderContent(false)}
      </aside>

      {/* Mobile Overlay Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between z-50 select-none animate-in slide-in-from-left duration-200 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Drawer"
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};

