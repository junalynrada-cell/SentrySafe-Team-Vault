import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { GrantsService } from './grants.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext } from '../auth/auth.types';

@Controller('grants')
@UseGuards(SessionGuard)
export class GrantsController {
  constructor(private readonly grantsService: GrantsService) {}

  /**
   * Retrieves active, non-expired temporary grants for current user.
   * Enforces synchronous auto-expiration check.
   */
  @Get('active')
  async getActiveGrants(@CurrentAuth() auth: AuthContext) {
    return this.grantsService.getActiveGrants(
      auth.user.id,
      auth.membership.org_id,
    );
  }

  /**
   * Retrieves all active grants in organization (for Approver/Admin/Auditor views).
   */
  @Get('org/active')
  async getOrgActiveGrants(@CurrentAuth() auth: AuthContext) {
    return this.grantsService.getActiveGrantsForOrg(auth.membership.org_id);
  }

  /**
   * Allows early revocation of a temporary grant ("End Access Now").
   */
  @Post(':id/revoke')
  async revokeGrant(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.grantsService.revokeGrant(
      id,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      reason || 'User ended access early',
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
