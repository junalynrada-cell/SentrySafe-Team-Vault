import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '../database/database.module';
import { GrantsModule } from '../grants/grants.module';

@Module({
  imports: [DatabaseModule, GrantsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
