import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequestsService } from './requests.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CreateAccessRequestDto, ReviewRequestDto } from './requests.types';

@Controller('requests')
@UseGuards(SessionGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async createRequest(
    @Body() dto: CreateAccessRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.requestsService.createRequest(
      dto,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Get()
  async getRequests(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    const isDev = auth.membership.role === 'DEVELOPER';
    return this.requestsService.getRequests(auth.membership.org_id, {
      userId: isDev ? auth.user.id : undefined,
      status,
    });
  }

  /**
   * IMPORTANT (Correction 4):
   * /queue is defined BEFORE any parameterized :id routes to prevent route collisions.
   * APPROVER-only: Admin does NOT replace dedicated Approver.
   */
  @Get('queue')
  @Roles('APPROVER')
  async getApprovalQueue(@CurrentAuth() auth: AuthContext) {
    return this.requestsService.getApprovalQueue(auth.membership.org_id);
  }

  @Post(':id/approve')
  @Roles('APPROVER')
  async approveRequest(
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.requestsService.approveRequest(
      id,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      dto,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post(':id/reject')
  @Roles('APPROVER')
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.requestsService.rejectRequest(
      id,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      dto,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
