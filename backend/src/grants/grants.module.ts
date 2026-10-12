import { Module } from '@nestjs/common';
import { GrantsController } from './grants.controller';
import { GrantsService } from './grants.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [GrantsController],
  providers: [GrantsService],
  exports: [GrantsService],
})
export class GrantsModule {}
