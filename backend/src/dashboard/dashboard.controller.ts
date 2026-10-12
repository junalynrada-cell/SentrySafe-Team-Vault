import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext } from '../auth/auth.types';

@Controller('dashboard')
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getDashboardStats(@CurrentAuth() auth: AuthContext) {
    return this.dashboardService.getStats(
      auth.membership.org_id,
      auth.user.id,
      auth.membership.role,
    );
  }
}
