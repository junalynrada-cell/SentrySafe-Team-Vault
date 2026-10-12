import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthService,
  LoginDto,
  SignupDto,
  Verify2faDto,
} from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { PreAuthGuard, PRE_AUTH_COOKIE_NAME } from './guards/pre-auth.guard';
import { Public, AllowLocked } from './decorators/roles.decorator';
import { CurrentAuth, CurrentPreAuth } from './decorators/current-user.decorator';
import type { AuthContext, PreAuthContext } from './auth.types';

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_NAME = isProduction ? '__Host-session' : 'sentrysafe_session';
const COOKIE_SAME_SITE: 'strict' | 'lax' = isProduction ? 'strict' : 'lax';

@Controller('auth')
@UseGuards(SessionGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.signup(body, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    // Set 5-minute pre-authentication cookie for 2FA enrollment
    res.cookie(PRE_AUTH_COOKIE_NAME, result.preAuthToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
      maxAge: 5 * 60 * 1000,
    });

    return {
      success: true,
      message: result.message,
      requiresEnrollment: true,
      user: result.user,
      status: result.status,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(body, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    // Set secure HTTP-only pre-authentication cookie (5-minute lifetime)
    // A correct password NEVER immediately creates a full session.
    res.cookie(PRE_AUTH_COOKIE_NAME, result.preAuthToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
      maxAge: 5 * 60 * 1000,
    });

    return {
      requiresTwoFactor: true,
      requiresEnrollment: result.requiresEnrollment,
      email: result.email,
    };
  }

  @Public()
  @UseGuards(PreAuthGuard)
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @CurrentPreAuth() preAuth: PreAuthContext,
    @Body() body: Verify2faDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.verify2fa(preAuth, body, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    // Set secure HTTP-only full session cookie (8-hour absolute lifespan)
    res.cookie(COOKIE_NAME, result.rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });

    // Clear pre-auth cookie
    res.clearCookie(PRE_AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
    });

    return {
      user: result.user,
      session: {
        id: result.session.id,
        expires_at: result.session.expires_at,
        is_locked: result.session.is_locked,
        last_activity_at: result.session.last_activity_at,
      },
      membership: result.membership,
      token: isProduction ? undefined : result.rawToken,
    };
  }

  @Public()
  @UseGuards(PreAuthGuard)
  @Post('2fa/enroll')
  @HttpCode(HttpStatus.OK)
  async enroll2fa(
    @CurrentPreAuth() preAuth: PreAuthContext,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.startTotpEnrollment(preAuth, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });
  }

  @Public()
  @UseGuards(PreAuthGuard)
  @Post('2fa/enroll/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEnrollment(
    @CurrentPreAuth() preAuth: PreAuthContext,
    @Body('code') code: string,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.verifyTotpEnrollment(preAuth, code, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });
  }

  @Public()
  @UseGuards(PreAuthGuard)
  @Post('2fa/enroll/complete')
  @HttpCode(HttpStatus.OK)
  async completeEnrollment(
    @CurrentPreAuth() preAuth: PreAuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.completeTotpEnrollment(preAuth, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    // Set secure HTTP-only full session cookie (8-hour absolute lifespan)
    res.cookie(COOKIE_NAME, result.rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });

    // Clear pre-auth cookie
    res.clearCookie(PRE_AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: COOKIE_SAME_SITE,
      path: '/',
    });

    return {
      user: result.user,
      session: {
        id: result.session.id,
        expires_at: result.session.expires_at,
        is_locked: result.session.is_locked,
        last_activity_at: result.session.last_activity_at,
      },
      membership: result.membership,
      token: isProduction ? undefined : result.rawToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (token) {
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      await this.authService.logout(token, {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: req.headers['user-agent'],
      });
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie(PRE_AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return { success: true, message: 'Logged out successfully' };
  }

  @Post('lock')
  @HttpCode(HttpStatus.OK)
  async lock(@Req() req: Request) {
    const token =
      req.cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!token) {
      throw new BadRequestException('Session token missing');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.lockSession(token, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });
  }

  @AllowLocked()
  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  async unlock(
    @Body('password') password: string,
    @Req() req: Request,
  ) {
    if (!password) {
      throw new BadRequestException('Password is required to unlock session');
    }

    const token =
      req.cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!token) {
      throw new BadRequestException('Session token missing');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    return this.authService.unlockSession(token, password, {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  async getMe(@CurrentAuth() auth: AuthContext) {
    return {
      user: auth.user,
      session: {
        id: auth.session.id,
        is_locked: auth.session.is_locked,
        expires_at: auth.session.expires_at,
        last_activity_at: auth.session.last_activity_at,
      },
      membership: auth.membership,
    };
  }
}
