import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GrantsService } from '../grants/grants.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly grantsService: GrantsService,
  ) {}

  async getStats(orgId: string, userId: string, role?: string | null) {
    // 1. Total Secrets
    const totalSecretsRow = await this.db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM secrets WHERE org_id = $1`,
      [orgId],
    );

    // 2. Pending Requests
    const pendingReqsRow = await this.db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM access_requests WHERE org_id = $1 AND status = 'PENDING' AND valid_until > NOW()`,
      [orgId],
    );

    // 3. Active Grants in Org
    const activeGrantsOrgRow = await this.db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM temporary_grants 
       WHERE org_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()`,
      [orgId],
    );

    // 4. Team Members Count
    const membersRow = await this.db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM organization_members WHERE org_id = $1 AND status != 'REMOVED'`,
      [orgId],
    );

    // 5. Developer-specific request count
    const myReqsRow = await this.db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM access_requests WHERE requester_id = $1 AND org_id = $2`,
      [userId, orgId],
    );

    // 6. Auditor stats
    const auditStatsRow = await this.db.queryOne<any>(
      `SELECT 
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE status = 'DENIED') AS denied_events,
        COUNT(*) FILTER (WHERE action = 'SECRET_REVEALED') AS secret_reveals,
        COUNT(*) FILTER (WHERE action = 'ACCESS_EXPIRED') AS auto_expired_count
       FROM audit_logs WHERE org_id = $1`,
      [orgId],
    );

    // 7. User's active grants (with synchronous auto-expiration check)
    const userActiveGrants = await this.grantsService.getActiveGrants(userId, orgId);

    // 8. Recent audit logs
    const recentLogs = await this.db.query<any>(
      `SELECT id, actor_email, actor_role, action, resource_name, status, timestamp, details
       FROM audit_logs
       WHERE org_id = $1 ${role === 'DEVELOPER' ? 'AND actor_id = $2' : ''}
       ORDER BY timestamp DESC
       LIMIT 6`,
      role === 'DEVELOPER' ? [orgId, userId] : [orgId],
    );

    // 9. Recent secrets
    const recentSecrets = await this.db.query<any>(
      `SELECT id, name, resource_type, environment, owner_team, masked_preview, created_at
       FROM secrets
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [orgId],
    );

    // 10. Pending Queue (for Approver)
    const pendingQueue = await this.db.query<any>(
      `SELECT r.id, r.secret_id, s.name AS secret_name, s.environment, s.resource_type,
              u.full_name AS requester_name, u.email AS requester_email,
              r.business_reason, r.requested_duration_minutes, r.created_at
       FROM access_requests r
       JOIN secrets s ON s.id = r.secret_id
       JOIN users u ON u.id = r.requester_id
       WHERE r.org_id = $1 AND r.status = 'PENDING' AND r.valid_until > NOW()
       ORDER BY r.created_at ASC
       LIMIT 5`,
      [orgId],
    );

    // 11. Developer's personal recent requests
    const myRecentRequests = await this.db.query<any>(
      `SELECT r.id, s.name AS secret_name, s.environment, r.status, r.created_at,
              r.requested_duration_minutes, r.business_reason
       FROM access_requests r
       JOIN secrets s ON s.id = r.secret_id
       WHERE r.requester_id = $1 AND r.org_id = $2
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [userId, orgId],
    );

    // 12. Team Roster Summary (for Admin)
    const teamRosterSummary = await this.db.query<any>(
      `SELECT m.id, u.full_name, u.email, m.role, m.status, m.joined_at
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1 AND m.status != 'REMOVED'
       ORDER BY 
         CASE m.role
           WHEN 'ADMIN' THEN 1
           WHEN 'APPROVER' THEN 2
           WHEN 'DEVELOPER' THEN 3
           WHEN 'AUDITOR' THEN 4
           ELSE 5
         END
       LIMIT 5`,
      [orgId],
    );

    return {
      metrics: {
        total_secrets: parseInt(totalSecretsRow?.count || '0', 10),
        pending_requests: parseInt(pendingReqsRow?.count || '0', 10),
        active_grants_count: parseInt(activeGrantsOrgRow?.count || '0', 10),
        members_count: parseInt(membersRow?.count || '0', 10),
        my_requests_count: parseInt(myReqsRow?.count || '0', 10),
        secrets_encrypted: parseInt(totalSecretsRow?.count || '0', 10),
        encryption_standard: 'AES-256-GCM',
        zero_trust_policy: 'LEAST_PRIVILEGE',
        total_audit_events: parseInt(auditStatsRow?.total_events || '0', 10),
        denied_events: parseInt(auditStatsRow?.denied_events || '0', 10),
        secret_reveals: parseInt(auditStatsRow?.secret_reveals || '0', 10),
        auto_expired_count: parseInt(auditStatsRow?.auto_expired_count || '0', 10),
      },
      user_active_grants: userActiveGrants,
      recent_activity: recentLogs,
      recent_secrets: recentSecrets,
      pending_queue: pendingQueue,
      my_recent_requests: myRecentRequests,
      team_roster_summary: teamRosterSummary,
    };
  }
}
