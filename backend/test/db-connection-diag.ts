import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';

async function runDiagnostic() {
  console.log('=== STEP 1: PARSED CONNECTION METADATA (SAFE) ===');
  const dbUrl = process.env.DATABASE_URL;
  console.log('DATABASE_URL exists:', !!dbUrl);
  if (dbUrl) {
    const parsed = new URL(dbUrl);
    console.log('protocol:', parsed.protocol);
    console.log('username:', parsed.username);
    console.log('hostname:', parsed.hostname);
    console.log('port:', parsed.port);
    console.log('database:', parsed.pathname.replace('/', ''));
    console.log('ssl rejectUnauthorized: false (configured in DatabaseService)');
    console.log('connection type: Supabase Session Mode Pooler (Supavisor)');
  }

  console.log('\n=== STEP 4: REAL DATABASE CONNECTIVITY TEST (via DatabaseService) ===');
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [DatabaseModule],
  }).compile();

  const db = moduleRef.get(DatabaseService);

  // 1. SELECT 1
  const select1 = await db.query('SELECT 1 as num');
  console.log('SELECT 1:', select1.length > 0 && select1[0].num === 1 ? 'PASS' : 'FAIL');

  // 2. SELECT NOW()
  const selectNow = await db.query('SELECT NOW() as now');
  console.log('SELECT NOW():', selectNow.length > 0 && selectNow[0].now ? `PASS (${selectNow[0].now})` : 'FAIL');

  // 3. SELECT current_database()
  const selectDb = await db.query('SELECT current_database() as db');
  console.log('current_database():', selectDb.length > 0 ? `PASS (${selectDb[0].db})` : 'FAIL');

  // 4. SELECT current_user
  const selectUser = await db.query('SELECT current_user as u');
  console.log('current_user:', selectUser.length > 0 ? `PASS (${selectUser[0].u})` : 'FAIL');

  console.log('\n=== STEP 5: VERIFY ACTUAL ADMIN RECORD (via DatabaseService) ===');
  const adminEmail = 'admin@sentrysafe.io';
  const user = await db.queryOne<{
    id: string;
    email: string;
    full_name: string;
    totp_enabled: boolean;
    totp_enrolled_at: string | null;
  }>(
    `SELECT id, email, full_name, totp_enabled, totp_enrolled_at FROM users WHERE email = $1`,
    [adminEmail],
  );

  if (!user) {
    console.log('Admin account exists: NO');
  } else {
    console.log('Admin account:');
    console.log('  exists: YES');
    console.log('  email:', user.email);
    console.log('  full_name:', user.full_name);
    console.log('  totp_enabled:', user.totp_enabled ? 'TRUE' : 'FALSE');
    console.log('  totp_enrolled_at:', user.totp_enrolled_at || 'Not enrolled yet');

    const membership = await db.queryOne<{
      status: string;
      role: string;
      organization_name: string;
    }>(
      `SELECT m.status, m.role, o.name as organization_name
       FROM organization_members m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1`,
      [user.id],
    );

    if (membership) {
      console.log('  membership: YES');
      console.log('  organization:', membership.organization_name);
      console.log('  status:', membership.status);
      console.log('  role:', membership.role);
    } else {
      console.log('  membership: NO');
    }
  }

  await db.onModuleDestroy();
}

runDiagnostic().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
