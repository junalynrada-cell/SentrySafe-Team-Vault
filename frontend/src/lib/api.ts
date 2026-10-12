const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface User {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  avatar_url?: string;
  status?: string;
  totp_enabled?: boolean;
}

export interface OrganizationMembership {
  org_id: string;
  org_name: string;
  role: 'ADMIN' | 'APPROVER' | 'DEVELOPER' | 'AUDITOR' | null;
  status?: 'ACTIVE' | 'PENDING' | 'REMOVED' | 'SUSPENDED';
}

export interface AuthContextResponse {
  user: User;
  membership: OrganizationMembership;
  session: {
    id: string;
    expires_at: string;
    is_locked: boolean;
    last_activity_at?: string;
  };
}

export interface LoginResponse {
  requiresTwoFactor: boolean;
  requiresEnrollment?: boolean;
  email: string;
}

export interface TotpEnrollResponse {
  qrCodeUrl: string;
  manualKey: string;
  email: string;
}

export interface VerifyEnrollmentResponse {
  backupCodes: string[];
}

export interface SecretItem {
  id: string;
  name: string;
  description: string;
  resource_type: string;
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  owner_team: string;
  requires_approval: boolean;
  access_level: string;
  tags: string[];
  masked_preview: string;
  last_rotated_at: string;
  created_at: string;
  has_active_grant?: boolean;
  active_grant_id?: string;
  grant_expires_at?: string;
}

export interface ActiveGrant {
  id: string;
  request_id: string;
  secret_id: string;
  secret_name: string;
  resource_type: string;
  environment: string;
  owner_team: string;
  masked_preview: string;
  granted_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  revealed_count: number;
  seconds_remaining: number;
  granted_duration_minutes: number;
  user_email?: string;
  user_name?: string;
}

export interface AccessRequest {
  id: string;
  secret_id: string;
  secret_name: string;
  resource_type: string;
  environment: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  reviewer_id?: string;
  reviewer_name?: string;
  requested_duration_minutes: number;
  business_reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  status: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'APPROVER' | 'DEVELOPER' | 'AUDITOR' | null;
  status: 'ACTIVE' | 'PENDING' | 'REMOVED' | 'SUSPENDED';
  joined_at: string;
  removed_at?: string | null;
  active_grants_count: number;
}

export interface DashboardStats {
  metrics: {
    total_secrets: number;
    pending_requests: number;
    active_grants_count: number;
    members_count?: number;
    my_requests_count?: number;
    secrets_encrypted: number;
    encryption_standard?: string;
    zero_trust_policy?: string;
    total_audit_events?: number;
    denied_events?: number;
    secret_reveals?: number;
    auto_expired_count?: number;
  };
  user_active_grants: ActiveGrant[];
  recent_activity: AuditLog[];
  recent_secrets: SecretItem[];
  pending_queue?: Array<{
    id: string;
    secret_id: string;
    secret_name: string;
    environment: string;
    resource_type: string;
    requester_name: string;
    requester_email: string;
    business_reason: string;
    requested_duration_minutes: number;
    created_at: string;
  }>;
  my_recent_requests?: Array<{
    id: string;
    secret_name: string;
    environment: string;
    status: string;
    created_at: string;
    requested_duration_minutes: number;
    business_reason: string;
  }>;
  team_roster_summary?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: 'ADMIN' | 'APPROVER' | 'DEVELOPER' | 'AUDITOR';
    status: string;
    joined_at: string;
  }>;
}

