const http = require('http');
const { Pool } = require('pg');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VAULT_MASTER_KEY = Buffer.from(
  process.env.VAULT_MASTER_KEY || '4e2f8c6b1a9d3e5f7a0b2c4d6e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f',
  'hex'
);

function decryptTotpSecret(encryptedString) {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted TOTP secret format');
  }
  const [ivB64, authTagB64, ciphertext] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
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

async function testTotpVerification() {
  const accounts = ['developer@sentrysafe.io', 'approver@sentrysafe.io', 'auditor@sentrysafe.io'];

  for (const email of accounts) {
    console.log(`\n=== Testing TOTP verification for ${email} ===`);
    
    // 1. Login
    const loginRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password: 'Password123!' });

    console.log('Login status:', loginRes.statusCode);
    const preAuthCookie = (loginRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_pre_auth='));
    console.log('Pre-auth cookie received:', Boolean(preAuthCookie));

    // 2. Fetch secret from DB
    const dbRes = await pool.query('SELECT totp_secret_encrypted FROM users WHERE email = $1', [email]);
    const encryptedSecret = dbRes.rows[0].totp_secret_encrypted;
    let plaintextSecret;
    try {
      plaintextSecret = decryptTotpSecret(encryptedSecret);
      console.log('Secret decryption: SUCCESS');
    } catch (err) {
      console.error('Secret decryption: FAILED:', err.message);
      continue;
    }

    const code = speakeasy.totp({ secret: plaintextSecret, encoding: 'base32' });
    console.log('Generated TOTP code:', code);

    // 3. Verify 2FA
    const verifyRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/verify-2fa',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { code }, preAuthCookie ? preAuthCookie.split(';')[0] : '');

    console.log('Verify-2FA status:', verifyRes.statusCode);
    console.log('Verify-2FA body:', verifyRes.body);
    const sessionCookie = (verifyRes.headers['set-cookie'] || []).find(c => c.startsWith('sentrysafe_session='));
    console.log('Session cookie received:', Boolean(sessionCookie));

    // 4. Test /api/auth/me
    if (sessionCookie) {
      const meRes = await request({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/auth/me',
        method: 'GET'
      }, null, sessionCookie.split(';')[0]);

      console.log('/api/auth/me status:', meRes.statusCode);
      console.log('/api/auth/me body safe metadata:', {
        email: meRes.body?.email,
        role: meRes.body?.role,
        status: meRes.body?.status,
        session_id: Boolean(meRes.body?.id)
      });
    }
  }

  await pool.end();
}

testTotpVerification().catch(console.error);
