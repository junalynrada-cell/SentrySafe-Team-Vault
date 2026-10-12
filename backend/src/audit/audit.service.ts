import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SESSION_LOCK'
  | 'REAUTHENTICATE'
  | 'ACCESS_REQUEST'
  | 'ACCESS_APPROVED'
  | 'ACCESS_REJECTED'
  | 'ACCESS_GRANTED'
  | 'SECRET_REVEALED'
  | 'CREDENTIAL_COPIED'
  | 'ACCESS_EXPIRED'
  | 'ACCESS_REVOKED'
  | 'PERMISSION_CHANGED'
  | 'MEMBER_REMOVED'
  | 'DENIED_ACCESS'
  | 'SECRET_CREATED'
  | 'SECRET_UPDATED'
  | 'SECRET_DELETED'
  | 'ADMIN_SECRET_ACCESS'
  | 'SIGNUP'
  | 'MEMBER_APPROVED'
  | 'MEMBER_RESTORED'
  | 'TOTP_ENROLLMENT_STARTED'
  | 'TOTP_ENROLLMENT_COMPLETED'
  | 'TOTP_VERIFICATION_SUCCESS'
  | 'TOTP_VERIFICATION_FAILED'
  | 'BACKUP_CODE_USED'
  | 'PRE_AUTH_EXPIRED'
  | 'SESSION_CREATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_IDLE_TIMEOUT';

export type AuditResourceType =
  | 'SECRET'
  | 'ACCESS_REQUEST'
  | 'TEMPORARY_GRANT'
  | 'USER'
  | 'ORGANIZATION'
  | 'SESSION';

export type AuditStatus = 'SUCCESS' | 'DENIED' | 'FAILURE' | 'AUTOMATIC';

export interface CreateAuditLogParams {
  orgId: string;
  actorId?: string | null;
  actorEmail: string;
  actorRole?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceName: string;
  status: AuditStatus;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRecord {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  resource_name: string;
  status: AuditStatus;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Appends an immutable audit log record to the database.
   * Prohibited from UPDATE/DELETE by PostgreSQL trigger.
   */
  async log(params: CreateAuditLogParams): Promise<AuditLogRecord> {
    try {
      const sql = `
        INSERT INTO audit_logs (
          org_id, actor_id, actor_email, actor_role, action,
          resource_type, resource_id, resource_name, status,
          details, ip_address, user_agent
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *;
      `;

      const values = [
        params.orgId,
        params.actorId || null,
        params.actorEmail,
        params.actorRole || 'UNASSIGNED',
        params.action,
        params.resourceType,
        params.resourceId,
        params.resourceName,
        params.status,
        JSON.stringify(params.details || {}),
        params.ipAddress || null,
        params.userAgent || null,
      ];

      const rows = await this.db.query<AuditLogRecord>(sql, values);
      return rows[0];
    } catch (err) {
      this.logger.error(
        `Failed to persist audit log [${params.action}] for actor [${params.actorEmail}]:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Retrieves audit logs for an organization with optional filters.
   */
  async getLogsByOrg(
    orgId: string,
    options?: {
      action?: string;
      actorEmail?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLogRecord[]> {
    const conditions: string[] = ['org_id = $1'];
    const values: any[] = [orgId];
    let index = 2;

    if (options?.action) {
      conditions.push(`action = $${index}`);
      values.push(options.action);
      index++;
    }

    if (options?.actorEmail) {
      conditions.push(`actor_email ILIKE $${index}`);
      values.push(`%${options.actorEmail}%`);
      index++;
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const sql = `
      SELECT * FROM audit_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${index} OFFSET $${index + 1};
    `;
    values.push(limit, offset);

    return this.db.query<AuditLogRecord>(sql, values);
  }
}
