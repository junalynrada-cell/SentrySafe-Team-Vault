import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, AuthContext } from '../auth.types';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const auth: AuthContext = request.auth;

    if (!auth || !auth.membership || auth.membership.status !== 'ACTIVE' || !auth.membership.role) {
      await this.audit.log({
        orgId: auth?.membership?.org_id || '00000000-0000-0000-0000-000000000000',
        actorId: auth?.user?.id,
        actorEmail: auth?.user?.email || 'unknown',
        actorRole: auth?.membership?.role || 'UNASSIGNED',
        action: 'DENIED_ACCESS',
        resourceType: 'ORGANIZATION',
        resourceId: auth?.membership?.org_id || '00000000-0000-0000-0000-000000000000',
        resourceName: request.url,
        status: 'DENIED',
        details: {
          endpoint: request.url,
          method: request.method,
          requiredRoles,
          userRole: auth?.membership?.role || 'UNASSIGNED',
          membershipStatus: auth?.membership?.status || 'NONE',
          reason: 'Active organization membership and assigned role required',
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      throw new ForbiddenException('Active organization membership with assigned role required');
    }

    const hasRole = requiredRoles.includes(auth.membership.role);

    if (!hasRole) {
      // Audit access denial (Zero Trust compliance)
      await this.audit.log({
        orgId: auth.membership.org_id,
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.membership.role || 'UNASSIGNED',
        action: 'DENIED_ACCESS',
        resourceType: 'ORGANIZATION',
        resourceId: auth.membership.org_id,
        resourceName: request.url,
        status: 'DENIED',
        details: {
          endpoint: request.url,
          method: request.method,
          requiredRoles,
          userRole: auth.membership.role,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      throw new ForbiddenException(
        `Access denied: requires one of roles [${requiredRoles.join(', ')}], current role is [${auth.membership.role}]`,
      );
    }

    return true;
  }
}
