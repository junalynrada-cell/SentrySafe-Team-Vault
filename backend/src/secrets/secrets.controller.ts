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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { SecretsService } from './secrets.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAuth } from '../auth/decorators/current-user.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CreateSecretDto, UpdateSecretDto } from './secrets.types';

@Controller('secrets')
@UseGuards(SessionGuard, RolesGuard)
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get()
  async getSecrets(@CurrentAuth() auth: AuthContext) {
    return this.secretsService.getSecrets(
      auth.membership.org_id,
      auth.user.id,
    );
  }

  @Get(':id')
  async getSecretById(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.secretsService.getSecretById(
      id,
      auth.membership.org_id,
      auth.user.id,
    );
  }

  @Post(':id/reveal')
  async revealSecret(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.secretsService.revealSecret(
      id,
      auth.user,
      auth.membership,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post()
  @Roles('ADMIN')
  async createSecret(
    @Body() dto: CreateSecretDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.secretsService.createSecret(
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

  /**
   * PATCH /api/secrets/:id
   * ADMIN only. Updates secret metadata and/or re-encrypts the secret value.
   * Returns 200 with the updated SecretSummary (no plaintext).
   * Returns 400 for invalid/empty input.
   * Returns 401 for unauthenticated requests (SessionGuard).
   * Returns 403 for non-ADMIN roles (RolesGuard + @Roles).
   * Returns 404 if the secret does not exist in the organization.
   */
  @Patch(':id')
  @Roles('ADMIN')
  async updateSecret(
    @Param('id') id: string,
    @Body() dto: UpdateSecretDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.secretsService.updateSecret(
      id,
      auth.membership.org_id,
      dto,
      auth.user,
      auth.membership.role as string,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  /**
   * DELETE /api/secrets/:id
   * ADMIN only. Atomically revokes active grants, cancels pending requests,
   * deletes the secret, and writes audit events.
   * Returns 204 No Content on success.
   * Returns 401 for unauthenticated requests (SessionGuard).
   * Returns 403 for non-ADMIN roles (RolesGuard + @Roles).
   * Returns 404 if the secret does not exist in the organization.
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSecret(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<void> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.secretsService.deleteSecret(
      id,
      auth.membership.org_id,
      auth.user,
      auth.membership.role as string,
      {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
