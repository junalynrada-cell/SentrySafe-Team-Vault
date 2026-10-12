import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DatabaseService } from '../src/database/database.service';

async function checkAllUsers() {
  const db = new DatabaseService();

  const users = await db.query<{
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    totp_enabled: boolean;
    totp_secret_encrypted: string | null;
    totp_enrolled_at: string | null;
  }>(`SELECT id, email, full_name, is_active, totp_enabled, totp_secret_encrypted, totp_enrolled_at FROM users ORDER BY created_at ASC`);

  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    const mem = await db.queryOne<{ role: string; status: string }>(
      `SELECT role, status FROM organization_members WHERE user_id = $1`,
      [u.id],
    );
    console.log({
      id: u.id,
      email: u.email,
      name: u.full_name,
      role: mem?.role || null,
      status: mem?.status || null,
      totp_enabled: u.totp_enabled,
      has_totp_secret: Boolean(u.totp_secret_encrypted),
      enrolled_at: u.totp_enrolled_at,
    });
  }

  await db.onModuleDestroy();
}

checkAllUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
