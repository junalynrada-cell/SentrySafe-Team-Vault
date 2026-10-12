import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as speakeasy from 'speakeasy';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { AuthService } from '../src/auth/auth.service';

const ROLES = ['ADMIN', 'DEVELOPER', 'APPROVER', 'AUDITOR'] as const;

describe('Role-Independent Authentication Architecture E2E', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let db: DatabaseService;
  let authService: AuthService;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    db = app.get(DatabaseService);
    authService = app.get(AuthService);

    const org = await db.queryOne<{ id: string }>(
      `SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`,
    );
    orgId = org!.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  for (const role of ROLES) {
    describe(`Role: ${role}`, () => {
      const uniqueSuffix = `${role.toLowerCase()}-${Date.now()}`;
      const email = `test-${uniqueSuffix}@sentrysafe.io`;
      const password = 'Password123!';
      let userId: string;
      let enrolledSecret: string;
      let backupCodes: string[] = [];

      beforeAll(async () => {
        const passwordHash = await authService.hashPassword(password);
        const userRes = await db.query(
          `INSERT INTO users (email, password_hash, full_name, is_active, totp_enabled, totp_secret_encrypted, totp_enrolled_at)
           VALUES ($1, $2, $3, TRUE, FALSE, NULL, NULL)
           RETURNING id`,
          [email, passwordHash, `Test ${role}`],
        );
        userId = userRes[0].id;

        await db.query(
          `INSERT INTO organization_members (org_id, user_id, role, status)
           VALUES ($1, $2, $3, 'ACTIVE')`,
          [orgId, userId, role],
        );
      });

      afterAll(async () => {
        if (db && userId) {
          await db.query(`DELETE FROM pre_auth_sessions WHERE user_id = $1`, [userId]);
          await db.query(`DELETE FROM backup_codes WHERE user_id = $1`, [userId]);
          await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
          await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [userId]);
        }
      });

      // Case B: Account has no TOTP -> enrollment flow
      it(`Case B: ${role} with no TOTP -> password -> enrollment -> QR code -> verify -> backup codes -> full session`, async () => {
        // 1. Password login
        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.requiresTwoFactor).toBe(true);
        expect(loginRes.body.requiresEnrollment).toBe(true);
        const preAuthCookie = loginRes.headers['set-cookie'];

        // 2. Request enrollment (QR code & manual secret)
        const enrollRes = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll')
          .set('Cookie', preAuthCookie);

        expect(enrollRes.status).toBe(200);
        expect(enrollRes.body.qrCodeUrl).toContain('data:image/png;base64');
        expect(enrollRes.body.manualKey).toBeDefined();
        enrolledSecret = enrollRes.body.manualKey;

        // Case C (during enrollment): Wrong TOTP rejected
        const badVerify = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll/verify')
          .set('Cookie', preAuthCookie)
          .send({ code: '000000' });
        expect(badVerify.status).toBe(400);

        // 3. Verify valid TOTP code
        const validCode = speakeasy.totp({ secret: enrolledSecret, encoding: 'base32' });
        const verifyRes = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll/verify')
          .set('Cookie', preAuthCookie)
          .send({ code: validCode });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.backupCodes).toHaveLength(8);
        backupCodes = verifyRes.body.backupCodes;

        // 4. Complete enrollment -> full session
        const completeRes = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll/complete')
          .set('Cookie', preAuthCookie);

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.user.email).toBe(email);
        expect(completeRes.body.membership.role).toBe(role);

        const sessionCookie = completeRes.headers['set-cookie'];
        const meRes = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', sessionCookie);

        expect(meRes.status).toBe(200);
        expect(meRes.body.user.email).toBe(email);
        expect(meRes.body.membership.role).toBe(role);
      });

      // Case A: Account already has valid TOTP -> password -> TOTP -> full session
      it(`Case A: ${role} with valid TOTP -> password -> TOTP -> full session -> correct role`, async () => {
        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.requiresTwoFactor).toBe(true);
        expect(loginRes.body.requiresEnrollment).toBe(false); // Valid TOTP already configured!
        const preAuthCookie = loginRes.headers['set-cookie'];

        // Case C: Wrong TOTP rejected
        const badVerify = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', preAuthCookie)
          .send({ code: '999999' });
        expect(badVerify.status).toBe(401);
        expect(badVerify.body.message).toContain('Invalid 6-digit verification code');

        // Valid TOTP accepted
        const validCode = speakeasy.totp({ secret: enrolledSecret, encoding: 'base32' });
        const verifyRes = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', preAuthCookie)
          .send({ code: validCode });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.user.email).toBe(email);
        expect(verifyRes.body.membership.role).toBe(role);

        const sessionCookie = verifyRes.headers['set-cookie'];
        const meRes = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', sessionCookie);

        expect(meRes.status).toBe(200);
        expect(meRes.body.membership.role).toBe(role);
      });

      // Case D: Backup code login -> accepted once -> cannot be reused
      it(`Case D: ${role} can log in using backup code once, but cannot reuse it`, async () => {
        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password });
        const preAuthCookie = loginRes.headers['set-cookie'];

        const usedCode = backupCodes[0];

        // First use: accepted
        const backupVerifyRes = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', preAuthCookie)
          .send({ backupCode: usedCode });

        expect(backupVerifyRes.status).toBe(200);
        expect(backupVerifyRes.body.membership.role).toBe(role);

        // Second use: rejected (cannot be reused)
        const loginRes2 = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password });
        const preAuthCookie2 = loginRes2.headers['set-cookie'];

        const reuseRes = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', preAuthCookie2)
          .send({ backupCode: usedCode });

        expect(reuseRes.status).toBe(401);
        expect(reuseRes.body.message).toContain('Invalid or already used backup code');
      });

      // Case E: Expired or invalid pre-auth session -> rejected
      it(`Case E: ${role} with invalid/fake pre-auth cookie is rejected`, async () => {
        const fakeCookie = ['sentrysafe_pre_auth=invalid-token-1234567890abcdef; Path=/api; HttpOnly'];
        const res = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', fakeCookie)
          .send({ code: '123456' });

        expect(res.status).toBe(401);
      });
    });
  }
});
