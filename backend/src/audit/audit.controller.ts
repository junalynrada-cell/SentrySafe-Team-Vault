import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

@Controller('audit-logs')
@UseGuards(SessionGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Retrieves immutable audit log records with filtering and metric summaries.
   * Accessible to ADMIN and AUDITOR roles only.
   */
  @Get()
  @Roles('ADMIN', 'AUDITOR')
  async getAuditLogs(
    @CurrentAuth() auth: AuthContext,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const orgId = auth.membership.org_id;

    const logs = await this.auditService.getLogsByOrg(orgId, {
      action,
      actorEmail: actor,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    // Compute stats for audit dashboard header
    const statsSql = `
      SELECT 
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE status = 'DENIED') AS denied_events,
        COUNT(*) FILTER (WHERE action = 'ADMIN_SECRET_ACCESS') AS admin_overrides,
        COUNT(*) FILTER (WHERE action = 'ACCESS_EXPIRED') AS auto_expired_count,
        COUNT(*) FILTER (WHERE action = 'SECRET_REVEALED') AS secret_reveals
      FROM audit_logs
      WHERE org_id = $1;
    `;
    const statsRow = await this.db.queryOne<any>(statsSql, [orgId]);

    return {
      stats: {
        total_events: parseInt(statsRow?.total_events || '0', 10),
        denied_events: parseInt(statsRow?.denied_events || '0', 10),
        admin_overrides: parseInt(statsRow?.admin_overrides || '0', 10),
        auto_expired_count: parseInt(statsRow?.auto_expired_count || '0', 10),
        secret_reveals: parseInt(statsRow?.secret_reveals || '0', 10),
      },
      logs,
    };
  }
}
