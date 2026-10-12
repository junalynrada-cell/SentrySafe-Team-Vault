import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { loginWith2FA } from './test-auth-helper';

import { DatabaseService } from '../src/database/database.service';

describe('SentrySafe End-to-End Vault Workflow E2E', () => {
  jest.setTimeout(45000);
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    // Reset active grants to ensure test starts in clean state
    const db = app.get(DatabaseService);
    await db.query(
      `UPDATE temporary_grants SET status = 'REVOKED' WHERE status = 'ACTIVE'`,
    );
    await db.query(
      `UPDATE access_requests SET status = 'EXPIRED' WHERE status = 'PENDING'`,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Full vertical slice: Charlie requests access -> Bob approves -> Charlie active access -> Reveal fake secret -> Dana audits', async () => {
    // 1. Log in as Charlie Developer
    const charlieCookie = await loginWith2FA(app, 'developer@sentrysafe.io');
    expect(charlieCookie).toBeDefined();

    // 2. Charlie lists secrets, finds PROD_POSTGRES_MASTER
    const secretsRes = await request(app.getHttpServer())
      .get('/api/secrets')
      .set('Cookie', charlieCookie)
      .expect(200);

    const postgresSecret = secretsRes.body.find(
      (s: any) => s.name === 'PROD_POSTGRES_MASTER',
    );
    expect(postgresSecret).toBeDefined();

    // 3. Charlie attempts to reveal secret without grant -> expects 403 Forbidden
    await request(app.getHttpServer())
      .post(`/api/secrets/${postgresSecret.id}/reveal`)
      .set('Cookie', charlieCookie)
      .expect(403);

    // 4. Charlie requests 30m temporary access
    const reqRes = await request(app.getHttpServer())
      .post('/api/requests')
      .set('Cookie', charlieCookie)
      .send({
        secret_id: postgresSecret.id,
        requested_duration_minutes: 30,
        business_reason: 'Emergency database migration troubleshooting PR #412',
      })
      .expect(201);

    expect(reqRes.body.status).toBe('PENDING');
    const requestId = reqRes.body.id;

    // 5. Log in as Bob Approver
    const bobCookie = await loginWith2FA(app, 'approver@sentrysafe.io');
    expect(bobCookie).toBeDefined();

    // 6. Bob checks approval queue
    const queueRes = await request(app.getHttpServer())
      .get('/api/requests/queue')
      .set('Cookie', bobCookie)
      .expect(200);

    const pendingItem = queueRes.body.find((r: any) => r.id === requestId);
    expect(pendingItem).toBeDefined();

    // 7. Bob approves request
    const approveRes = await request(app.getHttpServer())
      .post(`/api/requests/${requestId}/approve`)
      .set('Cookie', bobCookie)
      .send({ notes: 'Approved for migration work. Follow safe procedures.' })
      .expect(201);

    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.grant_id).toBeDefined();

    // 8. Charlie checks active grants
    const activeGrantsRes = await request(app.getHttpServer())
      .get('/api/grants/active')
      .set('Cookie', charlieCookie)
      .expect(200);

    const activeGrant = activeGrantsRes.body.find(
      (g: any) => g.secret_id === postgresSecret.id,
    );
    expect(activeGrant).toBeDefined();
    expect(activeGrant.seconds_remaining).toBeGreaterThan(1700);

    // 9. Charlie reveals secret -> expects fake demo credentials
    const revealRes = await request(app.getHttpServer())
      .post(`/api/secrets/${postgresSecret.id}/reveal`)
      .set('Cookie', charlieCookie)
      .expect(201);

    expect(revealRes.body.plaintext).toContain('DEMO-POSTGRES-PASSWORD-123');
    expect(revealRes.body.credential_breakdown.password).toBe('DEMO-POSTGRES-PASSWORD-123');

    // 10. Log in as Dana Auditor
    const danaCookie = await loginWith2FA(app, 'auditor@sentrysafe.io');
    expect(danaCookie).toBeDefined();

    // 11. Dana inspects audit logs
    const auditRes = await request(app.getHttpServer())
      .get('/api/audit-logs')
      .set('Cookie', danaCookie)
      .expect(200);

    expect(auditRes.body.logs.length).toBeGreaterThan(0);
    const actions = auditRes.body.logs.map((l: any) => l.action);
    expect(actions).toContain('ACCESS_REQUEST');
    expect(actions).toContain('ACCESS_APPROVED');
    expect(actions).toContain('ACCESS_GRANTED');
    expect(actions).toContain('SECRET_REVEALED');
  }, 35000);
});
