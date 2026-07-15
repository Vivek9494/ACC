import type { NotificationContent, NotificationSendResult } from '@acc/types';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationLogService } from './notification-log.service';
import { PUSH_PROVIDER, type PushProvider } from './push-provider';
import { PushTokenService } from './push-token.service';

/**
 * Notification triggers (?17.1). These map 1:1 to the spec's trigger list and
 * the ?6.4 mid-tournament edit events. (Retained for existing call sites; new
 * sends use {@link NotificationsService.sendNotification} with a `triggerKey`.)
 */
export const NotificationTrigger = {
  TournamentEditedMidRegistration: 'TOURNAMENT_EDITED_MID_REGISTRATION',
  TournamentDeletedMidRegistration: 'TOURNAMENT_DELETED_MID_REGISTRATION',
  /** ?6.4: tournament calendar dates changed mid-season. */
  TournamentDatesChanged: 'TOURNAMENT_DATES_CHANGED',
  /** ?6.4: venue/location changed. */
  TournamentLocationChanged: 'TOURNAMENT_LOCATION_CHANGED',
  /** ?6.4: registration window changed. */
  TournamentRegistrationWindowChanged: 'TOURNAMENT_REGISTRATION_WINDOW_CHANGED',
  /** ?6.4: video upload policy or deadline changed. */
  TournamentVideoPolicyChanged: 'TOURNAMENT_VIDEO_POLICY_CHANGED',
  PlayerAddedToTeam: 'PLAYER_ADDED_TO_TEAM',
  PlayerRemovedFromTeam: 'PLAYER_REMOVED_FROM_TEAM',
  CaptainRosterChanged: 'CAPTAIN_ROSTER_CHANGED',
  /** ?17: a new tournament was created (Phase B). */
  NewTournamentCreated: 'NEW_TOURNAMENT_CREATED',
  /** ?17: a tournament's registration window opened (Phase C ? date-based). */
  RegistrationOpened: 'REGISTRATION_OPENED',
  /** ?17: an Admin/CM published a broadcast announcement (Phase B). */
  BroadcastPosted: 'BROADCAST_POSTED',
  /** ?7.3: the player is notified when their registration is confirmed. */
  RegistrationConfirmed: 'REGISTRATION_CONFIRMED',
  /** ?7.3: the player is notified when their registration is declined. */
  RegistrationDeclined: 'REGISTRATION_DECLINED',
  /** ?9.7: selected players are notified when the Playing 11 is posted/confirmed. */
  PlayingXiPosted: 'PLAYING_XI_POSTED',
  /** ?11.1: a player is notified they have been granted match Scorer access. */
  ScorerAssigned: 'SCORER_ASSIGNED',
  /** ?17: the winning team's squad is notified when a match result is confirmed (Phase B). */
  MatchResultConfirmed: 'MATCH_RESULT_CONFIRMED',
  /** ?17: both squads are notified when a match is scheduled (Phase B). */
  MatchScheduled: 'MATCH_SCHEDULED',
  /** ?17: both squads are notified when a match's date/time changes (Phase B). */
  MatchRescheduled: 'MATCH_RESCHEDULED',
  /** ?17: a suspended player is notified when designated to serve a penalty (Phase B). */
  PenaltyServeDesignated: 'PENALTY_SERVE_DESIGNATED',
  /** ?17: daily 10 AM EDT reminder to leather poll non-voters until close (Phase C). */
  PollReminder: 'POLL_REMINDER',
  /** ?17: 10 AM EDT day-before reminder to both squads (Phase C). */
  MatchReminder: 'MATCH_REMINDER',
  /** ?17: ~10 min before registration close, to the tournament audience (Phase C). */
  RegistrationClosing: 'REGISTRATION_CLOSING',
  /** ?17: ~10 min before the video upload deadline, to registered players (Phase C). */
  VideoUploadClosing: 'VIDEO_UPLOAD_CLOSING',
  /** ?17: on registration when video is required ? informs the registrant of the deadline (Phase C). */
  VideoUploadDeadline: 'VIDEO_UPLOAD_DEADLINE',
  /** ?17: at 10 AM EDT on a user's birthday, to all active users (Phase C). */
  Birthday: 'BIRTHDAY',
  /** ?17: Captain carried a pending suspension forward — notify Club Managers. */
  SuspensionCarriedForward: 'SUSPENSION_CARRIED_FORWARD',
  /** ?17: Captain cancelled a pending suspension — notify Club Managers. */
  SuspensionCancelled: 'SUSPENSION_CANCELLED',
} as const;

export type NotificationTrigger =
  (typeof NotificationTrigger)[keyof typeof NotificationTrigger];

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
