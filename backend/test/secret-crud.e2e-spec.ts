import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { loginWith2FA } from './test-auth-helper';

describe('Admin Secret CRUD (Update & Delete) E2E', () => {
  let app: INestApplication;
  let adminCookie: any;
  let developerCookie: any;
  let approverCookie: any;
  let auditorCookie: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    // Login Alice Admin
    adminCookie = await loginWith2FA(app, 'admin@sentrysafe.io');

    // Login Charlie Developer
    developerCookie = await loginWith2FA(app, 'developer@sentrysafe.io');

    // Login Bob Approver
    approverCookie = await loginWith2FA(app, 'approver@sentrysafe.io');

    // Login Dana Auditor
    auditorCookie = await loginWith2FA(app, 'auditor@sentrysafe.io');
  }, 40000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Enforces RBAC and full lifecycle for Secret UPDATE and DELETE', async () => {
    // 1. Admin creates a new secret for testing
    const createRes = await request(app.getHttpServer())
      .post('/api/secrets')
      .set('Cookie', adminCookie)
      .send({
        name: 'TEST_CRUD_SECRET_TEMP',
        description: 'Initial secret description',
        resource_type: 'API_KEY',
        environment: 'DEVELOPMENT',
        owner_team: 'Security Team',
        requires_approval: true,
        access_level: 'CONFIDENTIAL',
        tags: ['test', 'initial'],
        plaintext_value: 'initial-super-secret-12345',
      })
      .expect(201);

    const secretId = createRes.body.id;
    expect(secretId).toBeDefined();
    expect(createRes.body.name).toBe('TEST_CRUD_SECRET_TEMP');

    // 2. Non-admin roles (Developer, Approver, Auditor) cannot UPDATE the secret
    await request(app.getHttpServer())
      .patch(`/api/secrets/${secretId}`)
      .set('Cookie', developerCookie)
      .send({ description: 'Hacked by developer' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/secrets/${secretId}`)
      .set('Cookie', approverCookie)
      .send({ description: 'Hacked by approver' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/secrets/${secretId}`)
      .set('Cookie', auditorCookie)
      .send({ description: 'Hacked by auditor' })
      .expect(403);

    // 3. Non-admin roles cannot DELETE the secret
    await request(app.getHttpServer())
      .delete(`/api/secrets/${secretId}`)
      .set('Cookie', developerCookie)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/secrets/${secretId}`)
      .set('Cookie', approverCookie)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/secrets/${secretId}`)
      .set('Cookie', auditorCookie)
      .expect(403);

    // 4. Admin updates metadata (without changing plaintext)
    const updateMetaRes = await request(app.getHttpServer())
      .patch(`/api/secrets/${secretId}`)
      .set('Cookie', adminCookie)
      .send({
        description: 'Updated secret description by admin',
        owner_team: 'DevSecOps Team',
        tags: ['test', 'updated'],
      })
      .expect(200);

    expect(updateMetaRes.body.id).toBe(secretId);
    expect(updateMetaRes.body.description).toBe('Updated secret description by admin');
    expect(updateMetaRes.body.owner_team).toBe('DevSecOps Team');
    expect(updateMetaRes.body.tags).toEqual(['test', 'updated']);

    // 5. Admin updates plaintext value (rotation)
    const updateValRes = await request(app.getHttpServer())
      .patch(`/api/secrets/${secretId}`)
      .set('Cookie', adminCookie)
      .send({
        plaintext_value: 'rotated-new-secret-value-99999',
      })
      .expect(200);

    expect(updateValRes.body.id).toBe(secretId);
    expect(updateValRes.body.last_rotated_at).toBeDefined();

    // 6. Developer requests access
    const reqRes = await request(app.getHttpServer())
      .post('/api/requests')
      .set('Cookie', developerCookie)
      .send({
        secret_id: secretId,
        requested_duration_minutes: 15,
        business_reason: 'Testing grant revocation on secret deletion',
      })
      .expect(201);

    const requestId = reqRes.body.id;

    // 7. Approver approves request -> creates active grant
    const approveRes = await request(app.getHttpServer())
      .post(`/api/requests/${requestId}/approve`)
      .set('Cookie', approverCookie)
      .send({ notes: 'Approved for delete test' })
      .expect(201);

    expect(approveRes.body.success).toBe(true);

    // Verify Developer has active grant
    const activeGrantsBefore = await request(app.getHttpServer())
      .get('/api/grants/active')
      .set('Cookie', developerCookie)
      .expect(200);

    const devGrant = activeGrantsBefore.body.find((g: any) => g.secret_id === secretId);
    expect(devGrant).toBeDefined();

    // 8. Admin DELETES secret -> expects 204 No Content
    const delRes = await request(app.getHttpServer())
      .delete(`/api/secrets/${secretId}`)
      .set('Cookie', adminCookie)
      .expect(204);

    expect(delRes.body).toEqual({});

    // 9. Verify secret is gone from secrets list
    const listRes = await request(app.getHttpServer())
      .get('/api/secrets')
      .set('Cookie', adminCookie)
      .expect(200);

    const deletedInList = listRes.body.find((s: any) => s.id === secretId);
    expect(deletedInList).toBeUndefined();

    // 10. Verify Developer active grants no longer contains the deleted secret
    const activeGrantsAfter = await request(app.getHttpServer())
      .get('/api/grants/active')
      .set('Cookie', developerCookie)
      .expect(200);

    const devGrantAfter = activeGrantsAfter.body.find((g: any) => g.secret_id === secretId);
    expect(devGrantAfter).toBeUndefined();

    // 11. Verify reveal returns 404 (or 403)
    await request(app.getHttpServer())
      .post(`/api/secrets/${secretId}/reveal`)
      .set('Cookie', developerCookie)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    // 12. Auditor checks audit logs for SECRET_UPDATED, ACCESS_REVOKED, and SECRET_DELETED
    const auditRes = await request(app.getHttpServer())
      .get('/api/audit-logs')
      .set('Cookie', auditorCookie)
      .expect(200);

    const actions = auditRes.body.logs.map((l: any) => l.action);
    expect(actions).toContain('SECRET_UPDATED');
    expect(actions).toContain('ACCESS_REVOKED');
    expect(actions).toContain('SECRET_DELETED');
  }, 40000);
});
