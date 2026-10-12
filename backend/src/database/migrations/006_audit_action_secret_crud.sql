-- Migration 006: Extend audit_logs action CHECK constraint for Secret CRUD
-- Adds SECRET_UPDATED and SECRET_DELETED to the allowed action values.
-- Without this, inserting these audit events would fail with a PostgreSQL
-- constraint violation (check violation on column "action").
--
-- Safe: no data is modified or dropped. Idempotent when re-run.

-- 1. Drop the existing action check constraint
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- 2. Recreate with SECRET_UPDATED and SECRET_DELETED included
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'LOGIN', 'LOGOUT', 'SESSION_LOCK', 'REAUTHENTICATE',
    'ACCESS_REQUEST', 'ACCESS_APPROVED', 'ACCESS_REJECTED', 'ACCESS_GRANTED',
    'SECRET_REVEALED', 'CREDENTIAL_COPIED', 'ACCESS_EXPIRED', 'ACCESS_REVOKED',
    'PERMISSION_CHANGED', 'MEMBER_REMOVED', 'DENIED_ACCESS',
    'SECRET_CREATED', 'SECRET_UPDATED', 'SECRET_DELETED',
    'ADMIN_SECRET_ACCESS'
  ));
