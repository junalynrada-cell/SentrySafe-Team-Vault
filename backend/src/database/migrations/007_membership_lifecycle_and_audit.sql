-- Migration 007: Membership Lifecycle & Audit Actions for Onboarding
-- Enables PENDING membership with NULL role (displayed as UNASSIGNED in UI)
-- Adds removed_at timestamp column for tracking removed members
-- Extends audit_logs action CHECK constraint for SIGNUP, MEMBER_APPROVED, MEMBER_RESTORED

-- 1. Allow organization_members.role to be NULL for PENDING members
ALTER TABLE organization_members
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IS NULL OR role IN ('ADMIN', 'DEVELOPER', 'APPROVER', 'AUDITOR'));

-- 2. Allow 'PENDING' status in organization_members.status
ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_status_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_status_check
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REMOVED', 'PENDING'));

-- 3. Add removed_at column if not exists
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;

-- 4. Recreate audit_logs_action_check to support SIGNUP, MEMBER_APPROVED, MEMBER_RESTORED
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
    'SIGNUP', 'MEMBER_APPROVED', 'MEMBER_RESTORED'
  ));
