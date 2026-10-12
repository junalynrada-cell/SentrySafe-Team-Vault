import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SafeUser } from '../auth/auth.types';

export interface ActiveGrantItem {
  id: string;
  request_id: string;
  secret_id: string;
  secret_name: string;
  resource_type: string;
  environment: string;
  owner_team: string;
  masked_preview: string;
  granted_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  revealed_count: number;
  seconds_remaining: number;
  granted_duration_minutes: number;
}

@Injectable()
export class GrantsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) { }

  /**
   * Retrieves active temporary grants for the current user.
   * Synchronously checks and enforces expiration (US-002).
   */
  async getActiveGrants(
    userId: string,
    orgId: string,
  ): Promise<ActiveGrantItem[]> {
    // 1. Synchronously auto-expire any grants that passed expires_at
    const expiredCandidates = await this.db.query<any>(
      `SELECT g.id, g.secret_id, s.name AS secret_name, u.email AS user_email
       FROM temporary_grants g
       JOIN secrets s ON s.id = g.secret_id
       JOIN users u ON u.id = g.user_id
       WHERE g.user_id = $1 AND g.org_id = $2 AND g.status = 'ACTIVE' AND g.expires_at <= NOW()`,
      [userId, orgId],
    );

    for (const exp of expiredCandidates) {
      await this.db.query(
        `UPDATE temporary_grants SET status = 'EXPIRED' WHERE id = $1`,
        [exp.id],
      );

      // Audit expiration event (US-002, US-015)
      await this.audit.log({
        orgId,
        actorId: null, // system action
        actorEmail: 'system@sentrysafe.internal',
        actorRole: 'SYSTEM',
        action: 'ACCESS_EXPIRED',
        resourceType: 'TEMPORARY_GRANT',
        resourceId: exp.id,
        resourceName: exp.secret_name,
        status: 'AUTOMATIC',
        details: { granteeEmail: exp.user_email },
      });
    }

    // 2. Fetch still-active grants
    const sql = `
      SELECT 
        g.id, g.request_id, g.secret_id, g.granted_at, g.expires_at,
        g.status, g.revealed_count,
        s.name AS secret_name, s.resource_type, s.environment,
        s.owner_team, s.masked_preview,
        COALESCE(r.requested_duration_minutes, 30) AS granted_duration_minutes
      FROM temporary_grants g
      JOIN secrets s ON s.id = g.secret_id
      LEFT JOIN access_requests r ON r.id = g.request_id
      WHERE g.user_id = $1 AND g.org_id = $2 AND g.status = 'ACTIVE' AND g.expires_at > NOW()
      ORDER BY g.expires_at ASC;
    `;

    const rows = await this.db.query<any>(sql, [userId, orgId]);

    return rows.map((r) => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(r.expires_at).getTime() - Date.now()) / 1000),
      );
      return {
        ...r,
        seconds_remaining: remaining,
      };
    });
  }

  /**
   * Retrieves all active grants in organization for Approvers/Admins/Auditors.
   */
  async getActiveGrantsForOrg(orgId: string): Promise<ActiveGrantItem[]> {
    const expiredCandidates = await this.db.query<any>(
      `SELECT g.id, g.secret_id, s.name AS secret_name, u.email AS user_email
       FROM temporary_grants g
       JOIN secrets s ON s.id = g.secret_id
       JOIN users u ON u.id = g.user_id
       WHERE g.org_id = $1 AND g.status = 'ACTIVE' AND g.expires_at <= NOW()`,
      [orgId],
    );

    for (const exp of expiredCandidates) {
      await this.db.query(
        `UPDATE temporary_grants SET status = 'EXPIRED' WHERE id = $1`,
        [exp.id],
      );

      await this.audit.log({
        orgId,
        actorId: null,
        actorEmail: 'system@sentrysafe.internal',
        actorRole: 'SYSTEM',
        action: 'ACCESS_EXPIRED',
        resourceType: 'TEMPORARY_GRANT',
        resourceId: exp.id,
        resourceName: exp.secret_name,
        status: 'AUTOMATIC',
        details: { granteeEmail: exp.user_email },
      });
    }

    const sql = `
      SELECT 
        g.id, g.request_id, g.secret_id, g.granted_at, g.expires_at,
        g.status, g.revealed_count,
        s.name AS secret_name, s.resource_type, s.environment,
        s.owner_team, s.masked_preview,
        u.email AS user_email, u.full_name AS user_name,
        COALESCE(r.requested_duration_minutes, 30) AS granted_duration_minutes
      FROM temporary_grants g
      JOIN secrets s ON s.id = g.secret_id
      JOIN users u ON u.id = g.user_id
      LEFT JOIN access_requests r ON r.id = g.request_id
      WHERE g.org_id = $1 AND g.status = 'ACTIVE' AND g.expires_at > NOW()
      ORDER BY g.expires_at ASC;
    `;

    const rows = await this.db.query<any>(sql, [orgId]);
    return rows.map((r) => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(r.expires_at).getTime() - Date.now()) / 1000),
      );
      return {
        ...r,
        seconds_remaining: remaining,
      };
    });
  }

  /**
   * Revokes an active grant early (US-012, US-013).
   */
  async revokeGrant(
    grantId: string,
    user: SafeUser,
    orgId: string,
    role: string,
    reason?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ success: boolean }> {
    const grant = await this.db.queryOne<any>(
      `SELECT g.id, g.secret_id, s.name AS secret_name, u.email AS grantee_email
       FROM temporary_grants g
       JOIN secrets s ON s.id = g.secret_id
       JOIN users u ON u.id = g.user_id
       WHERE g.id = $1 AND g.org_id = $2 AND g.status = 'ACTIVE'`,
      [grantId, orgId],
    );

    if (!grant) {
      throw new NotFoundException('Active grant not found');
    }

    await this.db.query(
      `UPDATE temporary_grants 
       SET status = 'REVOKED', revoked_at = NOW(), revoked_by = $1, revocation_reason = $2
       WHERE id = $3`,
      [user.id, reason || 'Manually revoked by user/administrator', grantId],
    );

    await this.audit.log({
      orgId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: role,
      action: 'ACCESS_REVOKED',
      resourceType: 'TEMPORARY_GRANT',
      resourceId: grantId,
      resourceName: grant.secret_name,
      status: 'SUCCESS',
      details: {
        revokedBy: user.email,
        granteeEmail: grant.grantee_email,
        reason: reason || 'Manual revocation',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true };
  }
}
