-- Migration 002: Audit Log Immutability Triggers (REQ-007)
-- Prohibits UPDATE and DELETE operations against the audit_logs table

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are strictly immutable. UPDATE and DELETE operations are prohibited (REQ-007 / Security Policy).'
        USING ERRCODE = '55000'; -- object_not_modifiable
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist to allow clean idempotent re-runs
DROP TRIGGER IF EXISTS audit_logs_immutable_update ON audit_logs;
DROP TRIGGER IF EXISTS audit_logs_immutable_delete ON audit_logs;

-- Enforce append-only on UPDATE
CREATE TRIGGER audit_logs_immutable_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- Enforce append-only on DELETE
CREATE TRIGGER audit_logs_immutable_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
