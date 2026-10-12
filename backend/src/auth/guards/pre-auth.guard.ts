import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

const isProduction = process.env.NODE_ENV === 'production';
export const PRE_AUTH_COOKIE_NAME = isProduction
  ? '__Host-pre-auth'
  : 'sentrysafe_pre_auth';

@Injectable()
export class PreAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Pre-authentication session required for two-factor authentication',
      );
    }

    const ipAddress =
      (request.headers['x-forwarded-for'] as string) ||
      request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const preAuthContext = await this.authService.validatePreAuth(token, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    request.preAuth = preAuthContext;
    request.user = preAuthContext.user;
    request.membership = preAuthContext.membership;

    return true;
  }

  private extractToken(request: any): string | null {
    // 1. Check cookies (__Host-pre-auth or sentrysafe_pre_auth)
    if (request.cookies) {
      if (request.cookies['__Host-pre-auth']) {
        return request.cookies['__Host-pre-auth'];
      }
      if (request.cookies['sentrysafe_pre_auth']) {
        return request.cookies['sentrysafe_pre_auth'];
      }
    }

    // 2. Check X-Pre-Auth-Token header
    const preAuthHeader = request.headers['x-pre-auth-token'];
    if (preAuthHeader && typeof preAuthHeader === 'string') {
      return preAuthHeader.trim();
    }

    // 3. Fallback to Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
