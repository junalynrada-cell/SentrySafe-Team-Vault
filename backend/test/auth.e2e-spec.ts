import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('Authentication & Session Management (REQ-001) E2E', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let sessionCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/login - should fail with 401 on incorrect password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'developer@sentrysafe.io',
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid email or password');
  });

  it('POST /api/auth/login & /verify-2fa - should require 2FA and set session cookie', async () => {
    // Phase 1: Login with credentials
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'developer@sentrysafe.io',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requiresTwoFactor).toBe(true);
    const preAuthCookies = loginRes.headers['set-cookie'];
    expect(preAuthCookies).toBeDefined();

    // Phase 2: Complete 2FA (or enrollment if not yet enrolled)
    if (loginRes.body.requiresEnrollment) {
      const enrollRes = await request(app.getHttpServer())
        .post('/api/auth/2fa/enroll')
        .set('Cookie', preAuthCookies);
      const secret = enrollRes.body.manualKey;
      const validCode = require('speakeasy').totp({ secret, encoding: 'base32' });
      await request(app.getHttpServer())
        .post('/api/auth/2fa/enroll/verify')
        .set('Cookie', preAuthCookies)
        .send({ code: validCode });
      const completeRes = await request(app.getHttpServer())
        .post('/api/auth/2fa/enroll/complete')
        .set('Cookie', preAuthCookies);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.user.email).toBe('developer@sentrysafe.io');
      sessionCookie = completeRes.headers['set-cookie'];
    } else {
      const db = app.get(require('../src/database/database.service').DatabaseService);
      const authService = app.get(require('../src/auth/auth.service').AuthService);
      const userRow = await db.queryOne(
        `SELECT totp_secret_encrypted FROM users WHERE email = $1`,
        ['developer@sentrysafe.io'],
      );
      const secret = authService.decryptTotpSecret(userRow.totp_secret_encrypted);
      const validCode = require('speakeasy').totp({ secret, encoding: 'base32' });
      const verifyRes = await request(app.getHttpServer())
        .post('/api/auth/verify-2fa')
        .set('Cookie', preAuthCookies)
        .send({ code: validCode });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.email).toBe('developer@sentrysafe.io');
      sessionCookie = verifyRes.headers['set-cookie'];
    }

    const cookieStr = Array.isArray(sessionCookie) ? sessionCookie.join(';') : sessionCookie;
    expect(cookieStr).toContain('sentrysafe_session=');
  });

  it('GET /api/auth/me - should reject unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - should return authenticated user profile using cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('developer@sentrysafe.io');
    expect(res.body.membership.role).toBe('DEVELOPER');
    expect(res.body.session.is_locked).toBe(false);
  });

  it('POST /api/auth/unlock - should reauthenticate and unlock session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/unlock')
      .set('Cookie', sessionCookie)
      .send({ password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/logout - should revoke session and clear cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify session is revoked on subsequent request
    const afterLogout = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(afterLogout.status).toBe(401);
  });
});
