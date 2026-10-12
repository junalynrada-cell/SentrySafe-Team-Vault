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

async function getSessionForUser(email) {
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password: 'Password123!' });

  const preAuthCookie = (loginRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));
  const dbRes = await pool.query('SELECT totp_secret_encrypted FROM users WHERE email = $1', [email]);
  const plaintextSecret = decryptTotpSecret(dbRes.rows[0].totp_secret_encrypted);
  const code = speakeasy.totp({ secret: plaintextSecret, encoding: 'base32' });

  const verifyRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/verify-2fa',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { code }, preAuthCookie.split(';')[0]);

  const sessionCookie = (verifyRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
  return sessionCookie.split(';')[0];
}

async function testRbac() {
  console.log('=== TESTING RBAC PERMISSION MATRIX ===\n');

  // Obtain sessions for all 4 roles
  const adminCookie = await getSessionForUser('admin@sentrysafe.io');
  const devCookie = await getSessionForUser('developer@sentrysafe.io');
  const approverCookie = await getSessionForUser('approver@sentrysafe.io');
  const auditorCookie = await getSessionForUser('auditor@sentrysafe.io');

  console.log('1. Developer cannot access Admin-only management endpoints (GET /api/members)');
  const devMembers = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/members',
    method: 'GET'
  }, null, devCookie);
  console.log(`   Developer GET /api/members -> Status: ${devMembers.statusCode} (Expected: 403)`);

  const adminMembers = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/members',
    method: 'GET'
  }, null, adminCookie);
  console.log(`   Admin GET /api/members -> Status: ${adminMembers.statusCode} (Expected: 200)`);

  console.log('\n2. Approver cannot modify secrets (POST /api/secrets) or manage members (GET /api/members)');
  const approverCreateSecret = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/secrets',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Test Secret', environment: 'DEVELOPMENT', resourceType: 'API_KEY', secretValue: 'test1234' }, approverCookie);
  console.log(`   Approver POST /api/secrets -> Status: ${approverCreateSecret.statusCode} (Expected: 403)`);

  const approverMembers = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/members',
    method: 'GET'
  }, null, approverCookie);
  console.log(`   Approver GET /api/members -> Status: ${approverMembers.statusCode} (Expected: 403)`);

  console.log('\n3. Auditor cannot modify secrets (POST /api/secrets) or modify audit records');
  const auditorCreateSecret = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/secrets',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Test Secret', environment: 'DEVELOPMENT', resourceType: 'API_KEY', secretValue: 'test1234' }, auditorCookie);
  console.log(`   Auditor POST /api/secrets -> Status: ${auditorCreateSecret.statusCode} (Expected: 403)`);

  const auditorAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, auditorCookie);
  console.log(`   Auditor GET /api/audit-logs -> Status: ${auditorAudit.statusCode} (Expected: 200)`);

  console.log('\n4. Admin does not automatically become an Approver (GET /api/requests/queue)');
  const adminQueue = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/requests/queue',
    method: 'GET'
  }, null, adminCookie);
  console.log(`   Admin GET /api/requests/queue -> Status: ${adminQueue.statusCode} (Expected: 403)`);

  const approverQueue = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/requests/queue',
    method: 'GET'
  }, null, approverCookie);
  console.log(`   Approver GET /api/requests/queue -> Status: ${approverQueue.statusCode} (Expected: 200)`);

  console.log('\n=== ALL RBAC CHECKS COMPLETED ===');
  await pool.end();
}

testRbac().catch((err) => {
  console.error(err);
  pool.end();
});
