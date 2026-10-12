import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { PUBLIC_KEY, ALLOW_LOCKED_KEY } from '../decorators/roles.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication session required');
    }

    const ipAddress =
      request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const authContext = await this.authService.validateSession(token, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    const allowLocked = this.reflector.getAllAndOverride<boolean>(
      ALLOW_LOCKED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (authContext.session.is_locked && !allowLocked) {
      throw new HttpException(
        {
          statusCode: HttpStatus.LOCKED,
          message: 'Session is locked due to 30-minute inactivity. Re-authentication required.',
          isLocked: true,
        },
        HttpStatus.LOCKED,
      );
    }

    // Attach authentication context to request
    request.auth = authContext;
    request.user = authContext.user;
    request.session = authContext.session;
    request.membership = authContext.membership;

    return true;
  }

  private extractToken(request: any): string | null {
    // 1. Check cookies (__Host-session or sentrysafe_session)
    if (request.cookies) {
      if (request.cookies['__Host-session']) {
        return request.cookies['__Host-session'];
      }
      if (request.cookies['sentrysafe_session']) {
        return request.cookies['sentrysafe_session'];
      }
    }

    // 2. Check Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
