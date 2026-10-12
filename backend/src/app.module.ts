import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SecretsModule } from './secrets/secrets.module';
import { RequestsModule } from './requests/requests.module';
import { GrantsModule } from './grants/grants.module';
import { MembersModule } from './members/members.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    SecretsModule,
    RequestsModule,
    GrantsModule,
    MembersModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}