const http = require('http');
const { Pool } = require('pg');
const speakeasy = require('speakeasy');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function request(options, postData, cookie) {
  return new Promise((resolve, reject) => {
    if (cookie) {
      options.headers = options.headers || {};
      options.headers['Cookie'] = cookie;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? (function() { try { return JSON.parse(data); } catch { return data; } })() : null
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runRoleTest(role, email) {
  console.log(`\n==================================================`);
  console.log(`TESTING EXISTING ACCOUNT 2FA MIGRATION: ${role} (${email})`);
  console.log(`==================================================`);

  // Step 1: Inspect user & reset TOTP to simulate un-enrolled existing account
  const userBefore = await pool.query(
    `SELECT u.id, u.email, u.password_hash, m.role, m.status 
     FROM users u 
     LEFT JOIN organization_members m ON m.user_id = u.id 
     WHERE u.email = $1`,
    [email]
  );
  if (userBefore.rows.length === 0) {
    throw new Error(`User not found: ${email}`);
  }
  const originalUser = userBefore.rows[0];
  console.log(`1. User exists: YES | Role: ${originalUser.role} | Status: ${originalUser.status}`);

  // Set TOTP to FALSE/NULL (State A) to allow initial enrollment
  await pool.query(
    `UPDATE users SET totp_enabled = FALSE, totp_secret_encrypted = NULL, totp_enrolled_at = NULL WHERE id = $1`,
    [originalUser.id]
  );
  await pool.query(`DELETE FROM backup_codes WHERE user_id = $1`, [originalUser.id]);
  await pool.query(`DELETE FROM pre_auth_sessions WHERE user_id = $1`, [originalUser.id]);

  // Step 2: Login with password
  const login1 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password: 'Password123!' });

  console.log(`2. Login: status ${login1.statusCode} | requiresTwoFactor: ${login1.body?.requiresTwoFactor} | requiresEnrollment: ${login1.body?.requiresEnrollment}`);
  if (!login1.body?.requiresEnrollment) {
    throw new Error(`Expected requiresEnrollment: true, got ${login1.body?.requiresEnrollment}`);
  }
  const preAuthCookie1 = (login1.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));
  if (!preAuthCookie1) {
    throw new Error('Pre-auth cookie not set on login');
  }
  console.log('   Pre-auth cookie received: YES');

  // Step 3: Initiate TOTP enrollment
  const enrollRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {}, preAuthCookie1.split(';')[0]);

  console.log(`3. Enroll 2FA: status ${enrollRes.statusCode} | manualKey exists: ${Boolean(enrollRes.body?.manualKey)} | qrCodeUrl exists: ${Boolean(enrollRes.body?.qrCodeUrl)}`);
  const manualKey = enrollRes.body?.manualKey;
  if (!manualKey) {
    throw new Error('manualKey missing from enroll response');
  }

  // Step 4: Generate 6-digit TOTP code and verify enrollment
  const totpCode = speakeasy.totp({ secret: manualKey, encoding: 'base32' });
  const verifyEnrollRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { code: totpCode }, preAuthCookie1.split(';')[0]);

  console.log(`4. Verify Enrollment: status ${verifyEnrollRes.statusCode} | backupCodes count: ${verifyEnrollRes.body?.backupCodes?.length}`);
  if (!verifyEnrollRes.body?.backupCodes || verifyEnrollRes.body.backupCodes.length !== 8) {
    throw new Error('Failed to generate 8 backup codes');
  }

  // Step 5: Complete enrollment (acknowledge backup codes)
  const completeRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll/complete',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {}, preAuthCookie1.split(';')[0]);

  console.log(`5. Complete Enrollment: status ${completeRes.statusCode}`);
  const sessionCookie1 = (completeRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
  if (!sessionCookie1) {
    throw new Error('Session cookie not set after enrollment complete');
  }
  console.log('   Full session cookie received: YES');

  // Step 6: Test /api/auth/me with the issued session
  const meRes1 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET'
  }, null, sessionCookie1.split(';')[0]);

  console.log(`6. GET /api/auth/me: status ${meRes1.statusCode} | role: ${meRes1.body?.membership?.role} | status: ${meRes1.body?.membership?.status}`);
  if (meRes1.body?.membership?.role !== role) {
    throw new Error(`Role mismatch: expected ${role}, got ${meRes1.body?.membership?.role}`);
  }

  // Step 7: Second login (Now enrolled — State B)
  const login2 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password: 'Password123!' });

  console.log(`7. Second Login: status ${login2.statusCode} | requiresTwoFactor: ${login2.body?.requiresTwoFactor} | requiresEnrollment: ${login2.body?.requiresEnrollment}`);
  if (login2.body?.requiresEnrollment !== false) {
    throw new Error(`Expected requiresEnrollment: false on second login, got ${login2.body?.requiresEnrollment}`);
  }
  const preAuthCookie2 = (login2.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));

  // Step 8: Direct TOTP verification
  const totpCode2 = speakeasy.totp({ secret: manualKey, encoding: 'base32' });
  const verify2faRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/verify-2fa',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { code: totpCode2 }, preAuthCookie2.split(';')[0]);

  console.log(`8. Verify 2FA: status ${verify2faRes.statusCode}`);
  const sessionCookie2 = (verify2faRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
  if (!sessionCookie2) {
    throw new Error('Session cookie not set after direct verify-2fa');
  }

  // Step 9: Verify /api/auth/me on second login
  const meRes2 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET'
  }, null, sessionCookie2.split(';')[0]);

  console.log(`9. GET /api/auth/me (second login): status ${meRes2.statusCode} | role: ${meRes2.body?.membership?.role}`);

  // Step 10: Verify DB consistency (password hash, user id, membership preserved)
  const userAfter = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.totp_enabled, (u.totp_secret_encrypted IS NOT NULL) as has_secret, m.role, m.status 
     FROM users u 
     LEFT JOIN organization_members m ON m.user_id = u.id 
     WHERE u.email = $1`,
    [email]
  );
  const finalUser = userAfter.rows[0];
  console.log(`10. Verification:
    - User ID unchanged: ${finalUser.id === originalUser.id}
    - Password hash unchanged: ${finalUser.password_hash === originalUser.password_hash}
    - Role unchanged: ${finalUser.role === role}
    - TOTP enabled: ${finalUser.totp_enabled}
    - TOTP secret exists: ${finalUser.has_secret}
    - Status: ${finalUser.status}`);
  console.log(`>>> RESULT FOR ${role}: PASS\n`);
}

async function main() {
  const roles = [
    { role: 'DEVELOPER', email: 'developer@sentrysafe.io' },
    { role: 'APPROVER', email: 'approver@sentrysafe.io' },
    { role: 'AUDITOR', email: 'auditor@sentrysafe.io' },
    { role: 'ADMIN', email: 'admin@sentrysafe.io' }
  ];

  for (const r of roles) {
    await runRoleTest(r.role, r.email);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  pool.end();
  process.exit(1);
});
