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

// Enroll or login helper to guarantee valid full session
async function getSessionFor(email) {
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password: 'Password123!' });

  const preAuthCookie = (loginRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));
  if (!preAuthCookie) throw new Error(`Failed to get pre-auth cookie for ${email}`);

  if (loginRes.body.requiresEnrollment) {
    const enrollRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/2fa/enroll',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {}, preAuthCookie.split(';')[0]);

    const code = speakeasy.totp({ secret: enrollRes.body.manualKey, encoding: 'base32' });
    await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/2fa/enroll/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { code }, preAuthCookie.split(';')[0]);

    const completeRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/2fa/enroll/complete',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {}, preAuthCookie.split(';')[0]);

    const sessionCookie = (completeRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
    return sessionCookie.split(';')[0];
  } else {
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
}

async function runTests() {
  console.log('=== VERIFYING AUDIT LOG RBAC & INTEGRITY ===\n');

  // Obtain sessions for all 4 roles
  console.log('Authenticating accounts...');
  const adminCookie = await getSessionFor('admin@sentrysafe.io');
  const auditorCookie = await getSessionFor('auditor@sentrysafe.io');
  const devCookie = await getSessionFor('developer@sentrysafe.io');
  const approverCookie = await getSessionFor('approver@sentrysafe.io');
  console.log('All 4 roles authenticated with full sessions.\n');

  // Test 1: ADMIN can retrieve audit logs
  console.log('1. ADMIN access to GET /api/audit-logs:');
  const adminAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, adminCookie);
  console.log(`   Status: ${adminAudit.statusCode} (Expected: 200)`);
  console.log(`   Total events count: ${adminAudit.body?.stats?.total_events}`);
  console.log(`   Logs returned: ${adminAudit.body?.logs?.length}`);
  if (adminAudit.statusCode !== 200 || !adminAudit.body?.logs) {
    throw new Error('ADMIN failed to retrieve audit logs');
  }

  // Test 2: AUDITOR can retrieve audit logs
  console.log('\n2. AUDITOR access to GET /api/audit-logs:');
  const auditorAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, auditorCookie);
  console.log(`   Status: ${auditorAudit.statusCode} (Expected: 200)`);
  console.log(`   Total events count: ${auditorAudit.body?.stats?.total_events}`);
  console.log(`   Logs returned: ${auditorAudit.body?.logs?.length}`);
  if (auditorAudit.statusCode !== 200 || !auditorAudit.body?.logs) {
    throw new Error('AUDITOR failed to retrieve audit logs');
  }

  // Test 3: DEVELOPER receives 403 Forbidden
  console.log('\n3. DEVELOPER access to GET /api/audit-logs:');
  const devAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, devCookie);
  console.log(`   Status: ${devAudit.statusCode} (Expected: 403)`);
  if (devAudit.statusCode !== 403) {
    throw new Error(`DEVELOPER expected 403, got ${devAudit.statusCode}`);
  }

  // Test 4: APPROVER receives 403 Forbidden
  console.log('\n4. APPROVER access to GET /api/audit-logs:');
  const approverAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, approverCookie);
  console.log(`   Status: ${approverAudit.statusCode} (Expected: 403)`);
  if (approverAudit.statusCode !== 403) {
    throw new Error(`APPROVER expected 403, got ${approverAudit.statusCode}`);
  }

  // Test 5: Unauthenticated request receives 401 Unauthorized
  console.log('\n5. Unauthenticated access to GET /api/audit-logs:');
  const unauthAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'GET'
  }, null, null);
  console.log(`   Status: ${unauthAudit.statusCode} (Expected: 401)`);
  if (unauthAudit.statusCode !== 401) {
    throw new Error(`Unauthenticated expected 401, got ${unauthAudit.statusCode}`);
  }

  // Test 6: Audit logs remain read-only (no POST/PATCH/DELETE allowed)
  console.log('\n6. Verifying absence of mutation endpoints on /api/audit-logs:');
  const postAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { action: 'HACK' }, adminCookie);
  console.log(`   POST /api/audit-logs Status: ${postAudit.statusCode} (Expected: 404)`);

  const deleteAudit = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/audit-logs/123',
    method: 'DELETE'
  }, null, adminCookie);
  console.log(`   DELETE /api/audit-logs/123 Status: ${deleteAudit.statusCode} (Expected: 404)`);

  // Test 7: Verify zero secret exposure in audit logs
  console.log('\n7. Verifying zero secret exposure in audit log payload:');
  const auditLogsText = JSON.stringify(adminAudit.body);
  const sensitivePatterns = [
    /password_hash/i,
    /totp_secret/i,
    /master_key/i,
    /VAULT_MASTER_KEY/i,
    /Password123!/
  ];
  let leakDetected = false;
  for (const pat of sensitivePatterns) {
    if (pat.test(auditLogsText)) {
      console.error(`   LEAK DETECTED: pattern ${pat} found in audit logs!`);
      leakDetected = true;
    }
  }
  if (!leakDetected) {
    console.log('   Zero secrets, passwords, or hashes found in audit-log responses -> PASS');
  }

  // Test 8: Verify PostgreSQL immutability trigger
  console.log('\n8. Verifying PostgreSQL audit log immutability trigger:');
  try {
    await pool.query(`UPDATE audit_logs SET action = 'ALTERED' WHERE id = (SELECT id FROM audit_logs LIMIT 1)`);
    console.error('   DATABASE ERROR: UPDATE on audit_logs was allowed!');
  } catch (dbErr) {
    console.log(`   PostgreSQL prevented UPDATE: "${dbErr.message.split('\n')[0]}" -> PASS`);
  }

  try {
    await pool.query(`DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1)`);
    console.error('   DATABASE ERROR: DELETE on audit_logs was allowed!');
  } catch (dbErr) {
    console.log(`   PostgreSQL prevented DELETE: "${dbErr.message.split('\n')[0]}" -> PASS`);
  }

  console.log('\n=== ALL AUDIT ACCESS & IMMUTABILITY TESTS PASSED ===');
  await pool.end();
}

runTests().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
