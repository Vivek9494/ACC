import type { NotificationContent, NotificationSendResult, NotificationTrigger } from '@acc/types';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationLogService } from './notification-log.service';
import { PUSH_PROVIDER, type PushProvider } from './push-provider';
import { PushTokenService } from './push-token.service';

export { NotificationTrigger } from '@acc/types';

export interface NotificationPayload {
  /** User ids to notify. */
  recipientUserIds: string[];
  /** Structured context for the eventual FCM message. */
  data?: Record<string, unknown>;
}

/**
 * Single choke point for all push notifications (?17). Triggers resolve an
 * audience (see {@link NotificationAudienceService}) and hand a payload here;
 * they never talk to FCM directly. This service resolves each user's device
 * tokens, sends via the configured {@link PushProvider}, prunes tokens FCM
 * rejects, and writes a de-dupable {@link NotificationLogService} record.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
    private readonly tokens: PushTokenService,
    private readonly log: NotificationLogService,
  ) {}

  /**
   * Send a notification to a resolved set of users. Idempotent when
   * `content.dedupeKey` is provided: a second call with the same key is skipped.
   */
  async sendNotification(
    input: { userIds: string[] } & NotificationContent,
  ): Promise<NotificationSendResult> {
    const uniqueUserIds = [...new Set(input.userIds)];

    // Reserve the log row first so timed-job double-fires / retries de-dup
    // before any dispatch happens.
    const logId = await this.log.reserve({
      triggerKey: input.triggerKey,
      dedupeKey: input.dedupeKey,
      title: input.title,
      body: input.body,
      data: input.data,
      audienceSummary: input.audienceSummary,
    });

    if (logId == null) {
      this.logger.log(
        `[notify] de-duped ${input.triggerKey} (dedupeKey=${input.dedupeKey ?? ''})`,
      );
      return {
        sent: false,
        deduped: true,
        recipientUserCount: uniqueUserIds.length,
        tokenCount: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    const tokens = await this.tokens.getTokensForUsers(uniqueUserIds);

    let successCount = 0;
    let failureCount = 0;
    if (tokens.length > 0) {
      const result = await this.push.sendToTokens(tokens, {
        title: input.title,
        body: input.body,
        data: input.data,
      });
      successCount = result.successTokens.length;
      failureCount = result.invalidTokens.length + result.failedTokens.length;
      if (result.invalidTokens.length > 0) {
        await this.tokens.pruneTokens(result.invalidTokens);
      }
    }

    await this.log.finalize(logId, {
      recipientCount: uniqueUserIds.length,
      successCount,
      failureCount,
    });

    return {
      sent: true,
      recipientUserCount: uniqueUserIds.length,
      tokenCount: tokens.length,
      successCount,
      failureCount,
    };
  }

  /** Convenience wrapper: resolve an audience, then hand the ids off here. */
  async sendToAudience(
    userIds: string[],
    content: NotificationContent,
  ): Promise<NotificationSendResult> {
    return this.sendNotification({ userIds, ...content });
  }

  /**
   * @deprecated Legacy entry point used by existing trigger call sites (Phase
   * B/C will migrate these to {@link sendNotification}). Records intent only.
   */
  async notify(trigger: NotificationTrigger, payload: NotificationPayload): Promise<void> {
    this.logger.log(
      `[notify:legacy] ${trigger} ? ${payload.recipientUserIds.length} recipient(s)` +
        (payload.data ? ` ${JSON.stringify(payload.data)}` : ''),
    );
    await Promise.resolve();
  }
}
