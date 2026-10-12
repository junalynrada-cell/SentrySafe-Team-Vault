import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SafeUser } from '../auth/auth.types';
import {
  CreateAccessRequestDto,
  ReviewRequestDto,
  AccessRequestSummary,
} from './requests.types';

@Injectable()
export class RequestsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Submits a temporary access request (US-001).
   */
  async createRequest(
    dto: CreateAccessRequestDto,
    user: SafeUser,
    orgId: string,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AccessRequestSummary> {
    const secret = await this.db.queryOne<any>(
      'SELECT id, name, resource_type, environment FROM secrets WHERE id = $1 AND org_id = $2',
      [dto.secret_id, orgId],
    );

    if (!secret) {
      throw new NotFoundException('Secret not found in organization');
    }

    const duration = dto.requested_duration_minutes || 30;

    const sql = `
      INSERT INTO access_requests (
        org_id, secret_id, requester_id, business_reason,
        requested_duration_minutes, status, valid_until
      ) VALUES (
        $1, $2, $3, $4, $5, 'PENDING', NOW() + INTERVAL '24 hours'
      ) RETURNING id, org_id, secret_id, requester_id, business_reason,
                  requested_duration_minutes, status, valid_until, created_at;
    `;

    const rows = await this.db.query<any>(sql, [
      orgId,
      dto.secret_id,
      user.id,
      dto.business_reason,
      duration,
    ]);
    const created = rows[0];

    // Audit log (US-015)
    await this.audit.log({
      orgId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: role,
      action: 'ACCESS_REQUEST',
      resourceType: 'ACCESS_REQUEST',
      resourceId: created.id,
      resourceName: secret.name,
      status: 'SUCCESS',
      details: {
        reason: dto.business_reason,
        durationMinutes: duration,
        secretId: secret.id,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      ...created,
      secret_name: secret.name,
      resource_type: secret.resource_type,
      environment: secret.environment,
      requester_name: user.full_name,
      requester_email: user.email,
      reviewed_by: null,
      reviewer_name: null,
      reviewed_at: null,
      reviewer_note: null,
    };
  }

  /**
   * Retrieves access requests for the organization with optional status and user filters.
   */
  async getRequests(
    orgId: string,
    options?: { userId?: string; status?: string },
  ): Promise<AccessRequestSummary[]> {
    const conditions: string[] = ['r.org_id = $1'];
    const values: any[] = [orgId];
    let index = 2;

    if (options?.userId) {
      conditions.push(`r.requester_id = $${index}`);
      values.push(options.userId);
      index++;
    }

    if (options?.status && options.status !== 'ALL') {
      conditions.push(`r.status = $${index}`);
      values.push(options.status);
      index++;
    }

    const sql = `
      SELECT 
        r.id, r.org_id, r.secret_id, r.requester_id, r.business_reason,
        r.requested_duration_minutes, r.status, r.valid_until, r.created_at,
        r.reviewed_by, r.reviewed_at, r.reviewer_note,
        s.name AS secret_name, s.resource_type, s.environment,
        u.full_name AS requester_name, u.email AS requester_email,
        rev.full_name AS reviewer_name,
        g.expires_at
      FROM access_requests r
      JOIN secrets s ON s.id = r.secret_id
      JOIN users u ON u.id = r.requester_id
      LEFT JOIN users rev ON rev.id = r.reviewed_by
      LEFT JOIN temporary_grants g ON g.request_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC;
    `;

    return this.db.query<AccessRequestSummary>(sql, values);
  }

  /**
   * Retrieves pending requests for the Approval Queue.
   */
  async getApprovalQueue(orgId: string): Promise<AccessRequestSummary[]> {
    const sql = `
      SELECT 
        r.id, r.org_id, r.secret_id, r.requester_id, r.business_reason,
        r.requested_duration_minutes, r.status, r.valid_until, r.created_at,
        r.reviewed_by, r.reviewed_at, r.reviewer_note,
        s.name AS secret_name, s.resource_type, s.environment,
        u.full_name AS requester_name, u.email AS requester_email,
        NULL AS reviewer_name, NULL AS expires_at
      FROM access_requests r
      JOIN secrets s ON s.id = r.secret_id
      JOIN users u ON u.id = r.requester_id
      WHERE r.org_id = $1 AND r.status = 'PENDING' AND r.valid_until > NOW()
      ORDER BY r.created_at ASC;
    `;

    return this.db.query<AccessRequestSummary>(sql, [orgId]);
  }

  /**
   * Approves an access request in an atomic PostgreSQL transaction (US-010).
   * Verifies US-011: expired requests cannot be approved.
   */
  async approveRequest(
    requestId: string,
    reviewer: SafeUser,
    orgId: string,
    role: string,
    dto?: ReviewRequestDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ success: boolean; grantId: string; expiresAt: string }> {
    return this.db.transaction(async (client) => {
      // 1. Fetch and lock request
      const reqRes = await client.query(
        `SELECT r.id, r.secret_id, r.requester_id, r.requested_duration_minutes,
                r.status, r.valid_until, s.name AS secret_name, u.email AS requester_email
         FROM access_requests r
         JOIN secrets s ON s.id = r.secret_id
         JOIN users u ON u.id = r.requester_id
         WHERE r.id = $1 AND r.org_id = $2
         FOR UPDATE`,
        [requestId, orgId],
      );

      if (reqRes.rows.length === 0) {
        throw new NotFoundException('Access request not found');
      }

      const req = reqRes.rows[0];

      if (req.status !== 'PENDING') {
        throw new BadRequestException(`Request is already in status '${req.status}'`);
      }

      // Separation of Duties (Correction 2): Approvers cannot approve their own request
      if (req.requester_id === reviewer.id) {
        throw new ForbiddenException(
          'Separation of Duties violation: Approvers cannot approve their own access requests.',
        );
      }

      // US-011: Expired request cannot be approved
      if (new Date(req.valid_until) <= new Date()) {
        await client.query(
          `UPDATE access_requests SET status = 'EXPIRED' WHERE id = $1`,
          [requestId],
        );
        throw new BadRequestException(
          'Request has expired and cannot be approved (US-011 Policy Enforcement)',
        );
      }

      // 2. Update request status to APPROVED
      await client.query(
        `UPDATE access_requests 
         SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), reviewer_note = $2
         WHERE id = $3`,
        [reviewer.id, dto?.reviewer_note || 'Approved', requestId],
      );

      // 3. Insert temporary grant
      const duration = req.requested_duration_minutes || 30;
      const grantRes = await client.query(
        `INSERT INTO temporary_grants (
          request_id, secret_id, user_id, org_id, granted_at,
          expires_at, status
        ) VALUES (
          $1, $2, $3, $4, NOW(),
          NOW() + ($5 || ' minutes')::interval, 'ACTIVE'
        ) RETURNING id, expires_at`,
        [requestId, req.secret_id, req.requester_id, orgId, duration],
      );

      const grant = grantRes.rows[0];

      // 4. Audit Log: Approval (Reviewer action)
      await this.audit.log({
        orgId,
        actorId: reviewer.id,
        actorEmail: reviewer.email,
        actorRole: role,
        action: 'ACCESS_APPROVED',
        resourceType: 'ACCESS_REQUEST',
        resourceId: requestId,
        resourceName: req.secret_name,
        status: 'SUCCESS',
        details: {
          requesterId: req.requester_id,
          requesterEmail: req.requester_email,
          durationMinutes: duration,
          reviewerNote: dto?.reviewer_note,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      // 5. Audit Log: Grant created (Security entitlement)
      await this.audit.log({
        orgId,
        actorId: reviewer.id,
        actorEmail: reviewer.email,
        actorRole: role,
        action: 'ACCESS_GRANTED',
        resourceType: 'TEMPORARY_GRANT',
        resourceId: grant.id,
        resourceName: req.secret_name,
        status: 'SUCCESS',
        details: {
          granteeId: req.requester_id,
          expiresAt: grant.expires_at,
          durationMinutes: duration,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return {
        success: true,
        grantId: grant.id,
        grant_id: grant.id,
        expiresAt: grant.expires_at,
        expires_at: grant.expires_at,
      };
    });
  }

  /**
   * Rejects an access request (US-010).
   */
  async rejectRequest(
    requestId: string,
    reviewer: SafeUser,
    orgId: string,
    role: string,
    dto?: ReviewRequestDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ success: boolean }> {
    const req = await this.db.queryOne<any>(
      `SELECT r.id, r.status, s.name AS secret_name, u.email AS requester_email
       FROM access_requests r
       JOIN secrets s ON s.id = r.secret_id
       JOIN users u ON u.id = r.requester_id
       WHERE r.id = $1 AND r.org_id = $2`,
      [requestId, orgId],
    );

    if (!req) {
      throw new NotFoundException('Access request not found');
    }

    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Request is already in status '${req.status}'`);
    }

    if (req.requester_id === reviewer.id) {
      throw new ForbiddenException(
        'Separation of Duties violation: Approvers cannot review their own access requests.',
      );
    }

    await this.db.query(
      `UPDATE access_requests 
       SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), reviewer_note = $2
       WHERE id = $3`,
      [reviewer.id, dto?.reviewer_note || 'Rejected by reviewer', requestId],
    );

    // Audit Log: Rejection
    await this.audit.log({
      orgId,
      actorId: reviewer.id,
      actorEmail: reviewer.email,
      actorRole: role,
      action: 'ACCESS_REJECTED',
      resourceType: 'ACCESS_REQUEST',
      resourceId: requestId,
      resourceName: req.secret_name,
      status: 'SUCCESS',
      details: {
        requesterEmail: req.requester_email,
        reviewerNote: dto?.reviewer_note,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true };
  }
}
