-- Migration 004: PostgREST Hardening & Row Level Security
-- Enables RLS on all tables to prevent direct access via Supabase's client-facing REST API (anon/authenticated roles)
-- The NestJS backend connects as the postgres superuser role, which bypasses RLS.

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
