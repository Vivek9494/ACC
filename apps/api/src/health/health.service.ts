import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type DependencyCheckStatus = 'ok' | 'error';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: DependencyCheckStatus;
    redis: DependencyCheckStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.redis.ping(),
    ]);

    const checks = {
      database: database ? ('ok' as const) : ('error' as const),
      redis: redis ? ('ok' as const) : ('error' as const),
    };

    const status = checks.database === 'ok' && checks.redis === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }

  /** Throws when a dependency is down — used by orchestrators expecting HTTP 503. */
  assertHealthy(status: HealthStatus): void {
    if (status.status !== 'ok') {
      throw new ServiceUnavailableException(status);
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
