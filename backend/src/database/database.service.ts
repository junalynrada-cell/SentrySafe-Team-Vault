import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  async query<T extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, values);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, values);
    return rows.length > 0 ? rows[0] : null;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}