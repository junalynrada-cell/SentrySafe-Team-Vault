const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetNonAdminAccounts() {
  const nonAdminEmails = ['developer@sentrysafe.io', 'approver@sentrysafe.io', 'auditor@sentrysafe.io'];

  console.log('Resetting non-Admin demo accounts to STATE A (totp_enabled = FALSE, totp_secret_encrypted = NULL)...');
  
  for (const email of nonAdminEmails) {
    const userRes = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) continue;
    const userId = userRes.rows[0].id;

    await pool.query(
      `UPDATE users 
       SET totp_enabled = FALSE, 
           totp_secret_encrypted = NULL, 
           totp_enrolled_at = NULL,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [userId]
    );

    await pool.query(`DELETE FROM backup_codes WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM pre_auth_sessions WHERE user_id = $1`, [userId]);

    console.log(`- ${email} (${userId}): Ready for 2FA enrollment`);
  }

  // Verify Admin was NOT touched
  const adminRes = await pool.query(
    `SELECT email, totp_enabled, (totp_secret_encrypted IS NOT NULL) as has_secret, totp_enrolled_at 
     FROM users WHERE email = 'admin@sentrysafe.io'`
  );
  console.log('\nAdmin status preserved:', adminRes.rows[0]);

  await pool.end();
}

resetNonAdminAccounts().catch(console.error);
