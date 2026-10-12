import request from 'supertest';
import * as speakeasy from 'speakeasy';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../src/database/database.service';
import { AuthService } from '../src/auth/auth.service';

export async function loginWith2FA(
  app: INestApplication,
  email: string,
  password = 'Password123!',
): Promise<string> {
  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  const preAuthCookie = loginRes.headers['set-cookie'];

  if (loginRes.body.requiresEnrollment) {
    const enrollRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll')
      .set('Cookie', preAuthCookie);
    const secret = enrollRes.body?.manualKey;
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/verify')
      .set('Cookie', preAuthCookie)
      .send({ code });
    const completeRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/enroll/complete')
      .set('Cookie', preAuthCookie);
    const setCookie = completeRes.headers['set-cookie'] || [];
    const session = setCookie.find((c: string) => c.startsWith('sentrysafe_session='));
    return session ? session.split(';')[0] : setCookie[0];
  } else {
    const db = app.get(DatabaseService);
    const authService = app.get(AuthService);
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
    const setCookie = verifyRes.headers['set-cookie'] || [];
    const session = setCookie.find((c: string) => c.startsWith('sentrysafe_session='));
    return session ? session.split(';')[0] : setCookie[0];
  }
}
