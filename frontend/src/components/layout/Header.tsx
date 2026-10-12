'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Search,
  LogOut,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileNav?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileNav,
  searchTerm = '',
  onSearchChange,
}) => {
  const { user, membership, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
      case 'APPROVER':
        return 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'DEVELOPER':
        return 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
      case 'AUDITOR':
        return 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      default:
        return 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 border-slate-200 dark:border-zinc-700';
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0 select-none">
      {/* Left: Mobile Menu Button */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 -ml-1 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open mobile navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Global Search & Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {onSearchChange && (
          <div className="relative hidden md:block w-48 lg:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search secrets, requests..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {/* User Identity Context Pill */}
        {user && membership && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-zinc-800">
            {(() => {
              const displayName =
                user.name || user.full_name || user.email || 'User';
              const initials =
                displayName
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'U';

              return (
                <>
                  <div
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-zinc-200 shrink-0"
                    title={`${displayName} (${membership.role})`}
                  >
                    {initials}
                  </div>

                  <div className="hidden xl:block text-left">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 leading-tight max-w-[120px] truncate">
                      {displayName}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${getRoleBadgeStyle(
                          membership.role ?? undefined,
                        )}`}
                      >
                        {membership.role ?? '—'}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

