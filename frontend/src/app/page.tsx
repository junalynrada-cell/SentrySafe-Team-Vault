'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Sidebar, NavTab } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { DashboardView } from '../components/dashboard/DashboardView';
import { SecretsVaultView } from '../components/vault/SecretsVaultView';
import { SecretDetailsModal } from '../components/vault/SecretDetailsModal';
import { RequestAccessModal } from '../components/vault/RequestAccessModal';
import { CreateSecretModal } from '../components/vault/CreateSecretModal';
import { EditSecretModal } from '../components/vault/EditSecretModal';
import { DeleteSecretModal } from '../components/vault/DeleteSecretModal';
import { AccessRequestsView } from '../components/requests/AccessRequestsView';
import { ApprovalQueueView } from '../components/requests/ApprovalQueueView';
import { MyActiveAccessView } from '../components/access/MyActiveAccessView';
import { RevealModal } from '../components/access/RevealModal';
import { AuditLogsView } from '../components/audit/AuditLogsView';
import { TeamMembersView } from '../components/members/TeamMembersView';
import { SettingsView } from '../components/settings/SettingsView';
import { SessionLockModal } from '../components/common/SessionLockModal';
import { LoginView } from '../components/common/LoginView';
import { SignupView } from '../components/common/SignupView';
import { PendingApprovalView } from '../components/common/PendingApprovalView';
import {
  api,
  SecretItem,
  AccessRequest,
  ActiveGrant,
  AuditLog,
  TeamMember,
  DashboardStats,
} from '../lib/api';

