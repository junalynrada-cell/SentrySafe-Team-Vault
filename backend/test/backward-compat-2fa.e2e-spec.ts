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

describe('Backward-Compatible 2FA Enrollment for Existing Accounts E2E', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let db: DatabaseService;
  let authService: AuthService;

  const uniqueId = Date.now();
  const testEmail = `legacy-admin-${uniqueId}@sentrysafe.io`;
  const testPassword = 'Password123!';
  let testUserId = '';
  let originalPasswordHash = '';
  let testOrgId = '';
  let generatedTotpSecret = '';
  let generatedBackupCodes: string[] = [];
  let firstSessionCookie: any;
  let secondSessionCookie: any;

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

    // Get primary organization
    const org = await db.queryOne<{ id: string }>(
      `SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`,
    );
    testOrgId = org!.id;

    // Create a legacy user account created BEFORE mandatory 2FA:
    // totp_enabled = FALSE, totp_secret_encrypted = NULL, totp_enrolled_at = NULL
    originalPasswordHash = await authService.hashPassword(testPassword);
    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, full_name, is_active, totp_enabled, totp_secret_encrypted, totp_enrolled_at)
       VALUES ($1, $2, 'Legacy Admin Test', TRUE, FALSE, NULL, NULL)
       RETURNING id`,
      [testEmail, originalPasswordHash],
    );
    testUserId = userRes[0].id;

    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status)
       VALUES ($1, $2, 'ADMIN', 'ACTIVE')`,
      [testOrgId, testUserId],
    );
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.query(`DELETE FROM pre_auth_sessions WHERE user_id = $1`, [testUserId]);
      await db.query(`DELETE FROM backup_codes WHERE user_id = $1`, [testUserId]);
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
      await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [testUserId]);
    }
    if (app) {
      await app.close();
    }
  });

  // --- Test 1: Existing user with TOTP disabled submits correct password ---
  it('1. Existing user with TOTP disabled submits correct password -> requiresEnrollment = true', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.requiresEnrollment).toBe(true);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.session).toBeUndefined(); // No full session

    const cookies = res.headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('sentrysafe_pre_auth=');
    expect(cookieStr).not.toContain('sentrysafe_session=');
  });

  // --- Test 2: Existing user cannot access protected endpoints with only pre-auth state ---
  it('2. Existing user cannot access protected endpoints using only pre-auth state', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const preAuthCookie = loginRes.headers['set-cookie'];

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', preAuthCookie);
    expect(meRes.status).toBe(401);

    const membersRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', preAuthCookie);
    expect(membersRes.status).toBe(401);
  });

  // --- Test 3: Existing user can start TOTP enrollment ---
  it('3. Existing user starts TOTP enrollment and receives QR code and manual setup key', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    const enrollRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll')
      .set('Cookie', preAuthCookie);

    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.qrCodeUrl).toContain('data:image/png;base64');
    expect(enrollRes.body.manualKey).toBeDefined();
    expect(enrollRes.body.manualKey.length).toBeGreaterThan(15);
    generatedTotpSecret = enrollRes.body.manualKey;

    // Verify secret is encrypted in database, totp_enabled remains false
    const userInDb = await db.queryOne<{ totp_secret_encrypted: string; totp_enabled: boolean }>(
      `SELECT totp_secret_encrypted, totp_enabled FROM users WHERE id = $1`,
      [testUserId],
    );
    expect(userInDb?.totp_secret_encrypted).not.toBe(generatedTotpSecret); // Not plaintext
    expect(userInDb?.totp_enabled).toBe(false);
  });

  // --- Test 4: Invalid TOTP code is rejected during enrollment verification ---
  it('4. Invalid TOTP code is rejected during enrollment verification', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    const badVerifyRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/verify')
      .set('Cookie', preAuthCookie)
      .send({ code: '000000' });

    expect([400, 401]).toContain(badVerifyRes.status);
    expect(badVerifyRes.body.message).toContain('Invalid verification code');
  });

  // --- Test 5 & 6: Valid TOTP code enables TOTP and generates backup codes ---
  it('5 & 6. Valid TOTP code verifies enrollment, enables TOTP, and generates 8 backup codes', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    const validCode = speakeasy.totp({
      secret: generatedTotpSecret,
      encoding: 'base32',
    });

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/verify')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.backupCodes).toBeDefined();
    expect(verifyRes.body.backupCodes.length).toBe(8);
    generatedBackupCodes = verifyRes.body.backupCodes;

    // Check database: totp_enabled must now be true, totp_enrolled_at populated
    const userInDb = await db.queryOne<{ totp_enabled: boolean; totp_enrolled_at: string | null }>(
      `SELECT totp_enabled, totp_enrolled_at FROM users WHERE id = $1`,
      [testUserId],
    );
    expect(userInDb?.totp_enabled).toBe(true);
    expect(userInDb?.totp_enrolled_at).not.toBeNull();

    // Check backup codes stored as hashes in DB
    const dbCodes = await db.query<{ code_hash: string }>(
      `SELECT code_hash FROM backup_codes WHERE user_id = $1`,
      [testUserId],
    );
    expect(dbCodes.length).toBe(8);
  });

  // --- Test 7 & 8: Enrollment completion creates full session and reaches Admin dashboard ---
  it('7 & 8. Completing enrollment creates full session and grants access to Admin dashboard', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const preAuthCookie = loginRes.headers['set-cookie'];

    const completeRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/complete')
      .set('Cookie', preAuthCookie);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.user.email).toBe(testEmail);
    expect(completeRes.body.membership.role).toBe('ADMIN');
    expect(completeRes.body.membership.status).toBe('ACTIVE');

    firstSessionCookie = completeRes.headers['set-cookie'];
    const cookieStr = Array.isArray(firstSessionCookie) ? firstSessionCookie.join(';') : firstSessionCookie;
    expect(cookieStr).toContain('sentrysafe_session=');

    // Admin calls /api/auth/me and accesses admin dashboard endpoints
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', firstSessionCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(testUserId);
    expect(meRes.body.membership.role).toBe('ADMIN');
    expect(meRes.body.membership.status).toBe('ACTIVE');

    // Admin can access members list
    const membersRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', firstSessionCookie);
    expect(membersRes.status).toBe(200);
  });

  // --- Test 9 & 10: Second login does NOT require enrollment, only TOTP code ---
  it('9 & 10. Second login requires TOTP code (requiresEnrollment = false) and succeeds', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requiresTwoFactor).toBe(true);
    expect(loginRes.body.requiresEnrollment).toBe(false); // NO enrollment required!

    const preAuthCookie = loginRes.headers['set-cookie'];

    // Provide 6-digit TOTP code
    const validCode = speakeasy.totp({
      secret: generatedTotpSecret,
      encoding: 'base32',
    });

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-2fa')
      .set('Cookie', preAuthCookie)
      .send({ code: validCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.email).toBe(testEmail);
    secondSessionCookie = verifyRes.headers['set-cookie'];

    // Access admin dashboard
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', secondSessionCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.membership.role).toBe('ADMIN');
  });

  // --- Test 11, 12, 13, 14: Verification of account immutability ---
  it('11, 12, 13, 14. Existing Admin account ID, role, and password hash are preserved with zero duplicates', async () => {
    // 14. Check no duplicate accounts exist
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE email = $1`,
      [testEmail],
    );
    expect(parseInt(countRes[0].count, 10)).toBe(1);

    // 11, 12, 13. Verify ID, password_hash, and role
    const finalAdmin = await db.queryOne<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [testEmail],
    );
    expect(finalAdmin?.id).toBe(testUserId); // ID unchanged
    expect(finalAdmin?.password_hash).toBe(originalPasswordHash); // Password hash unchanged

    const finalMembership = await db.queryOne<{ role: string; status: string }>(
      `SELECT role, status FROM organization_members WHERE user_id = $1`,
      [testUserId],
    );
    expect(finalMembership?.role).toBe('ADMIN'); // Role unchanged
    expect(finalMembership?.status).toBe('ACTIVE'); // Status unchanged
  });
});
