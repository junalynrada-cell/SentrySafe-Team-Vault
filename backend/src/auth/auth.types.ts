export type UserRole = 'ADMIN' | 'DEVELOPER' | 'APPROVER' | 'AUDITOR';

export interface SafeUser {
  id: string;
  email: string;
  full_name: string;
  name?: string;
  is_active: boolean;
  totp_enabled?: boolean;
}

export interface OrganizationMembership {
  id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: UserRole | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | 'PENDING';
  removed_at?: string | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  session_token_hash: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  is_locked: boolean;
  is_revoked: boolean;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuthContext {
  user: SafeUser;
  session: SessionRecord;
  membership: OrganizationMembership;
}

export interface PreAuthSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  failed_attempts: number;
}

export interface PreAuthContext {
  preAuthSession: PreAuthSessionRecord;
  user: SafeUser;
  membership: OrganizationMembership;
  rawToken: string;
}
