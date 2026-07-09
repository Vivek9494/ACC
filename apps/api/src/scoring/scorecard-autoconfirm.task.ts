import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RedisService } from '../redis/redis.service';
import { ScorecardConfirmationService } from './scorecard-confirmation.service';

const AUTO_CONFIRM_LOCK_KEY = 'cron:scorecard-auto-confirm';
const AUTO_CONFIRM_LOCK_TTL_SECONDS = 4 * 60 + 30;

/**
 * Drives the §13.1 System auto-confirm: every few minutes it locks any
 * scorecard whose 5-hour window (§23) has elapsed without a manual
 * confirmation. The scorecard read-path also runs a lazy safety-net so this is
 * not the only path.
 */
@Injectable()
export class ScorecardAutoConfirmTask {
  private readonly logger = new Logger(ScorecardAutoConfirmTask.name);

  constructor(
    private readonly confirmation: ScorecardConfirmationService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    if (!(await this.redis.acquireLock(AUTO_CONFIRM_LOCK_KEY, AUTO_CONFIRM_LOCK_TTL_SECONDS))) {
      return;
    }

    try {
      await this.confirmation.sweepAutoConfirm();
    } catch (err) {
      this.logger.error('Auto-confirm sweep failed', err as Error);
    }
  }
}
