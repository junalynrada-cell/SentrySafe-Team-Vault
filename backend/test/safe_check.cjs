const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const usersRes = await pool.query(`
    SELECT u.id, u.email, 
           (u.password_hash IS NOT NULL) as has_password,
           u.totp_enabled,
           (u.totp_secret_encrypted IS NOT NULL) as has_totp_secret,
           u.totp_enrolled_at,
           m.role, m.status, m.removed_at
    FROM users u
    LEFT JOIN organization_members m ON m.user_id = u.id
    WHERE u.email IN ('admin@sentrysafe.io', 'developer@sentrysafe.io', 'approver@sentrysafe.io', 'auditor@sentrysafe.io')
    ORDER BY u.email;
  `);

  console.log('--- SAFE METADATA REPORT ---');
  for (const row of usersRes.rows) {
    console.log(JSON.stringify({
      email: row.email,
      id: row.id,
      has_password: row.has_password,
      totp_enabled: row.totp_enabled,
      has_totp_secret: row.has_totp_secret,
      totp_enrolled_at: row.totp_enrolled_at,
      role: row.role,
      status: row.status,
      removed_at: row.removed_at
    }, null, 2));
  }

  const preAuthRes = await pool.query(`
    SELECT user_id, count(*), max(expires_at) as latest_expires, sum(case when consumed_at is not null then 1 else 0 end) as consumed_count
    FROM pre_auth_sessions
    GROUP BY user_id;
  `);
  console.log('\n--- PRE AUTH SESSIONS SUMMARY ---');
  console.log(preAuthRes.rows);

  const backupRes = await pool.query(`
    SELECT user_id, count(*) as code_count, sum(case when used_at is not null then 1 else 0 end) as used_count
    FROM backup_codes
    GROUP BY user_id;
  `);
  console.log('\n--- BACKUP CODES SUMMARY ---');
  console.log(backupRes.rows);

  const colsRes = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'sessions'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- SESSIONS COLUMNS ---');
  console.log(colsRes.rows);

  const sessionsRes = await pool.query(`
    SELECT user_id, count(*) as session_count, max(expires_at) as latest_expires, sum(case when is_revoked = true then 1 else 0 end) as revoked_count
    FROM sessions
    GROUP BY user_id;
  `);
  console.log('\n--- SESSIONS SUMMARY ---');
  console.log(sessionsRes.rows);

  await pool.end();
}

check().catch(console.error);
