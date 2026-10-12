import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionGuard } from './guards/session.guard';
import { RolesGuard } from './guards/roles.guard';
import { PreAuthGuard } from './guards/pre-auth.guard';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RolesGuard, PreAuthGuard],
  exports: [AuthService, SessionGuard, RolesGuard, PreAuthGuard],
})
export class AuthModule {}
