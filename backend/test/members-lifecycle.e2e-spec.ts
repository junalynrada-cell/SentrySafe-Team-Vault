import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { loginWith2FA } from './test-auth-helper';

describe('Organization Membership Lifecycle E2E', () => {
  jest.setTimeout(40000);
  let app: INestApplication;
  let adminCookie: string;
  const uniqueId = Date.now();
  const testEmail = `candidate.${uniqueId}@sentrysafe.test`;
  const testPassword = 'SecurePassword123!';
  let createdMemberId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    // Login as Admin
    adminCookie = await loginWith2FA(app, 'admin@sentrysafe.io');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. POST /api/auth/signup - should register new user with PENDING status and NULL role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Jordan Candidate',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('2. POST /api/auth/login - PENDING user should login with status PENDING and role null', async () => {
    const pendingCookie = await loginWith2FA(app, testEmail, testPassword);

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', pendingCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.membership.status).toBe('PENDING');
    expect(meRes.body.membership.role).toBeNull();

    // PENDING user attempting to access role-protected endpoint should be blocked with 403
    const forbiddenRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', pendingCookie);

    expect(forbiddenRes.status).toBe(403);
  });

  it('3. GET /api/members - Admin should see PENDING user in member list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const found = res.body.find((m: any) => m.email === testEmail);
    expect(found).toBeDefined();
    expect(found.status).toBe('PENDING');
    expect(found.role).toBeNull();
    createdMemberId = found.id;
  });

  it('4. POST /api/members/:id/approve - Admin should approve pending user with DEVELOPER role', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/members/${createdMemberId}/approve`)
      .set('Cookie', adminCookie)
      .send({ role: 'DEVELOPER' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.role).toBe('DEVELOPER');
  });

  it('5. POST /api/auth/login - Approved user should now have ACTIVE status and DEVELOPER role', async () => {
    const activeCookie = await loginWith2FA(app, testEmail, testPassword);

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', activeCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.membership.status).toBe('ACTIVE');
    expect(meRes.body.membership.role).toBe('DEVELOPER');

    // Can access secrets as developer
    const secretsRes = await request(app.getHttpServer())
      .get('/api/secrets')
      .set('Cookie', activeCookie);

    expect(secretsRes.status).toBe(200);
  });

  it('6. DELETE /api/members/:id - Admin should soft-remove member', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/members/${createdMemberId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify member list now shows REMOVED status and removed_at
    const listRes = await request(app.getHttpServer())
      .get('/api/members')
      .set('Cookie', adminCookie);

    const removed = listRes.body.find((m: any) => m.id === createdMemberId);
    expect(removed).toBeDefined();
    expect(removed.status).toBe('REMOVED');
    expect(removed.removed_at).toBeDefined();
  });

  it('7. POST /api/members/:id/restore - Admin should restore removed member with AUDITOR role', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/members/${createdMemberId}/restore`)
      .set('Cookie', adminCookie)
      .send({ role: 'AUDITOR' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.role).toBe('AUDITOR');
  });
});
