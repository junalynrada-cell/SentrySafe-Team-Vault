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

describe('Mandatory TOTP 2FA & Strict Session Management (Section 35) E2E', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let db: DatabaseService;
  let authService: AuthService;

  const uniqueId = Date.now();
  const testEmail = `e2e-security-${uniqueId}@sentrysafe.io`;
  const testPassword = 'Password123!';
  let testUserId = '';
  let testTotpSecret = '';
  let testBackupCode = '';

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --- Enrollment & Setup Flow ---
  it('A. User Signup initiates mandatory TOTP enrollment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Security Test User',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresEnrollment).toBe(true);
    testUserId = res.body.user.id;

    // Check pre-auth cookie set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('sentrysafe_pre_auth=');
  });

  it('B. User enrolls in TOTP 2FA and receives backup codes', async () => {
    // 1. Get pre-auth token by logging in
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    // 2. Request 2FA enrollment (QR code + secret)
    const enrollRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll')
      .set('Cookie', preAuthCookie);

    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.qrCodeUrl).toContain('data:image/png;base64');
    expect(enrollRes.body.manualKey).toBeDefined();
    testTotpSecret = enrollRes.body.manualKey;

    // 3. Verify valid 6-digit TOTP code
    const validToken = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });

    const verifyEnrollRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/verify')
      .set('Cookie', preAuthCookie)
      .send({ code: validToken });

    expect(verifyEnrollRes.status).toBe(200);
    expect(verifyEnrollRes.body.backupCodes).toBeDefined();
    expect(verifyEnrollRes.body.backupCodes.length).toBe(8);
    testBackupCode = verifyEnrollRes.body.backupCodes[0];

    // 4. Complete enrollment
    const completeRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/complete')
      .set('Cookie', preAuthCookie);

    expect(completeRes.status).toBe(200);
    const completeCookies = completeRes.headers['set-cookie'];
    const completeCookieStr = Array.isArray(completeCookies)
      ? completeCookies.join(';')
      : completeCookies;
    expect(completeCookieStr).toContain('sentrysafe_session=');
  });

  // --- Test 1: Correct Password ---
  it('Test 1: Correct password does not create full session and requires 2FA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.requiresEnrollment).toBe(false);
    expect(res.body.session).toBeUndefined(); // NO full session in body

    const cookies = res.headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('sentrysafe_pre_auth=');
    expect(cookieStr).not.toContain('sentrysafe_session='); // NO full session cookie
  });

  // --- Test 2: Wrong Password ---
  it('Test 2: Wrong password fails with 401 and issues no session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword999!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid email or password');
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).not.toContain('sentrysafe_session=');
    }
  });

  // --- Test 3: Correct Password + Wrong TOTP ---
  it('Test 3: Correct password + wrong TOTP rejects with 401 and no full session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: '000000' }); // Wrong TOTP code

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.message).toContain('Invalid 6-digit verification code');
    const cookies = verifyRes.headers['set-cookie'];
    if (cookies) {
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).not.toContain('sentrysafe_session=');
    }
  });

  // --- Test 4: Correct Password + Correct TOTP ---
  it('Test 4: Correct password + correct TOTP creates full session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];
    const validCode = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user).toBeDefined();
    expect(verifyRes.body.session).toBeDefined();
    const cookies = verifyRes.headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('sentrysafe_session=');
  });

  // --- Test 5: Pre-auth older than 5 minutes ---
  it('Test 5: Pre-auth older than 5 minutes is rejected', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    // Manually age the pre-auth session in DB past 5 minutes
    await db.query(
      `UPDATE pre_auth_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1`,
      [testUserId],
    );

    const validCode = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.message).toContain('expired');
  });

  // --- Test 6, 7, 8: Pre-auth attempts protected endpoints ---
  it('Test 6, 7, 8: Pre-auth credentials cannot access protected endpoints (/secrets, /dashboard, /members)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    const secretsRes = await request(app.getHttpServer())
      .get('/api/secrets')
      .set('Cookie', preAuthCookie);
    expect(secretsRes.status).toBe(401);

    const dashboardRes = await request(app.getHttpServer())
      .get('/api/dashboard/stats')
      .set('Cookie', preAuthCookie);
    expect(dashboardRes.status).toBe(401);

    const membersRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', preAuthCookie);
    expect(membersRes.status).toBe(401);
  });

  // --- Test 9: Use a backup code ---
  it('Test 9: Backup code successfully authenticates and is marked used', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ backupCode: testBackupCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user).toBeDefined();

    // Check DB: backup code must have used_at NOT NULL
    const normalized = testBackupCode.replace(/-/g, '');
    const codeHash = authService.hashToken(normalized);
    const dbCode = await db.queryOne<{ used_at: string | null }>(
      `SELECT used_at FROM backup_codes WHERE user_id = $1 AND code_hash = $2`,
      [testUserId, codeHash],
    );
    expect(dbCode?.used_at).not.toBeNull();
  });

  // --- Test 10: Reuse the same backup code ---
  it('Test 10: Reusing the same backup code is rejected', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ backupCode: testBackupCode });

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.message).toContain('already used backup code');
  });

  // --- Test 11: Session idle for more than 15 minutes ---
  it('Test 11: Session idle for more than 15 minutes is revoked and rejected with 401', async () => {
    // 1. Establish full session
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];
    const validCode = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });
    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    const sessionCookie = verifyRes.headers['set-cookie'];

    // 2. Age last_activity_at by 16 minutes in DB
    await db.query(
      `UPDATE sessions SET last_activity_at = NOW() - INTERVAL '16 minutes' WHERE user_id = $1 AND is_revoked = FALSE`,
      [testUserId],
    );

    // 3. Make request
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toContain('15-minute inactivity');

    // 4. Verify session is revoked in DB
    const sessionInDb = await db.queryOne<{ is_revoked: boolean }>(
      `SELECT is_revoked FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [testUserId],
    );
    expect(sessionInDb?.is_revoked).toBe(true);
  });

  // --- Test 12 & 13: Absolute Session Timeout (8 Hours) ---
  it('Test 12 & 13: Session reaching 8 hours absolute timeout is rejected with 401', async () => {
    // 1. Establish full session
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];
    const validCode = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });
    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    const sessionCookie = verifyRes.headers['set-cookie'];

    // 2. Age created_at by 8 hours and 1 minute (even with recent last_activity_at)
    await db.query(
      `UPDATE sessions 
       SET created_at = NOW() - INTERVAL '8 hours 5 minutes',
           last_activity_at = NOW() - INTERVAL '1 minute'
       WHERE user_id = $1 AND is_revoked = FALSE`,
      [testUserId],
    );

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toContain('8-hour absolute limit');
  });

  // --- Test 14: Invalid TOTP repeatedly (brute force invalidation) ---
  it('Test 14: 5 consecutive invalid TOTP attempts invalidate pre-auth session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-2fa')
        .set('Cookie', preAuthCookie)
        .send({ code: '000000' });
      expect(res.status).toBe(401);
    }

    // 5th attempt invalidates pre-auth session
    const fifthRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: '000000' });

    expect(fifthRes.status).toBe(401);
    expect(fifthRes.body.message).toContain('Too many invalid attempts');

    // Subsequent attempt is rejected as session is consumed/invalidated
    const subsequentRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: '123456' });
    expect(subsequentRes.status).toBe(401);
  });

  // --- Test 15: Attempt protected endpoint with pre-auth credentials ---
  it('Test 15: Protected endpoints reject pre-auth session cookies', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', preAuthCookie);
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Authentication session required');
  });

  // --- Test 16: Attempt to use revoked session ---
  it('Test 16: Attempt to use a revoked session is rejected', async () => {
    // 1. Establish full session
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];
    const validCode = speakeasy.totp({
      secret: testTotpSecret,
      encoding: 'base32',
    });
    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    const sessionCookie = verifyRes.headers['set-cookie'];

    // 2. Explicit logout revokes the session
    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);
    expect(logoutRes.status).toBe(200);

    // 3. Subsequent request with the same cookie is rejected
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);
    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toContain('Session has been revoked');
  });

  // --- Test 17: Existing RBAC still works ---
  it('Test 17: Existing RBAC controls remain strictly enforced across roles', async () => {
    // Helper to log in demo accounts (enrolling if needed)
    const loginRole = async (email: string) => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123!' });

      const preAuthCookie = loginRes.headers['set-cookie'];

      if (loginRes.body.requiresEnrollment) {
        const enrollRes = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll')
          .set('Cookie', preAuthCookie);
        const secret = enrollRes.body.manualKey;
        const code = speakeasy.totp({ secret, encoding: 'base32' });
        await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll/verify')
          .set('Cookie', preAuthCookie)
          .send({ code });
        const completeRes = await request(app.getHttpServer())
          .post('/api/auth/2fa/enroll/complete')
          .set('Cookie', preAuthCookie);
        return completeRes.headers['set-cookie'];
      } else {
        // Retrieve user's decrypted secret
        const userRow = await db.queryOne<{ totp_secret_encrypted: string }>(
          `SELECT totp_secret_encrypted FROM users WHERE email = $1`,
          [email],
        );
        const secret = authService.decryptTotpSecret(userRow!.totp_secret_encrypted);
        const code = speakeasy.totp({ secret, encoding: 'base32' });
        const verifyRes = await request(app.getHttpServer())
          .post('/api/auth/verify-2fa')
          .set('Cookie', preAuthCookie)
          .send({ code });
        return verifyRes.headers['set-cookie'];
      }
    };

    // 1. Alice Admin can access members
    const adminCookie = await loginRole('admin@sentrysafe.io');
    const membersRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', adminCookie);
    expect(membersRes.status).toBe(200);

    // 2. Charlie Developer cannot access members (Forbidden 403)
    const devCookie = await loginRole('developer@sentrysafe.io');
    const devMembersRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', devCookie);
    expect(devMembersRes.status).toBe(403);
  });

  // --- Test 18 & 19: Vault Reveal Controls ---
  it('Test 18 & 19: Authorized vs unauthorized secret reveal controls remain strictly intact', async () => {
    // Helper to log in role
    const loginRole = async (email: string) => {
      const userRow = await db.queryOne<{ totp_secret_encrypted: string }>(
        `SELECT totp_secret_encrypted FROM users WHERE email = $1`,
        [email],
      );
      const secret = authService.decryptTotpSecret(userRow!.totp_secret_encrypted);
      const code = speakeasy.totp({ secret, encoding: 'base32' });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123!' });
      const preAuthCookie = loginRes.headers['set-cookie'];

      const verifyRes = await request(app.getHttpServer())
        .post('/api/auth/verify-2fa')
        .set('Cookie', preAuthCookie)
        .send({ code });
      return verifyRes.headers['set-cookie'];
    };

    const adminCookie = await loginRole('admin@sentrysafe.io');
    const devCookie = await loginRole('developer@sentrysafe.io');

    const secretsRes = await request(app.getHttpServer())
      .get('/api/secrets')
      .set('Cookie', adminCookie);
    const secretId = secretsRes.body[0].id;

    // Admin direct reveal works (Test 18)
    const adminReveal = await request(app.getHttpServer())
      .post(`/api/secrets/${secretId}/reveal`)
      .set('Cookie', adminCookie);
    expect([200, 201]).toContain(adminReveal.status);
    expect(adminReveal.body.plaintext).toBeDefined();

    // Dev without grant is forbidden (Test 19)
    const devReveal = await request(app.getHttpServer())
      .post(`/api/secrets/${secretId}/reveal`)
      .set('Cookie', devCookie);
    expect(devReveal.status).toBe(403);
  });

  // --- Test 20: Audit Log Security ---
  it('Test 20: Audit logs do not contain passwords, TOTP secrets, tokens, or encryption keys', async () => {
    const auditRows = await db.query<{ details: any }>(
      `SELECT details FROM audit_logs ORDER BY timestamp DESC LIMIT 50`,
    );

    for (const row of auditRows) {
      const detailsStr = JSON.stringify(row.details || {});
      expect(detailsStr).not.toContain('Password123!');
      expect(detailsStr).not.toContain(testPassword);
      if (testTotpSecret) {
        expect(detailsStr).not.toContain(testTotpSecret);
      }
      if (testBackupCode) {
        expect(detailsStr).not.toContain(testBackupCode);
      }
    }
  });
});