function VaultAppContent() {
  const { user, membership, isLoading } = useAuth();

  // Navigation state
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  // Modals state
  const [isCreateSecretModalOpen, setIsCreateSecretModalOpen] = useState(false);
  const [selectedSecretForDetails, setSelectedSecretForDetails] =
    useState<SecretItem | null>(null);
  const [selectedSecretForRequest, setSelectedSecretForRequest] =
    useState<SecretItem | null>(null);
  const [selectedSecretForEdit, setSelectedSecretForEdit] =
    useState<SecretItem | null>(null);
  const [selectedSecretForDelete, setSelectedSecretForDelete] =
    useState<SecretItem | null>(null);
  const [revealModalData, setRevealModalData] = useState<{
    isOpen: boolean;
    secretName: string;
    plaintext: string;
    resourceType?: string;
    credentialBreakdown?: {
      host: string;
      port: string;
      database: string;
      username: string;
      password: string;
    };
  }>({
    isOpen: false,
    secretName: '',
    plaintext: '',
  });

  // Data state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null,
  );
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [queue, setQueue] = useState<AccessRequest[]>([]);
  const [activeGrants, setActiveGrants] = useState<ActiveGrant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState({
    total_events: 0,
    denied_events: 0,
    admin_overrides: 0,
    auto_expired_count: 0,
    secret_reveals: 0,
  });
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Enforce role-specific navigation protection (Correction 3)
  const roleNavMap: Record<string, NavTab[]> = {
    ADMIN: ['dashboard', 'secrets', 'members', 'audit', 'settings'],
    DEVELOPER: ['dashboard', 'secrets', 'requests', 'active-access', 'settings'],
    APPROVER: ['dashboard', 'queue', 'settings'],
    AUDITOR: ['dashboard', 'audit', 'settings'],
  };
  const allowed = (membership?.role && roleNavMap[membership.role]) || ['dashboard', 'settings'];
  const activeTab: NavTab = allowed.includes(currentTab) ? currentTab : 'dashboard';

  // Master refresh function
  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Dashboard stats
      const stats = await api.dashboard.getStats().catch(() => null);
      if (stats) setDashboardStats(stats);

      // 2. Secrets (for Admin & Developer)
      if (membership?.role === 'ADMIN' || membership?.role === 'DEVELOPER') {
        const secList = await api.secrets.list().catch(() => []);
        setSecrets(secList);
      }

      // 3. Requests (for Developer)
      if (membership?.role === 'DEVELOPER') {
        const reqList = await api.requests.list().catch(() => []);
        setRequests(reqList);
      }

      // 4. Active Grants (for Developer)
      if (membership?.role === 'DEVELOPER') {
        const grants = await api.grants.getActive().catch(() => []);
        setActiveGrants(grants);
      }

      // 5. Queue (STRICTLY Approver only - Correction 4)
      if (membership?.role === 'APPROVER') {
        const q = await api.requests.getQueue().catch(() => []);
        setQueue(q);
      } else {
        setQueue([]);
      }

      // 6. Audit logs (Auditor and Admin)
      if (membership?.role === 'AUDITOR' || membership?.role === 'ADMIN') {
        const auditRes = await api.audit.getLogs().catch(() => null);
        if (auditRes) {
          setAuditLogs(auditRes.logs);
          setAuditStats(auditRes.stats);
        }
      }

      // 7. Members (STRICTLY Admin only - Correction 4)
      if (membership?.role === 'ADMIN') {
        const memberList = await api.members.list().catch(() => []);
        setMembers(memberList);
      }
    } catch (err) {
      console.error('Failed to refresh vault data', err);
    }
  }, [user, membership]);

  // Initial and reactive refresh
  useEffect(() => {
    let active = true;
    const fetchInitial = async () => {
      if (user && active) {
        await refreshData();
      }
    };
    void fetchInitial();
    return () => {
      active = false;
    };
  }, [user, refreshData]);

  // Periodic polling for live countdown and status updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshData();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Action: Reveal Secret
  const handleRevealSecret = async (secretId: string, secretName: string) => {
    try {
      const data = await api.secrets.reveal(secretId);
      setRevealModalData({
        isOpen: true,
        secretName: data.name || secretName,
        plaintext: data.plaintext,
        resourceType: data.resource_type,
        credentialBreakdown: data.credential_breakdown,
      });
      await refreshData();
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '';
      const status = (err as { status?: number }).status;
      if (
        status === 403 ||
        errorMsg.toLowerCase().includes('active temporary grant') ||
        errorMsg.toLowerCase().includes('denied')
      ) {
        showToast('Temporary access has expired. (HTTP 403 Forbidden)');
      } else {
        showToast(errorMsg || 'Access denied. Active grant required.');
      }
      await refreshData();
    }
  };

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        if (membership?.role === 'ADMIN') {
          return {
            title: 'Administrative Control Console',
            subtitle: 'Vault organization management, access policies, and secret credentials',
          };
        }
        if (membership?.role === 'APPROVER') {
          return {
            title: 'Approver Authorization Console',
            subtitle: 'Review incoming Just-in-Time temporary credential access requests',
          };
        }
        if (membership?.role === 'AUDITOR') {
          return {
            title: 'Security & Audit Monitoring Console',
            subtitle: 'Compliance monitoring and immutable security event logs',
          };
        }
        return {
          title: 'Developer Credential Workspace',
          subtitle: 'Just-in-Time access requests and active temporary sessions',
        };
      case 'secrets':
        return {
          title: 'Secrets Vault',
          subtitle:
            'Encrypted credentials under continuous Zero-Trust access control',
        };
      case 'requests':
        return {
          title: 'Access Requests',
          subtitle: 'History of temporary Just-in-Time access requests',
        };
      case 'queue':
        return {
          title: 'Approval Queue',
          subtitle: 'Incoming credential requests requiring reviewer signoff',
        };
      case 'active-access':
        return {
          title: 'My Active Access',
          subtitle: 'Live timed sessions granted to your authenticated identity',
        };
      case 'audit':
        return {
          title: 'Immutable Audit Trail',
          subtitle: 'Cryptographically protected audit log records',
        };
      case 'members':
        return {
          title: 'Team Members & Permissions',
          subtitle: 'Organization membership and role entitlements',
        };
      case 'settings':
        return {
          title: 'Security & Access Control Settings',
          subtitle: 'Cryptographic policies and zero-trust configuration',
        };
      default:
        return {
          title: 'SentrySafe Team Vault',
          subtitle: 'Zero-Trust Secrets Management',
        };
    }
  };

  const pageInfo = getPageInfo();

  if (isLoading && !user) {
    return (
      <div className="h-screen w-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-mono text-slate-500 dark:text-zinc-400">
          Initializing SentrySafe Zero-Trust Session...
        </div>
      </div>
    );
  }

  // Not authenticated → show login or signup
  if (!user) {
    if (authView === 'signup') {
      return <SignupView onShowLogin={() => setAuthView('login')} />;
    }
    return <LoginView onShowSignup={() => setAuthView('signup')} />;
  }

  // Authenticated but PENDING — show pending approval screen
  if (membership?.status === 'PENDING' || !membership?.role) {
    return <PendingApprovalView />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans overflow-hidden w-full">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-indigo-500/80 rounded-2xl shadow-2xl text-xs text-slate-800 dark:text-zinc-100 flex items-center gap-3 animate-in slide-in-from-top duration-200 max-w-md">
          <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar navigation (Desktop + Mobile Drawer) */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        pendingRequestsCount={queue.length}
        activeGrantsCount={activeGrants.length}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        {/* Header */}
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Dynamic View rendering */}
        <main className="flex-1 pb-16 w-full min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={dashboardStats}
              onNavigate={setCurrentTab}
              onRequestAccess={(sec) => setSelectedSecretForRequest(sec)}
              onRevealSecret={handleRevealSecret}
              onViewSecretDetails={(sec) => setSelectedSecretForDetails(sec)}
              onOpenCreateSecret={() => setIsCreateSecretModalOpen(true)}
            />
          )}

          {activeTab === 'secrets' && (
            <SecretsVaultView
              secrets={secrets}
              onRequestAccess={(sec) => setSelectedSecretForRequest(sec)}
              onRevealSecret={handleRevealSecret}
              onViewDetails={(sec) => setSelectedSecretForDetails(sec)}
              onOpenCreateSecret={() => setIsCreateSecretModalOpen(true)}
              onEditSecret={(sec) => setSelectedSecretForEdit(sec)}
              onDeleteSecret={(sec) => setSelectedSecretForDelete(sec)}
            />
          )}

          {activeTab === 'requests' && (
            <AccessRequestsView
              requests={requests}
              onNavigate={setCurrentTab}
            />
          )}

          {activeTab === 'queue' && (
            <ApprovalQueueView
              queue={queue}
              onActionComplete={() => {
                showToast('Request reviewed successfully.');
                refreshData();
              }}
            />
          )}

          {activeTab === 'active-access' && (
            <MyActiveAccessView
              activeGrants={activeGrants}
              onRevealSecret={handleRevealSecret}
              onGrantRevoked={() => {
                showToast('Temporary grant revoked.');
                refreshData();
              }}
              onNavigate={setCurrentTab}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogsView logs={auditLogs} stats={auditStats} />
          )}

          {activeTab === 'members' && (
            <TeamMembersView
              members={members}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Modals */}
      <CreateSecretModal
        isOpen={isCreateSecretModalOpen}
        onClose={() => setIsCreateSecretModalOpen(false)}
        onSecretCreated={() => {
          showToast('Secret created and stored with AES-256-GCM encryption.');
          refreshData();
        }}
      />

      <SecretDetailsModal
        isOpen={Boolean(selectedSecretForDetails)}
        secret={selectedSecretForDetails}
        onClose={() => setSelectedSecretForDetails(null)}
        onRequestAccess={(sec) => setSelectedSecretForRequest(sec)}
        onRevealSecret={handleRevealSecret}
      />

      <RequestAccessModal
        isOpen={Boolean(selectedSecretForRequest)}
        secret={selectedSecretForRequest}
        onClose={() => setSelectedSecretForRequest(null)}
        onRequestSubmitted={() => {
          showToast(
            'Access request submitted for review.',
          );
          refreshData();
          setCurrentTab('requests');
        }}
      />

      <RevealModal
        isOpen={revealModalData.isOpen}
        onClose={() =>
          setRevealModalData((prev) => ({ ...prev, isOpen: false }))
        }
        secretName={revealModalData.secretName}
        plaintext={revealModalData.plaintext}
        resourceType={revealModalData.resourceType}
        credentialBreakdown={revealModalData.credentialBreakdown}
      />

      <EditSecretModal
        isOpen={Boolean(selectedSecretForEdit)}
        secret={selectedSecretForEdit}
        onClose={() => setSelectedSecretForEdit(null)}
        onSecretUpdated={() => {
          showToast('Secret updated successfully.');
          void refreshData();
        }}
      />

      <DeleteSecretModal
        isOpen={Boolean(selectedSecretForDelete)}
        secret={selectedSecretForDelete}
        onClose={() => setSelectedSecretForDelete(null)}
        onSecretDeleted={() => {
          showToast('Secret permanently deleted and all active grants revoked.');
          void refreshData();
        }}
      />

      <SessionLockModal />
    </div>
  );
}

export default function SentrySafeApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <VaultAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

