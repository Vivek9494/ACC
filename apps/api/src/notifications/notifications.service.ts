import { Injectable, Logger } from '@nestjs/common';

/**
 * Notification triggers (§17.1). These map 1:1 to the spec's trigger list and
 * the §6.4 mid-tournament edit events.
 */
export const NotificationTrigger = {
  TournamentEditedMidRegistration: 'TOURNAMENT_EDITED_MID_REGISTRATION',
  TournamentDeletedMidRegistration: 'TOURNAMENT_DELETED_MID_REGISTRATION',
  /** §6.4: tournament calendar dates changed mid-season. */
  TournamentDatesChanged: 'TOURNAMENT_DATES_CHANGED',
  /** §6.4: venue/location changed. */
  TournamentLocationChanged: 'TOURNAMENT_LOCATION_CHANGED',
  /** §6.4: registration window changed. */
  TournamentRegistrationWindowChanged: 'TOURNAMENT_REGISTRATION_WINDOW_CHANGED',
  /** §6.4: video upload policy or deadline changed. */
  TournamentVideoPolicyChanged: 'TOURNAMENT_VIDEO_POLICY_CHANGED',
  PlayerAddedToTeam: 'PLAYER_ADDED_TO_TEAM',
  PlayerRemovedFromTeam: 'PLAYER_REMOVED_FROM_TEAM',
  CaptainRosterChanged: 'CAPTAIN_ROSTER_CHANGED',
  /** §7.3: the player is notified when their registration is confirmed. */
  RegistrationConfirmed: 'REGISTRATION_CONFIRMED',
  /** §7.3: the player is notified when their registration is declined. */
  RegistrationDeclined: 'REGISTRATION_DECLINED',
  /** §9.7: selected players are notified when the Playing 11 is posted. */
  PlayingXiPosted: 'PLAYING_XI_POSTED',
  /** §11.1: a player is notified they have been granted match Scorer access. */
  ScorerAssigned: 'SCORER_ASSIGNED',
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
 * Phase 6 will deliver these via Firebase Cloud Messaging (§17). For now this is
 * a stub that records the trigger so call sites are wired correctly and the
 * behaviour is observable in logs/tests.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notify(trigger: NotificationTrigger, payload: NotificationPayload): Promise<void> {
    // Stub: FCM integration lands in Phase 6.
    this.logger.log(
      `[notify] ${trigger} → ${payload.recipientUserIds.length} recipient(s)` +
        (payload.data ? ` ${JSON.stringify(payload.data)}` : ''),
    );
    await Promise.resolve();
  }
}
