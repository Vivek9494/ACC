import { DEFAULT_VENUE_TIMEZONE } from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationTimedJobsService } from './notification-timed-jobs.service';

/**
 * Cron entry points for the §17 Phase C TIMED notification triggers. Two
 * cadences:
 *
 * - **Daily 10:00 AM Eastern** (`{ timeZone: DEFAULT_VENUE_TIMEZONE }` so "10 AM"
 *   is 10 AM Eastern regardless of the server's UTC clock; `America/Toronto`
 *   handles EST/EDT automatically): poll reminders (#9), day-before match
 *   reminders (#10), birthdays (#13).
 * - **Every minute** (UTC instant math, no zone needed): the "~10 minutes before
 *   a stored close time" checks — registration closing (#11), video-upload
 *   closing (#12), and the deferred registration-open event.
 *
 * All jobs resolve audiences via {@link NotificationAudienceService} and
 * dispatch through {@link NotificationsService} with a `dedupeKey`, so a
 * double-fire is idempotent.
 *
 * DEPLOYMENT NOTE: `@nestjs/schedule` runs in-process with no distributed lock.
 * On a single-instance API (current shape) this is fine. If the API is ever
 * scaled horizontally, every instance will fire the cron — add a single-runner
 * guard (Redis/Postgres advisory lock) before then. The notification log's
 * `dedupeKey` also protects against duplicate delivery.
 */
@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly timedJobs: NotificationTimedJobsService) {}

  /** Daily digest of the 10:00 AM Eastern triggers (#9, #10, #13). */
  @Cron('0 10 * * *', {
    name: 'notification-daily-morning',
    timeZone: DEFAULT_VENUE_TIMEZONE,
  })
  async runDailyMorning(): Promise<void> {
    try {
      await this.timedJobs.runDailyMorningJobs();
    } catch (err) {
      this.logger.error('Daily 10 AM notification jobs failed', err as Error);
    }
  }

  /** Minute check for the "~10 min before close" triggers (#11, #12, reg-open). */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'notification-close-window' })
  async runCloseWindowChecks(): Promise<void> {
    try {
      await this.timedJobs.runCloseWindowChecks();
    } catch (err) {
      this.logger.error('Close-window notification checks failed', err as Error);
    }
  }
}
