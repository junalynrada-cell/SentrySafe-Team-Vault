import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DatabaseService } from '../src/database/database.service';

async function resetAdminForUserEnrollment() {
  const db = new DatabaseService();

  const admin = await db.queryOne<{ id: string; email: string; full_name: string }>(
    `SELECT id, email, full_name FROM users WHERE email = 'admin@sentrysafe.io'`,
  );

  if (!admin) {
    console.error('Admin user not found!');
    process.exit(1);
  }

  await db.query(
    `UPDATE users 
     SET totp_enabled = FALSE, 
         totp_secret_encrypted = NULL, 
         totp_enrolled_at = NULL,
         failed_login_attempts = 0,
         locked_until = NULL
     WHERE id = $1`,
    [admin.id],
  );

  await db.query(`DELETE FROM backup_codes WHERE user_id = $1`, [admin.id]);
  await db.query(`DELETE FROM pre_auth_sessions WHERE user_id = $1`, [admin.id]);

  console.log(`Admin account [${admin.email}] (${admin.id}) is now set to totp_enabled = FALSE.`);
  console.log('Ready for the human user to enroll Google Authenticator from their browser!');

  await db.onModuleDestroy();
}

resetAdminForUserEnrollment().catch(err => {
  console.error(err);
  process.exit(1);
});
