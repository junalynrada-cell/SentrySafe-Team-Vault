-- Migration 003: Seed Demo Data for SentrySafe Team Vault
-- Populates demo organization, users with Argon2id passwords (Password123!), and encrypted sample secrets

DO $$
DECLARE
    v_org_id UUID;
    v_admin_id UUID;
    v_approver_id UUID;
    v_developer_id UUID;
    v_auditor_id UUID;
    v_secret_db_id UUID;
    v_secret_stripe_id UUID;
    v_secret_aws_id UUID;
    v_password_hash TEXT := '$argon2id$v=19$m=65536,p=4,t=3$v5EGskI8pUZYtxzkSauJLA$5m3JgpW8NqZYhegUTGazFlUvg5lzWaIoO9H2MSNCt1w';
BEGIN
    -- 1. Create or Get Organization
    INSERT INTO organizations (name, slug)
    VALUES ('Acme Corp DevSecOps', 'acme-corp')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_org_id;

    -- 2. Create Demo Users (Password: Password123!)
    INSERT INTO users (email, password_hash, full_name, is_active)
    VALUES ('admin@sentrysafe.io', v_password_hash, 'Alice Administrator', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id INTO v_admin_id;

    INSERT INTO users (email, password_hash, full_name, is_active)
    VALUES ('approver@sentrysafe.io', v_password_hash, 'Bob Approver', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id INTO v_approver_id;

    INSERT INTO users (email, password_hash, full_name, is_active)
    VALUES ('developer@sentrysafe.io', v_password_hash, 'Charlie Developer', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id INTO v_developer_id;

    INSERT INTO users (email, password_hash, full_name, is_active)
    VALUES ('auditor@sentrysafe.io', v_password_hash, 'Dana Auditor', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id INTO v_auditor_id;

    -- 3. Create Organization Memberships
    INSERT INTO organization_members (org_id, user_id, role, status)
    VALUES 
        (v_org_id, v_admin_id, 'ADMINISTRATOR', 'ACTIVE'),
        (v_org_id, v_approver_id, 'APPROVER', 'ACTIVE'),
        (v_org_id, v_developer_id, 'DEVELOPER', 'ACTIVE'),
        (v_org_id, v_auditor_id, 'AUDITOR', 'ACTIVE')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE';

    -- 4. Create Initial Secrets (AES-256-GCM Encrypted at Rest)
    -- Secret 1: Production Postgres Database
    INSERT INTO secrets (
        org_id, name, description, resource_type, environment, owner_team,
        requires_approval, access_level, tags,
        encrypted_value, encryption_iv, auth_tag, masked_preview, created_by
    ) VALUES (
        v_org_id,
        'PROD_POSTGRES_MASTER',
        'Primary PostgreSQL master database credentials for production cluster',
        'DATABASE_CREDENTIAL',
        'PRODUCTION',
        'Core Infrastructure',
        TRUE,
        'RESTRICTED',
        ARRAY['database', 'postgres', 'production', 'tier-1'],
        'H2hRjMxcj2zWYKbxeMYEYWCT8hHFXw2TlDn1TgyDjOfaSOJgd2pcUrbw4WLSevYqk5Acv19pqie2T+Ks9+voeP6H4WYX',
        'QY0qGUJ80dxKn3/H',
        'I3ZDdl3dYv1qgyGdoK4Z8Q==',
        'postgres://superadmin:••••••••••••@prod-db.internal:5432/core_vault',
        v_admin_id
    ) RETURNING id INTO v_secret_db_id;

    -- Secret 2: Stripe Production API Key
    INSERT INTO secrets (
        org_id, name, description, resource_type, environment, owner_team,
        requires_approval, access_level, tags,
        encrypted_value, encryption_iv, auth_tag, masked_preview, created_by
    ) VALUES (
        v_org_id,
        'STRIPE_LIVE_KEY',
        'Stripe billing and payments live production API secret key',
        'API_KEY',
        'PRODUCTION',
        'Billing & Monetization',
        TRUE,
        'CONFIDENTIAL',
        ARRAY['stripe', 'payments', 'production'],
        '9hsuoQCJWgGdnoBwa8S6E6yISbv7bUG2T674rcylXfqrt1lBWDJ8t6hha3UGg0c=',
        'H/AfFDvuYkxJKShF',
        'PmdWI4AHZyTzKl2ZaBXlng==',
        'sk_live_51M00••••••••••••XYZ',
        v_admin_id
    ) RETURNING id INTO v_secret_stripe_id;

    -- Secret 3: AWS Production Deployer Role
    INSERT INTO secrets (
        org_id, name, description, resource_type, environment, owner_team,
        requires_approval, access_level, tags,
        encrypted_value, encryption_iv, auth_tag, masked_preview, created_by
    ) VALUES (
        v_org_id,
        'AWS_PROD_DEPLOYER',
        'IAM deployer access key for production Kubernetes cluster deployments',
        'CLOUD_CREDENTIAL',
        'PRODUCTION',
        'DevOps Engineering',
        TRUE,
        'RESTRICTED',
        ARRAY['aws', 'iam', 'production', 'k8s'],
        'hOmjMbb5lapgpwkak7+JqzdrUMUDbn0e5mzD4os9OSKbqOifbL9mLrdHfo+WNK1nSkkt5gMavPYKgFgpVw==',
        'WCoxA8UBuSEMtNSo',
        'zQXQW7iCMBfCnFkLzdq8xg==',
        'AKIAIOSFODNN••••••••••••KEY',
        v_admin_id
    ) RETURNING id INTO v_secret_aws_id;

    -- 5. Seed Audit Log for Initialization Events
    INSERT INTO audit_logs (
        org_id, actor_id, actor_email, actor_role, action,
        resource_type, resource_id, resource_name, status, details
    ) VALUES
    (
        v_org_id, v_admin_id, 'admin@sentrysafe.io', 'ADMINISTRATOR',
        'SECRET_CREATED', 'SECRET', v_secret_db_id::TEXT, 'PROD_POSTGRES_MASTER',
        'SUCCESS', '{"environment": "PRODUCTION", "resource_type": "DATABASE_CREDENTIAL"}'::JSONB
    ),
    (
        v_org_id, v_admin_id, 'admin@sentrysafe.io', 'ADMINISTRATOR',
        'SECRET_CREATED', 'SECRET', v_secret_stripe_id::TEXT, 'STRIPE_LIVE_KEY',
        'SUCCESS', '{"environment": "PRODUCTION", "resource_type": "API_KEY"}'::JSONB
    ),
    (
        v_org_id, v_admin_id, 'admin@sentrysafe.io', 'ADMINISTRATOR',
        'SECRET_CREATED', 'SECRET', v_secret_aws_id::TEXT, 'AWS_PROD_DEPLOYER',
        'SUCCESS', '{"environment": "PRODUCTION", "resource_type": "CLOUD_CREDENTIAL"}'::JSONB
    );

END $$;
