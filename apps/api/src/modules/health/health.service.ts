import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { HealthResponseDto } from '@campusjob/contracts';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async checkHealth(): Promise<HealthResponseDto> {
    let dbStatus: 'up' | 'down' = 'down';
    let dbLatencyMs: number | undefined;

    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'up';
    } catch (error) {
      this.logger.error('Database healthcheck failed', error);
      dbStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      version: '1.0.0',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    };
  }
}
