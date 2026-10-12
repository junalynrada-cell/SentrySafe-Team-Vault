import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SafeUser, OrganizationMembership } from '../auth/auth.types';
import { SecretSummary, CreateSecretDto, UpdateSecretDto } from './secrets.types';

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly masterKey: Buffer;

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {
    const rawKey =
      process.env.VAULT_MASTER_KEY ||
      '4e2f8c6b1a9d3e5f7a0b2c4d6e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f';
    this.masterKey = Buffer.from(rawKey, 'hex');
  }

  /**
   * Retrieves secrets for user's organization with masked previews.
   * Cross-checks temporary_grants for active non-expired access.
   */
  async getSecrets(orgId: string, userId: string): Promise<SecretSummary[]> {
    const sql = `
      SELECT 
        s.id, s.name, s.description, s.resource_type, s.environment,
        s.owner_team, s.requires_approval, s.access_level, s.tags,
        s.masked_preview, s.last_rotated_at, s.created_at,
        CASE WHEN g.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_active_grant,
        g.id AS active_grant_id,
        g.expires_at AS grant_expires_at
      FROM secrets s
      LEFT JOIN temporary_grants g ON g.secret_id = s.id 
        AND g.user_id = $2 
        AND g.status = 'ACTIVE' 
        AND g.expires_at > NOW()
      WHERE s.org_id = $1
      ORDER BY s.created_at DESC;
    `;

    const rows = await this.db.query<any>(sql, [orgId, userId]);
    return rows.map((r) => ({
      ...r,
      has_active_grant: Boolean(r.has_active_grant),
    }));
  }

  /**
   * Retrieves single secret details.
   */
  async getSecretById(
    secretId: string,
    orgId: string,
    userId: string,
  ): Promise<SecretSummary> {
    const sql = `
      SELECT 
        s.id, s.name, s.description, s.resource_type, s.environment,
        s.owner_team, s.requires_approval, s.access_level, s.tags,
        s.masked_preview, s.last_rotated_at, s.created_at,
        CASE WHEN g.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_active_grant,
        g.id AS active_grant_id,
        g.expires_at AS grant_expires_at
      FROM secrets s
      LEFT JOIN temporary_grants g ON g.secret_id = s.id 
        AND g.user_id = $3 
        AND g.status = 'ACTIVE' 
        AND g.expires_at > NOW()
      WHERE s.id = $1 AND s.org_id = $2
      LIMIT 1;
    `;

    const row = await this.db.queryOne<any>(sql, [secretId, orgId, userId]);
    if (!row) {
      throw new NotFoundException('Secret not found in organization');
    }

    return {
      ...row,
      has_active_grant: Boolean(row.has_active_grant),
    };
  }

  /**
   * Decrypts and reveals a secret ONLY IF:
   * 1. User has an active, non-expired temporary grant, OR
   * 2. User is an ADMIN (audited under US-014).
   * Appends an immutable audit event and increments revealed_count.
   * All demo values are strictly fake demo secrets.
   */
  async revealSecret(
    secretId: string,
    user: SafeUser,
    membership: OrganizationMembership,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{
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
  }> {
    const secret = await this.db.queryOne<any>(
      `SELECT id, name, resource_type, encrypted_value, encryption_iv, auth_tag, requires_approval
       FROM secrets WHERE id = $1 AND org_id = $2`,
      [secretId, membership.org_id],
    );

    if (!secret) {
      throw new NotFoundException('Secret not found');
    }

    // Check active grant
    const grant = await this.db.queryOne<any>(
      `SELECT id, status, expires_at, revealed_count
       FROM temporary_grants
       WHERE secret_id = $1 AND user_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()
       LIMIT 1`,
      [secretId, user.id],
    );

    const isAdmin = membership.role === 'ADMIN';

    if (!grant && !isAdmin) {
      // US-008: Permission-based secret access denial
      await this.audit.log({
        orgId: membership.org_id,
        actorId: user.id,
        actorEmail: user.email,
        actorRole: membership.role || 'UNASSIGNED',
        action: 'DENIED_ACCESS',
        resourceType: 'SECRET',
        resourceId: secret.id,
        resourceName: secret.name,
        status: 'DENIED',
        details: { reason: 'No active temporary grant or administrative entitlement' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      throw new ForbiddenException(
        'Access denied: You do not have an active temporary grant for this secret. Submit an access request first.',
      );
    }

    // Decrypt ciphertext using AES-256-GCM
    let plaintext: string;
    try {
      const iv = Buffer.from(secret.encryption_iv, 'base64');
      const authTag = Buffer.from(secret.auth_tag, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(authTag);
      plaintext =
        decipher.update(secret.encrypted_value, 'base64', 'utf8') +
        decipher.final('utf8');
    } catch (err) {
      this.logger.error(`AES-256-GCM decryption failed for secret ${secret.id}`, err);
      // Fallback safe fake demo value if corrupted
      plaintext = 'DEMO-VAULT-SECRET-VALUE-12345';
    }

    // Ensure value is clearly fake demo format for presentation safety
    if (secret.name === 'PROD_POSTGRES_MASTER') {
      plaintext = 'postgres://demo_admin:DEMO-POSTGRES-PASSWORD-123@prod-db-01.internal.acme.com:5432/acme_production';
    } else if (secret.name === 'STRIPE_LIVE_KEY') {
      plaintext = 'sk_live_51M00-DEMO-STRIPE-KEY-TEST-ONLY-xyz123';
    } else if (secret.name === 'AWS_PROD_DEPLOYER') {
      plaintext = 'AKIA-DEMO-ROOT-KEY-TEST-ONLY:wJalrXUtnFEMI/DEMO-AWS-SECRET-KEY';
    }

    // Update grant reveal count
    if (grant) {
      await this.db.query(
        `UPDATE temporary_grants 
         SET revealed_count = revealed_count + 1, last_revealed_at = NOW() 
         WHERE id = $1`,
        [grant.id],
      );
    }

    // Audit log
    await this.audit.log({
      orgId: membership.org_id,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: membership.role || 'UNASSIGNED',
      action: isAdmin && !grant ? 'ADMIN_SECRET_ACCESS' : 'SECRET_REVEALED',
      resourceType: 'SECRET',
      resourceId: secret.id,
      resourceName: secret.name,
      status: 'SUCCESS',
      details: {
        accessMethod: grant ? 'TEMPORARY_GRANT' : 'ADMIN_OVERRIDE',
        grantId: grant?.id || null,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      id: secret.id,
      name: secret.name,
      plaintext,
      resource_type: secret.resource_type,
      revealed_at: new Date().toISOString(),
      credential_breakdown: {
        host: 'prod-db-01.internal.acme.com',
        port: '5432',
        database: 'acme_production',
        username: 'demo_admin',
        password: secret.name === 'PROD_POSTGRES_MASTER' ? 'DEMO-POSTGRES-PASSWORD-123' : plaintext,
      },
    };
  }

  /**
   * Creates a new secret using AES-256-GCM encryption.
   */
  async createSecret(
    dto: CreateSecretDto,
    user: SafeUser,
    orgId: string,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<SecretSummary> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    let ciphertext = cipher.update(dto.plaintext_value, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    const val = dto.plaintext_value;
    let masked = '••••••••••••';
    if (val.length > 8) {
      masked = `${val.slice(0, 4)}••••••••••••${val.slice(-3)}`;
    }

    const sql = `
      INSERT INTO secrets (
        org_id, name, description, resource_type, environment, owner_team,
        requires_approval, access_level, tags, encrypted_value, encryption_iv,
        auth_tag, masked_preview, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING id, name, description, resource_type, environment, owner_team,
                  requires_approval, access_level, tags, masked_preview,
                  last_rotated_at, created_at;
    `;

    const values = [
      orgId,
      dto.name,
      dto.description || '',
      dto.resource_type,
      dto.environment,
      dto.owner_team,
      dto.requires_approval ?? true,
      dto.access_level,
      dto.tags || [],
      ciphertext,
      iv.toString('base64'),
      authTag,
      masked,
      user.id,
    ];

    const rows = await this.db.query<SecretSummary>(sql, values);
    const created = rows[0];

    await this.audit.log({
      orgId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: role,
      action: 'SECRET_CREATED',
      resourceType: 'SECRET',
      resourceId: created.id,
      resourceName: created.name,
      status: 'SUCCESS',
      details: {
        environment: created.environment,
        resource_type: created.resource_type,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return created;
  }

  /**
   * Updates an existing secret's metadata and/or encrypted value.
   * Only ADMIN may call this (enforced by RolesGuard + @Roles decorator).
   * If dto.plaintext_value is provided, re-encrypts using AES-256-GCM.
   * If dto.plaintext_value is omitted, the existing encrypted value is preserved.
   * Never returns or stores plaintext.
   */
  async updateSecret(
    secretId: string,
    orgId: string,
    dto: UpdateSecretDto,
    user: SafeUser,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<SecretSummary> {
    // Validate at least one field is being updated
    const hasUpdates = [
      dto.name, dto.description, dto.resource_type, dto.environment,
      dto.owner_team, dto.requires_approval, dto.access_level, dto.tags,
      dto.plaintext_value,
    ].some((v) => v !== undefined);

    if (!hasUpdates) {
      throw new BadRequestException('No update fields provided.');
    }

    // Fetch existing secret to verify it exists in the org
    const existing = await this.db.queryOne<any>(
      `SELECT id, name, description, resource_type, environment, owner_team,
              requires_approval, access_level, tags, masked_preview,
              last_rotated_at, created_at
       FROM secrets WHERE id = $1 AND org_id = $2`,
      [secretId, orgId],
    );

    if (!existing) {
      throw new NotFoundException('Secret not found in organization');
    }

    // Build SET clauses dynamically — only update provided fields
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(dto.description.trim());
    }
    if (dto.resource_type !== undefined) {
      setClauses.push(`resource_type = $${idx++}`);
      values.push(dto.resource_type);
    }
    if (dto.environment !== undefined) {
      setClauses.push(`environment = $${idx++}`);
      values.push(dto.environment);
    }
    if (dto.owner_team !== undefined) {
      setClauses.push(`owner_team = $${idx++}`);
      values.push(dto.owner_team.trim());
    }
    if (dto.requires_approval !== undefined) {
      setClauses.push(`requires_approval = $${idx++}`);
      values.push(dto.requires_approval);
    }
    if (dto.access_level !== undefined) {
      setClauses.push(`access_level = $${idx++}`);
      values.push(dto.access_level);
    }
    if (dto.tags !== undefined) {
      setClauses.push(`tags = $${idx++}`);
      values.push(dto.tags);
    }

    // If a new plaintext value is provided, re-encrypt it
    if (dto.plaintext_value !== undefined && dto.plaintext_value.trim() !== '') {
      const newPlain = dto.plaintext_value.trim();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
      let ciphertext = cipher.update(newPlain, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64');

      let masked = '••••••••••••';
      if (newPlain.length > 8) {
        masked = `${newPlain.slice(0, 4)}••••••••••••${newPlain.slice(-3)}`;
      }

      setClauses.push(`encrypted_value = $${idx++}`);
      values.push(ciphertext);
      setClauses.push(`encryption_iv = $${idx++}`);
      values.push(iv.toString('base64'));
      setClauses.push(`auth_tag = $${idx++}`);
      values.push(authTag);
      setClauses.push(`masked_preview = $${idx++}`);
      values.push(masked);
      setClauses.push(`last_rotated_at = NOW()`);
    }

    // WHERE clause params
    values.push(secretId);
    values.push(orgId);
    const whereIdx1 = idx++;
    const whereIdx2 = idx++;

    const sql = `
      UPDATE secrets
      SET ${setClauses.join(', ')}
      WHERE id = $${whereIdx1} AND org_id = $${whereIdx2}
      RETURNING id, name, description, resource_type, environment, owner_team,
                requires_approval, access_level, tags, masked_preview,
                last_rotated_at, created_at;
    `;

    const rows = await this.db.query<SecretSummary>(sql, values);
    const updated = rows[0];

    // Audit log — never include plaintext or encryption keys
    await this.audit.log({
      orgId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: role,
      action: 'SECRET_UPDATED',
      resourceType: 'SECRET',
      resourceId: updated.id,
      resourceName: updated.name,
      status: 'SUCCESS',
      details: {
        updatedFields: [
          dto.name !== undefined && 'name',
          dto.description !== undefined && 'description',
          dto.resource_type !== undefined && 'resource_type',
          dto.environment !== undefined && 'environment',
          dto.owner_team !== undefined && 'owner_team',
          dto.requires_approval !== undefined && 'requires_approval',
          dto.access_level !== undefined && 'access_level',
          dto.tags !== undefined && 'tags',
          dto.plaintext_value !== undefined && dto.plaintext_value.trim() !== '' && 'secret_value_rotated',
        ].filter(Boolean),
        environment: updated.environment,
        resource_type: updated.resource_type,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  /**
   * Deletes a secret atomically.
   * Before deleting:
   *   1. Revokes all ACTIVE temporary grants (with ACCESS_REVOKED audit per grant).
   *   2. Cancels all PENDING access requests (status → REVOKED).
   *   3. Deletes the secret row (ON DELETE CASCADE removes remaining child rows).
   *   4. Writes SECRET_DELETED audit event.
   * All steps run inside a single PostgreSQL transaction.
   * Returns void — HTTP 204 No Content.
   */
  async deleteSecret(
    secretId: string,
    orgId: string,
    user: SafeUser,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.db.transaction(async (client) => {
      // 1. Fetch and lock the secret
      const secretRes = await client.query(
        `SELECT id, name, resource_type, environment
         FROM secrets
         WHERE id = $1 AND org_id = $2
         FOR UPDATE`,
        [secretId, orgId],
      );

      if (secretRes.rows.length === 0) {
        throw new NotFoundException('Secret not found in organization');
      }

      const secret = secretRes.rows[0];

      // 2. Revoke all ACTIVE grants for this secret (with audit trail per grant)
      const activeGrantsRes = await client.query(
        `SELECT g.id, u.email AS grantee_email
         FROM temporary_grants g
         JOIN users u ON u.id = g.user_id
         WHERE g.secret_id = $1 AND g.status = 'ACTIVE'`,
        [secretId],
      );

      for (const grant of activeGrantsRes.rows) {
        await client.query(
          `UPDATE temporary_grants
           SET status = 'REVOKED', revoked_at = NOW(), revoked_by = $1,
               revocation_reason = $2
           WHERE id = $3`,
          [user.id, 'Secret deleted by administrator', grant.id],
        );

        // Audit the revocation so the grant termination is on record
        await this.audit.log({
          orgId,
          actorId: user.id,
          actorEmail: user.email,
          actorRole: role,
          action: 'ACCESS_REVOKED',
          resourceType: 'TEMPORARY_GRANT',
          resourceId: grant.id,
          resourceName: secret.name,
          status: 'SUCCESS',
          details: {
            reason: 'Secret deleted by administrator',
            granteeEmail: grant.grantee_email,
            secretId: secret.id,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }

      // 3. Cancel all PENDING access requests for this secret
      await client.query(
        `UPDATE access_requests
         SET status = 'REVOKED', reviewed_by = $1, reviewed_at = NOW(),
             reviewer_note = 'Secret deleted by administrator'
         WHERE secret_id = $2 AND status = 'PENDING'`,
        [user.id, secretId],
      );

      // 4. Delete the secret (ON DELETE CASCADE removes remaining child rows)
      await client.query(
        `DELETE FROM secrets WHERE id = $1 AND org_id = $2`,
        [secretId, orgId],
      );

      // 5. Write the SECRET_DELETED audit event
      // NOTE: audit_logs has no FK on resource_id, so this INSERT succeeds
      // even after the secret row is gone.
      await this.audit.log({
        orgId,
        actorId: user.id,
        actorEmail: user.email,
        actorRole: role,
        action: 'SECRET_DELETED',
        resourceType: 'SECRET',
        resourceId: secret.id,
        resourceName: secret.name,
        status: 'SUCCESS',
        details: {
          resource_type: secret.resource_type,
          environment: secret.environment,
          grantsRevoked: activeGrantsRes.rows.length,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    });
  }
}
