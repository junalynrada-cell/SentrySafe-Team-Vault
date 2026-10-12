import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [SecretsController],
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
