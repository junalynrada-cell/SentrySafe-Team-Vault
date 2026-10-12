import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import { DatabaseService } from '../src/database/database.service';
import { AuthService } from '../src/auth/auth.service';

const ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@sentrysafe.io', password: 'Password123!' },
  { role: 'DEVELOPER', email: 'developer@sentrysafe.io', password: 'Password123!' },
  { role: 'APPROVER', email: 'approver@sentrysafe.io', password: 'Password123!' },
  { role: 'AUDITOR', email: 'auditor@sentrysafe.io', password: 'Password123!' },
];

async function main() {
  const db = new DatabaseService();
  const authService = new AuthService(db, null as any);

  console.log('============================================================');
  console.log('1. DATABASE COMPARISON FOR FOUR DEMO ACCOUNTS');
  console.log('============================================================\n');

  for (const acc of ACCOUNTS) {
    const user = await db.queryOne<{
      id: string;
      email: string;
      full_name: string;
      password_hash: string;
      totp_enabled: boolean;
      totp_secret_encrypted: string | null;
      totp_enrolled_at: string | null;
    }>(
      `SELECT id, email, full_name, password_hash, totp_enabled, totp_secret_encrypted, totp_enrolled_at 
       FROM users WHERE email = $1`,
      [acc.email],
    );

    if (!user) {
      console.log(`[${acc.role}] ${acc.email}: USER NOT FOUND IN DB!`);
      continue;
    }

    const membership = await db.queryOne<{
      id: string;
      org_id: string;
      role: string;
      status: string;
      org_name: string;
    }>(
      `SELECT m.id, m.org_id, m.role, m.status, o.name as org_name
       FROM organization_members m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1`,
      [user.id],
    );

    let passOk = false;
    try {
      passOk = await argon2.verify(user.password_hash, acc.password);
    } catch (e: any) {
      console.log(`[${acc.role}] Password verify error:`, e.message);
    }

    const backupCount = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM backup_codes WHERE user_id = $1`,
      [user.id],
    );

    console.log(`Account: ${acc.role} (${acc.email})`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Full Name: ${user.full_name}`);
    console.log(`  Password Match (Password123!): ${passOk ? 'PASS' : 'FAIL'}`);
    console.log(`  Membership Exists: ${membership ? 'YES' : 'NO'}`);
    console.log(`  Role in DB: ${membership?.role}`);
    console.log(`  Status in DB: ${membership?.status}`);
    console.log(`  totp_enabled: ${user.totp_enabled}`);
    console.log(`  totp_secret_encrypted exists: ${Boolean(user.totp_secret_encrypted)}`);
    console.log(`  totp_enrolled_at: ${user.totp_enrolled_at}`);
    console.log(`  backup_codes count: ${backupCount[0].count}`);
    console.log('------------------------------------------------------------');
  }

  console.log('\n============================================================');
  console.log('2. LIVE HTTP LOGIN TRACE (on http://127.0.0.1:3001)');
  console.log('============================================================\n');

  for (const acc of ACCOUNTS) {
    console.log(`Tracing: ${acc.role} (${acc.email})`);
    try {
      const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });

      const loginBody = await loginRes.json();
      const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie') || ''];
      const preAuthCookie = rawCookies.find(c => c.includes('sentrysafe_pre_auth')) || '';

      console.log(`  POST /api/auth/login Status: ${loginRes.status}`);
      console.log(`  Response: ${JSON.stringify(loginBody)}`);
      console.log(`  Pre-auth Cookie: ${preAuthCookie ? 'RECEIVED' : 'NONE'}`);

      if (loginBody.requiresEnrollment) {
        console.log(`  -> Account requires TOTP Enrollment (First-time 2FA Setup)`);
        const enrollRes = await fetch('http://127.0.0.1:3001/api/auth/2fa/enroll', {
          method: 'POST',
          headers: { Cookie: preAuthCookie },
        });
        const enrollBody = await enrollRes.json();
        console.log(`  POST /2fa/enroll Status: ${enrollRes.status}, QR Code received: ${Boolean(enrollBody.qrCodeUrl)}`);

        const validCode = speakeasy.totp({ secret: enrollBody.manualKey, encoding: 'base32' });
        const verifyEnroll = await fetch('http://127.0.0.1:3001/api/auth/2fa/enroll/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: preAuthCookie },
          body: JSON.stringify({ code: validCode }),
        });
        const verifyEnrollBody = await verifyEnroll.json();
        console.log(`  POST /2fa/enroll/verify Status: ${verifyEnroll.status}, Backup Codes count: ${verifyEnrollBody.backupCodes?.length}`);

        const completeRes = await fetch('http://127.0.0.1:3001/api/auth/2fa/enroll/complete', {
          method: 'POST',
          headers: { Cookie: preAuthCookie },
        });
        const completeCookies = completeRes.headers.getSetCookie ? completeRes.headers.getSetCookie() : [completeRes.headers.get('set-cookie') || ''];
        const sessionCookie = completeCookies.find(c => c.includes('sentrysafe_session')) || '';
        console.log(`  POST /2fa/enroll/complete Status: ${completeRes.status}, Session Cookie: ${sessionCookie ? 'RECEIVED' : 'NONE'}`);

        const meRes = await fetch('http://127.0.0.1:3001/api/auth/me', {
          headers: { Cookie: sessionCookie },
        });
        const meBody = await meRes.json();
        console.log(`  GET /api/auth/me Status: ${meRes.status}, Role: ${meBody.membership?.role}, Status: ${meBody.membership?.status}`);
      } else {
        console.log(`  -> Account has TOTP enabled in DB, verifying 6-digit code...`);
        const userRow = await db.queryOne<{ totp_secret_encrypted: string }>(
          `SELECT totp_secret_encrypted FROM users WHERE email = $1`,
          [acc.email],
        );
        const secret = authService.decryptTotpSecret(userRow!.totp_secret_encrypted);
        const code = speakeasy.totp({ secret, encoding: 'base32' });

        const verifyRes = await fetch('http://127.0.0.1:3001/api/auth/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: preAuthCookie },
          body: JSON.stringify({ code }),
        });
        const verifyCookies = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie() : [verifyRes.headers.get('set-cookie') || ''];
        const sessionCookie = verifyCookies.find(c => c.includes('sentrysafe_session')) || '';
        console.log(`  POST /api/auth/verify-2fa Status: ${verifyRes.status}, Session Cookie: ${sessionCookie ? 'RECEIVED' : 'NONE'}`);

        const meRes = await fetch('http://127.0.0.1:3001/api/auth/me', {
          headers: { Cookie: sessionCookie },
        });
        const meBody = await meRes.json();
        console.log(`  GET /api/auth/me Status: ${meRes.status}, Role: ${meBody.membership?.role}, Status: ${meBody.membership?.status}`);
      }
    } catch (err: any) {
      console.log(`  ERROR:`, err.message);
    }
    console.log('------------------------------------------------------------');
  }

  await db.onModuleDestroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
