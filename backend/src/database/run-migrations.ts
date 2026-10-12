import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigrations() {
  console.log('🚀 Starting database migrations for SentrySafe Team Vault...');
  const client = await pool.connect();

  try {
    // 1. Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(100) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read migration files
    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration file(s) in ${migrationsDir}`);

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');

      // Check if already applied
      const checkRes = await client.query(
        'SELECT id FROM schema_migrations WHERE version = $1',
        [version],
      );

      if (checkRes.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`⚡ Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        console.log(`✅ Successfully applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed on ${file}:`, err);
        throw err;
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
