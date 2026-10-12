-- Migration 005: Canonical ADMIN Role Migration
-- Updates organization_members role check constraint and existing rows to the canonical ADMIN role.
-- Conforms strictly to the 4 canonical roles: ADMIN, DEVELOPER, APPROVER, AUDITOR.

-- 1. Drop existing role check constraint
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- 2. Update existing rows from ADMINISTRATOR to ADMIN
UPDATE organization_members 
  SET role = 'ADMIN' 
  WHERE role = 'ADMINISTRATOR';

-- 3. Re-add check constraint with exactly the four canonical roles:
ALTER TABLE organization_members 
  ADD CONSTRAINT organization_members_role_check 
  CHECK (role IN ('ADMIN', 'DEVELOPER', 'APPROVER', 'AUDITOR'));
