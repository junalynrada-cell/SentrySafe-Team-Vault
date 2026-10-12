'use client';

import React, { useState, useMemo } from 'react';
import { SecretItem } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  Shield,
  Clock,
  Eye,
  Lock,
  Search,
  Database,
  Cloud,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

interface SecretsVaultViewProps {
  secrets: SecretItem[];
  onRequestAccess: (secret: SecretItem) => void;
  onRevealSecret: (secretId: string, secretName: string) => void;
  onViewDetails: (secret: SecretItem) => void;
  onOpenCreateSecret?: () => void;
  /** ADMIN only: open Edit modal for the given secret */
  onEditSecret?: (secret: SecretItem) => void;
  /** ADMIN only: open Delete confirmation for the given secret */
  onDeleteSecret?: (secret: SecretItem) => void;
}

export const SecretsVaultView: React.FC<SecretsVaultViewProps> = ({
  secrets,
  onRequestAccess,
  onRevealSecret,
  onViewDetails,
  onOpenCreateSecret,
  onEditSecret,
  onDeleteSecret,
}) => {
  const { membership } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredSecrets = useMemo(() => {
    return secrets.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.owner_team.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEnv =
        selectedEnv === 'ALL' || s.environment.toUpperCase() === selectedEnv;
      const matchesType =
        selectedType === 'ALL' || s.resource_type.toUpperCase() === selectedType;

      return matchesSearch && matchesEnv && matchesType;
    });
  }, [secrets, searchTerm, selectedEnv, selectedType]);

  const getResourceTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'DATABASE':
        return <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'CLOUD':
      case 'INFRASTRUCTURE':
        return <Cloud className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      default:
        return <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env.toUpperCase()) {
      case 'PRODUCTION':
        return 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'STAGING':
        return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      default:
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Secrets Vault
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Encrypted organizational credentials under continuous Zero-Trust access control.
          </p>
        </div>

        {/* Admin Create Secret button and status notice */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {membership?.role === 'ADMIN' && onOpenCreateSecret && (
            <button
              onClick={onOpenCreateSecret}
              className="min-h-[40px] px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Secret</span>
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="truncate">AES-256-GCM Hardware Encrypted</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search secrets by name, team, description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors min-h-[40px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Environment Filter */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl">
            {['ALL', 'PRODUCTION', 'STAGING'].map((env) => (
              <button
                key={env}
                onClick={() => setSelectedEnv(env)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all min-h-[32px] ${
                  selectedEnv === env
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-transparent'
                    : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300'
                }`}
              >
                {env === 'ALL' ? 'All Envs' : env}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl">
            {['ALL', 'DATABASE', 'API_KEY'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all min-h-[32px] ${
                  selectedType === type
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-transparent'
                    : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Secrets Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {filteredSecrets.map((secret) => {
          const hasGrant = secret.has_active_grant;
          const isAdmin = membership?.role === 'ADMIN';

          return (
            <div
              key={secret.id}
              className={`bg-white dark:bg-zinc-900/60 border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm ${
                hasGrant
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/10 dark:shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700/80'
              }`}
            >
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center shrink-0">
                      {getResourceTypeIcon(secret.resource_type)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {secret.name}
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate block">
                        {secret.owner_team}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium shrink-0 ${getEnvBadge(
                      secret.environment,
                    )}`}
                  >
                    {secret.environment}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 min-h-[32px]">
                  {secret.description || 'Enterprise production resource credential.'}
                </p>

                {/* Masked Preview Block */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 font-medium">
                    <span>Masked Value</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500">
                      <Lock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                      Encrypted
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-700 dark:text-zinc-400 tracking-wider truncate">
                    {secret.masked_preview}
                  </div>
                </div>

                {/* Access Status pill */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-500">Access Status:</span>
                  {hasGrant ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE TEMPORARY ACCESS
                    </span>
                  ) : isAdmin ? (
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium text-[11px]">
                      <Shield className="w-3.5 h-3.5" /> Admin Entitled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
                      <Lock className="w-3.5 h-3.5" /> Standing Access: None
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-zinc-800/80 space-y-2">
                {/* Row 1: View Details + Reveal/Request */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                  <button
                    onClick={() => onViewDetails(secret)}
                    className="min-h-[38px] px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/70 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-xl text-xs font-medium transition-colors"
                  >
                    View Details
                  </button>

                  {hasGrant || isAdmin ? (
                    <button
                      onClick={() => onRevealSecret(secret.id, secret.name)}
                      className="min-h-[38px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal Secret</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onRequestAccess(secret)}
                      className="min-h-[38px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Request Access</span>
                    </button>
                  )}
                </div>

                {/* Row 2: Admin-only Edit + Delete — never shown to non-ADMIN */}
                {isAdmin && onEditSecret && onDeleteSecret && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditSecret(secret)}
                      className="flex-1 min-h-[36px] px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      aria-label={`Edit secret ${secret.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteSecret(secret)}
                      className="flex-1 min-h-[36px] px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      aria-label={`Delete secret ${secret.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
