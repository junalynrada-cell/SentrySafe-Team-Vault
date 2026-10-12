import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { MembersService } from './members.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext, UserRole } from '../auth/auth.types';

@Controller('members')
@UseGuards(SessionGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles('ADMIN')
  async getMembers(@CurrentAuth() auth: AuthContext) {
    return this.membersService.getMembers(auth.membership.org_id);
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  async approveMember(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.membersService.approveMember(
      id,
      role,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post(':id/restore')
  @Roles('ADMIN')
  async restoreMember(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.membersService.restoreMember(
      id,
      role,
      auth.user,
      auth.membership.org_id,
      auth.membership.role as string,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: 'ADMIN' | 'APPROVER' | 'DEVELOPER' | 'AUDITOR',
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.membersService.updateRole(
      id,
      role,
      auth.user,
      auth.membership.org_id,
      auth.membership.role ?? 'ADMIN',
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  async removeMember(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.membersService.removeMember(
      id,
      auth.user,
      auth.membership.org_id,
      auth.membership.role ?? 'ADMIN',
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
