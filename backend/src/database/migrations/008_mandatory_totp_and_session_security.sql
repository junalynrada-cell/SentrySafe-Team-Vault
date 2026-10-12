-- Migration 008: Mandatory RFC 6238 TOTP 2FA, Backup Codes, Pre-Auth Sessions, & Session Security
-- Integrates multi-factor authentication, backup recovery codes, 5-minute pre-authentication state,
-- and strict session timeout auditing into SentrySafe Team Vault.

-- 1. Add TOTP columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ NULL;

-- 2. Create backup_codes table for recovery
CREATE TABLE IF NOT EXISTS backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS backup_codes_user_idx ON backup_codes(user_id);
CREATE INDEX IF NOT EXISTS backup_codes_hash_idx ON backup_codes(code_hash, used_at);

-- 3. Create pre_auth_sessions table for 5-minute pre-authentication state
CREATE TABLE IF NOT EXISTS pre_auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pre_auth_lookup_idx ON pre_auth_sessions(token_hash, consumed_at, expires_at);
CREATE INDEX IF NOT EXISTS pre_auth_user_idx ON pre_auth_sessions(user_id);

-- 4. Enable Row Level Security (RLS) on new tables for defense-in-depth
ALTER TABLE backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_auth_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Extend audit_logs action CHECK constraint for authentication & 2FA lifecycle events
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'LOGIN', 'LOGOUT', 'SESSION_LOCK', 'REAUTHENTICATE',
    'ACCESS_REQUEST', 'ACCESS_APPROVED', 'ACCESS_REJECTED', 'ACCESS_GRANTED',
    'SECRET_REVEALED', 'CREDENTIAL_COPIED', 'ACCESS_EXPIRED', 'ACCESS_REVOKED',
    'PERMISSION_CHANGED', 'MEMBER_REMOVED', 'DENIED_ACCESS',
    'SECRET_CREATED', 'SECRET_UPDATED', 'SECRET_DELETED',
    'ADMIN_SECRET_ACCESS',
    'SIGNUP', 'MEMBER_APPROVED', 'MEMBER_RESTORED',
    'TOTP_ENROLLMENT_STARTED', 'TOTP_ENROLLMENT_COMPLETED',
    'TOTP_VERIFICATION_SUCCESS', 'TOTP_VERIFICATION_FAILED',
    'BACKUP_CODE_USED', 'PRE_AUTH_EXPIRED',
    'SESSION_CREATED', 'SESSION_EXPIRED', 'SESSION_IDLE_TIMEOUT'
  ));
