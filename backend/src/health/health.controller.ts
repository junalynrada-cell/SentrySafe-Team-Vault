import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async getHealth() {
    try {
      await this.db.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        service: 'SentrySafe Team Vault Backend',
      };
    } catch {
      return {
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
