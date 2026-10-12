import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as speakeasy from 'speakeasy';
import { DatabaseService } from '../src/database/database.service';
import { AuthService } from '../src/auth/auth.service';

async function testFullAdminLoginFlow() {
  console.log('\n=== STEP 6: TEST REAL LOGIN FLOW ===');

  const adminEmail = 'admin@sentrysafe.io';
  const adminPassword = 'Password123!';

  // Stage 1: Call login endpoint on live NestJS server
  console.log('1. Attempting login on http://127.0.0.1:3001/api/auth/login...');
  const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const loginBody = await loginRes.json();
  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie') || ''];
  const preAuthCookie = rawCookies.find(c => c.includes('sentrysafe_pre_auth')) || '';

  console.log('  HTTP status:', loginRes.status);
  console.log('  Response body:', JSON.stringify(loginBody));
  console.log('  Pre-auth cookie received:', preAuthCookie ? 'YES' : 'NO');

  if (!loginBody.requiresTwoFactor) {
    console.error('FAILED: requiresTwoFactor is false');
    process.exit(1);
  }

  // Stage 2: Generate valid TOTP code
  // We instantiate DatabaseService to read and decrypt the secret
  const db = new DatabaseService();
  const authService = new AuthService(db, null as any);

  const user = await db.queryOne<{ totp_secret_encrypted: string }>(
    `SELECT totp_secret_encrypted FROM users WHERE email = $1`,
    [adminEmail],
  );

  if (!user?.totp_secret_encrypted) {
    console.error('FAILED: No totp_secret_encrypted for admin');
    process.exit(1);
  }

  const secret = authService.decryptTotpSecret(user.totp_secret_encrypted);
  const code = speakeasy.totp({ secret, encoding: 'base32' });
  console.log('\n2. Generated valid 6-digit TOTP code for Alice Admin.');

  // Stage 3: Call verify-2fa endpoint
  console.log('3. Attempting 2FA verification on http://127.0.0.1:3001/api/auth/verify-2fa...');
  const verifyRes = await fetch('http://127.0.0.1:3001/api/auth/verify-2fa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: preAuthCookie,
    },
    body: JSON.stringify({ code }),
  });

  const verifyBody = await verifyRes.json();
  const verifyCookies = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie() : [verifyRes.headers.get('set-cookie') || ''];
  const sessionCookie = verifyCookies.find(c => c.includes('sentrysafe_session')) || '';

  console.log('  HTTP status:', verifyRes.status);
  console.log('  Session cookie received:', sessionCookie ? 'YES' : 'NO');
  console.log('  User in response:', verifyBody.user?.email);

  // Stage 4: Call /api/auth/me with session cookie
  console.log('\n4. Attempting GET /api/auth/me with full session cookie...');
  const meRes = await fetch('http://127.0.0.1:3001/api/auth/me', {
    method: 'GET',
    headers: {
      Cookie: sessionCookie,
    },
  });

  const meBody = await meRes.json();
  console.log('  HTTP status:', meRes.status);
  console.log('  User profile:', meBody.user?.email, `(${meBody.user?.full_name})`);
  console.log('  Membership:', meBody.membership?.role, `[${meBody.membership?.status}]`);
  console.log('  Organization:', meBody.membership?.org_name);

  await db.onModuleDestroy();

  if (meRes.status === 200 && meBody.membership?.role === 'ADMIN') {
    console.log('\n✅ ALL STAGES PASSED: Database connection, Admin lookup, password verification, pre-auth, TOTP verification, session creation, and /api/auth/me are fully functional!');
  } else {
    console.error('FAILED at stage 4');
    process.exit(1);
  }
}

testFullAdminLoginFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
