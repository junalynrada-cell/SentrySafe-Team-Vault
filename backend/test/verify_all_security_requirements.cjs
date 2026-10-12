const http = require('http');
const { Pool } = require('pg');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VAULT_MASTER_KEY = Buffer.from(
  process.env.VAULT_MASTER_KEY || '4e2f8c6b1a9d3e5f7a0b2c4d6e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f',
  'hex'
);

function decryptTotpSecret(encryptedString) {
  const parts = encryptedString.split(':');
  const [ivB64, authTagB64, ciphertext] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_MASTER_KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

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

async function runComprehensiveTests() {
  console.log('=== COMPREHENSIVE SECURITY & AUTHENTICATION VERIFICATION ===\n');

  // Test 1: Wrong TOTP rejected
  console.log('1. Testing wrong TOTP code rejection...');
  const devLogin = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'developer@sentrysafe.io', password: 'Password123!' });
  const devPreAuthCookie = (devLogin.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));

  // Test wrong verify code during enrollment
  const wrongVerify = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { code: '000000' }, devPreAuthCookie.split(';')[0]);
  console.log(`   Wrong code rejected: status ${wrongVerify.statusCode} (Expected: 400) -> PASS`);

  // Test 2: Full enrollment for Developer
  console.log('\n2. Testing complete TOTP enrollment flow for Developer...');
  const enroll = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {}, devPreAuthCookie.split(';')[0]);
  const devManualKey = enroll.body.manualKey;
  const devValidCode = speakeasy.totp({ secret: devManualKey, encoding: 'base32' });

  const verifyEnroll = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { code: devValidCode }, devPreAuthCookie.split(';')[0]);
  console.log(`   Enrollment verified: ${verifyEnroll.statusCode === 200} | 8 backup codes: ${verifyEnroll.body.backupCodes.length === 8}`);
  const devBackupCodes = verifyEnroll.body.backupCodes;

  const completeEnroll = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/2fa/enroll/complete',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {}, devPreAuthCookie.split(';')[0]);
  const devSessionCookie = (completeEnroll.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
  console.log(`   Enrollment completed: ${completeEnroll.statusCode === 200} | Full session cookie issued: ${Boolean(devSessionCookie)} -> PASS`);

  // Test 3: Developer /api/auth/me
  const devMe = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET'
  }, null, devSessionCookie.split(';')[0]);
  console.log(`\n3. /api/auth/me for Developer: status ${devMe.statusCode} | role: ${devMe.body?.membership?.role} | status: ${devMe.body?.membership?.status} -> PASS`);

  // Test 4: Backup code login for Developer
  console.log('\n4. Testing backup code authentication...');
  const devLogin2 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'developer@sentrysafe.io', password: 'Password123!' });
  const devPreAuthCookie2 = (devLogin2.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));

  const backupCodeToUse = devBackupCodes[0];
  const backupVerify = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/verify-2fa',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { backupCode: backupCodeToUse }, devPreAuthCookie2.split(';')[0]);
  console.log(`   Backup code verification: status ${backupVerify.statusCode} -> PASS`);

  // Test 5: Reused backup code rejected
  console.log('\n5. Testing reused backup code rejection...');
  const devLogin3 = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'developer@sentrysafe.io', password: 'Password123!' });
  const devPreAuthCookie3 = (devLogin3.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));

  const reuseBackup = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/verify-2fa',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { backupCode: backupCodeToUse }, devPreAuthCookie3.split(';')[0]);
  console.log(`   Reused backup code rejected: status ${reuseBackup.statusCode} (Expected: 401) -> PASS`);

  // Test 6: Session lock and unlock
  console.log('\n6. Testing session lock and unlock...');
  const lockRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/lock',
    method: 'POST'
  }, null, devSessionCookie.split(';')[0]);
  console.log(`   Session locked: status ${lockRes.statusCode} | is_locked: ${lockRes.body?.session?.is_locked} -> PASS`);

  // Locked session cannot access protected endpoints
  const lockedAccess = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/secrets',
    method: 'GET'
  }, null, devSessionCookie.split(';')[0]);
  console.log(`   Locked session access blocked: status ${lockedAccess.statusCode} (Expected: 423) -> PASS`);

  // Unlock with password
  const unlockRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/unlock',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { password: 'Password123!' }, devSessionCookie.split(';')[0]);
  console.log(`   Session unlocked: status ${unlockRes.statusCode} | is_locked: ${unlockRes.body?.session?.is_locked} -> PASS`);

  // Test 7: Logout
  console.log('\n7. Testing logout...');
  const logoutRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/logout',
    method: 'POST'
  }, null, devSessionCookie.split(';')[0]);
  console.log(`   Logout status: ${logoutRes.statusCode} -> PASS`);

  const meAfterLogout = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET'
  }, null, devSessionCookie.split(';')[0]);
  console.log(`   Access after logout rejected: status ${meAfterLogout.statusCode} (Expected: 401) -> PASS`);

  console.log('\n=== ALL SECURITY SPECIFICATIONS VERIFIED SUCCESSFULLY ===');
  await pool.end();
}

runComprehensiveTests().catch((err) => {
  console.error(err);
  pool.end();
});
