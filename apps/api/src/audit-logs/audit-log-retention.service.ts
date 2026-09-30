import { AUDIT_LOG_RETENTION_DAYS, DEFAULT_VENUE_TIMEZONE } from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const RETENTION_LOCK_KEY = 'cron:audit-log-retention';
const RETENTION_LOCK_TTL_SECONDS = 30 * 60;
const DELETE_BATCH_SIZE = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily purge of audit-log entries past {@link AUDIT_LOG_RETENTION_DAYS}. Touches the AuditLog table only. */
@Injectable()
export class AuditLogRetentionService {
  private readonly logger = new Logger(AuditLogRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('30 3 * * *', { name: 'audit-log-retention', timeZone: DEFAULT_VENUE_TIMEZONE })
  async runDaily(): Promise<void> {
    if (!(await this.redis.acquireLock(RETENTION_LOCK_KEY, RETENTION_LOCK_TTL_SECONDS))) {
      return;
    }
    try {
      const deleted = await this.purgeOlderThan(new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * DAY_MS));
      this.logger.log(`Audit-log retention removed ${deleted} entries`);
    } catch (err) {
      this.logger.error('Audit-log retention failed', err as Error);
    }
  }

  /** Deletes entries created before `cutoff` in id batches; returns the number removed. */
  async purgeOlderThan(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
      });
      if (batch.length === 0) {
        return total;
      }
      const { count } = await this.prisma.auditLog.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      });
      total += count;
      if (batch.length < DELETE_BATCH_SIZE) {
        return total;
      }
    }
  }
}
