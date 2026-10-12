-- Migration 001: Initial Schema for SentrySafe Team Vault
-- PostgreSQL 17 on Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- 3. Organization Memberships (RBAC)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('DEVELOPER', 'APPROVER', 'ADMINISTRATOR', 'AUDITOR')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REMOVED')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT org_members_unique UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);

-- 4. Sessions (Zero-Trust Session Management)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL
);
CREATE INDEX IF NOT EXISTS sessions_lookup_idx ON sessions(session_token_hash, is_revoked, is_locked);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- 5. Secrets (Encrypted Vault at Rest)
CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('DATABASE_CREDENTIAL', 'API_KEY', 'SERVICE_TOKEN', 'CLOUD_CREDENTIAL')),
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('PRODUCTION', 'STAGING', 'DEVELOPMENT')),
    owner_team VARCHAR(100) NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('RESTRICTED', 'CONFIDENTIAL')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    last_rotated_at TIMESTAMPTZ NULL,
    encrypted_value TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    masked_preview VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS secrets_org_idx ON secrets(org_id);
CREATE INDEX IF NOT EXISTS secrets_env_type_idx ON secrets(org_id, environment, resource_type);

-- 6. Access Requests (Just-in-Time Access Workflow)
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id),
    business_reason TEXT NOT NULL,
    requested_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (requested_duration_minutes > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED')),
    reviewed_by UUID NULL REFERENCES users(id),
    reviewed_at TIMESTAMPTZ NULL,
    reviewer_note TEXT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status, valid_until);
CREATE INDEX IF NOT EXISTS access_requests_requester_idx ON access_requests(requester_id, org_id);
CREATE INDEX IF NOT EXISTS access_requests_secret_idx ON access_requests(secret_id);

-- 7. Temporary Grants (Synchronous Time-Bound Access)
CREATE TABLE IF NOT EXISTS temporary_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL UNIQUE REFERENCES access_requests(id) ON DELETE CASCADE,
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    revoked_at TIMESTAMPTZ NULL,
    revoked_by UUID NULL REFERENCES users(id),
    revocation_reason TEXT NULL,
    revealed_count INTEGER NOT NULL DEFAULT 0,
    last_revealed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS grants_active_lookup_idx ON temporary_grants(user_id, secret_id, status, expires_at);
CREATE INDEX IF NOT EXISTS grants_expiry_scan_idx ON temporary_grants(status, expires_at);

-- 8. Audit Logs (Append-Only System Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES users(id),
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'LOGIN', 'LOGOUT', 'SESSION_LOCK', 'REAUTHENTICATE',
        'ACCESS_REQUEST', 'ACCESS_APPROVED', 'ACCESS_REJECTED', 'ACCESS_GRANTED',
        'SECRET_REVEALED', 'CREDENTIAL_COPIED', 'ACCESS_EXPIRED', 'ACCESS_REVOKED',
        'PERMISSION_CHANGED', 'MEMBER_REMOVED', 'DENIED_ACCESS', 'SECRET_CREATED',
        'ADMIN_SECRET_ACCESS'
    )),
    resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('SECRET', 'ACCESS_REQUEST', 'TEMPORARY_GRANT', 'USER', 'ORGANIZATION', 'SESSION')),
    resource_id VARCHAR(100) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'DENIED', 'FAILURE', 'AUTOMATIC')),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_org_time_idx ON audit_logs(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_actor_time_idx ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_action_time_idx ON audit_logs(action, timestamp DESC);
