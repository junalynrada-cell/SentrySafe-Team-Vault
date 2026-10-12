'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  User,
  OrganizationMembership,
  LoginResponse,
  TotpEnrollResponse,
  VerifyEnrollmentResponse,
  setOnUnauthorized,
} from '../lib/api';

interface AuthState {
  user: User | null;
  membership: OrganizationMembership | null;
  isLocked: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verify2fa: (code?: string, backupCode?: string) => Promise<void>;
  enroll2fa: () => Promise<TotpEnrollResponse>;
  verifyEnrollment: (code: string) => Promise<VerifyEnrollmentResponse>;
  completeEnrollment: () => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ status: string; message: string; requiresEnrollment: boolean }>;
  logout: () => Promise<void>;
  lockSession: () => Promise<void>;
  unlockSession: (password: string) => Promise<boolean>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<OrganizationMembership | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Clear authenticated state immediately on 401 session expiration
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setMembership(null);
      setIsLocked(false);
    });
    return () => {
      setOnUnauthorized(null);
    };
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
      setMembership(data.membership);
      setIsLocked(data.session.is_locked);
    } catch {
      // No active session — leave user null so the app shows the login screen
      setUser(null);
      setMembership(null);
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      try {
        const data = await api.auth.me();
        if (active) {
          setUser(data.user);
          setMembership(data.membership);
          setIsLocked(data.session.is_locked);
        }
      } catch {
        // No active session — user must log in
        if (active) {
          setUser(null);
          setMembership(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void initAuth();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    return api.auth.login(email, password);
  };

  const verify2fa = async (code?: string, backupCode?: string) => {
    const data = await api.auth.verify2fa(code, backupCode);
    setUser(data.user);
    setMembership(data.membership);
    setIsLocked(data.session.is_locked);
  };

  const enroll2fa = async (): Promise<TotpEnrollResponse> => {
    return api.auth.enroll2fa();
  };

  const verifyEnrollment = async (code: string): Promise<VerifyEnrollmentResponse> => {
    return api.auth.verifyEnrollment(code);
  };

  const completeEnrollment = async () => {
    const data = await api.auth.completeEnrollment();
    setUser(data.user);
    setMembership(data.membership);
    setIsLocked(data.session.is_locked);
  };

  const signup = async (name: string, email: string, password: string) => {
    const result = await api.auth.signup(name, email, password);
    return {
      status: result.status,
      message: result.message,
      requiresEnrollment: result.requiresEnrollment,
    };
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore
    } finally {
      setUser(null);
      setMembership(null);
      setIsLocked(false);
    }
  };

  const lockSession = async () => {
    try {
      await api.auth.lock();
      setIsLocked(true);
    } catch (e) {
      console.error('Failed to lock session', e);
    }
  };

  const unlockSession = async (password: string) => {
    try {
      const res = await api.auth.unlock(password);
      if (res.user) {
        setUser(res.user);
      }
      if (res.membership) {
        setMembership(res.membership);
      }
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        membership,
        isLocked,
        isLoading,
        login,
        verify2fa,
        enroll2fa,
        verifyEnrollment,
        completeEnrollment,
        signup,
        logout,
        lockSession,
        unlockSession,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