let onUnauthorizedCallback: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorizedCallback = cb;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensures HTTP-only cookies are automatically sent & set
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/verify-2fa') &&
      !endpoint.startsWith('/auth/2fa') &&
      !endpoint.startsWith('/auth/signup')
    ) {
      onUnauthorizedCallback?.();
    }

    let errorMsg = 'An error occurred';
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || response.statusText;
    } catch {
      errorMsg = response.statusText;
    }
    const err = new Error(errorMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  // Handle 204 No Content — no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  auth: {
    signup: (name: string, email: string, password: string) =>
      request<{
        success: boolean;
        message: string;
        requiresEnrollment: boolean;
        user: User;
        status: string;
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    verify2fa: (code?: string, backupCode?: string) =>
      request<AuthContextResponse>('/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ code, backupCode }),
      }),
    enroll2fa: () =>
      request<TotpEnrollResponse>('/auth/2fa/enroll', {
        method: 'POST',
      }),
    verifyEnrollment: (code: string) =>
      request<VerifyEnrollmentResponse>('/auth/2fa/enroll/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    completeEnrollment: () =>
      request<AuthContextResponse>('/auth/2fa/enroll/complete', {
        method: 'POST',
      }),
    me: () => request<AuthContextResponse>('/auth/me'),
    logout: () =>
      request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    lock: () =>
      request<{ success: boolean }>('/auth/lock', { method: 'POST' }),
    unlock: (password: string) =>
      request<{ success: boolean; user?: User; membership?: OrganizationMembership }>('/auth/unlock', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
  },
  dashboard: {
    getStats: () => request<DashboardStats>('/dashboard/stats'),
  },
  secrets: {
    list: () => request<SecretItem[]>('/secrets'),
    get: (id: string) => request<SecretItem>(`/secrets/${id}`),
    reveal: (id: string) =>
      request<{
        id: string;
        name: string;
        plaintext: string;
        resource_type: string;
        revealed_at: string;
        credential_breakdown?: {
          host: string;
          port: string;
          database: string;
          username: string;
          password: string;
        };
      }>(`/secrets/${id}/reveal`, { method: 'POST' }),
    create: (data: {
      name: string;
      description?: string;
      resource_type: string;
      environment: string;
      owner_team: string;
      plaintext_value: string;
      requires_approval?: boolean;
      access_level?: string;
      tags?: string[];
    }) =>
      request<SecretItem>('/secrets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        description?: string;
        resource_type?: string;
        environment?: string;
        owner_team?: string;
        requires_approval?: boolean;
        access_level?: string;
        tags?: string[];
        /** If provided, replaces the encrypted secret value. Leave empty to preserve existing. */
        plaintext_value?: string;
      },
    ) =>
      request<SecretItem>(`/secrets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/secrets/${id}`, {
        method: 'DELETE',
      }),
  },
  requests: {
    list: (status?: string) =>
      request<AccessRequest[]>(`/requests${status ? `?status=${status}` : ''}`),
    getQueue: () => request<AccessRequest[]>('/requests/queue'),
    create: (data: {
      secret_id: string;
      requested_duration_minutes: number;
      business_reason: string;
    }) =>
      request<AccessRequest>('/requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    approve: (id: string, notes?: string) =>
      request<{ success: boolean; grant_id: string; expires_at: string }>(
        `/requests/${id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ notes }),
        },
      ),
    reject: (id: string, notes?: string) =>
      request<{ success: boolean }>(`/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
  },
  grants: {
    getActive: () => request<ActiveGrant[]>('/grants/active'),
    getOrgActive: () => request<ActiveGrant[]>('/grants/org/active'),
    revoke: (id: string, reason?: string) =>
      request<{ success: boolean }>(`/grants/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
  audit: {
    getLogs: (params?: { action?: string; actor?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.action) q.set('action', params.action);
      if (params?.actor) q.set('actor', params.actor);
      if (params?.limit) q.set('limit', params.limit.toString());
      if (params?.offset) q.set('offset', params.offset.toString());
      const queryStr = q.toString();
      return request<{
        stats: {
          total_events: number;
          denied_events: number;
          admin_overrides: number;
          auto_expired_count: number;
          secret_reveals: number;
        };
        logs: AuditLog[];
      }>(`/audit-logs${queryStr ? `?${queryStr}` : ''}`);
    },
  },
  members: {
    list: () => request<TeamMember[]>('/members'),
    approve: (id: string, role: string) =>
      request<{ success: boolean; memberId: string; role: string; status: string }>(`/members/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    restore: (id: string, role: string) =>
      request<{ success: boolean; memberId: string; role: string; status: string }>(`/members/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    updateRole: (id: string, role: string) =>
      request<{ success: boolean; updatedRole: string }>(`/members/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/members/${id}`, {
        method: 'DELETE',
      }),
  },
};
