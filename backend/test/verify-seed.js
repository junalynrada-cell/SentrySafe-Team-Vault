const { Pool } = require('pg');
const argon2 = require('argon2');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('--- Testing Seeded Users and Password Hashes ---');
    const res = await pool.query('SELECT id, email, full_name, password_hash FROM users ORDER BY email ASC');
    for (const u of res.rows) {
      const match = await argon2.verify(u.password_hash, 'Password123!');
      const mem = await pool.query(
        'SELECT m.role, o.name FROM organization_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = $1',
        [u.id],
      );
      console.log(`User: ${u.email} (${u.full_name}) | Role: ${mem.rows[0]?.role} | Pass verify: ${match ? '✅ PASS' : '❌ FAIL'}`);
    }

    console.log('\n--- Testing Audit Logs ---');
    const logs = await pool.query('SELECT action, resource_name, status, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5');
    for (const l of logs.rows) {
      console.log(`Audit: [${l.action}] ${l.resource_name} -> ${l.status} at ${l.timestamp}`);
    }

    console.log('\n--- Testing Seeded Secrets ---');
    const secrets = await pool.query('SELECT name, environment, resource_type, masked_preview FROM secrets');
    for (const s of secrets.rows) {
      console.log(`Secret: ${s.name} [${s.environment}/${s.resource_type}] -> ${s.masked_preview}`);
    }
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await pool.end();
  }
}

run();
