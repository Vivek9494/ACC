/**
 * Push notification contracts shared by the api and mobile (spec §17).
 *
 * Phase A infrastructure: device-token registration + the notification payload
 * shape. Individual triggers (Phases B/C) resolve an audience and hand a payload
 * to the shared notification service — they never talk to FCM directly.
 */

/** Device platform for a registered FCM token. Mirrors the Prisma `PushPlatform` enum. */
export const PushPlatform = {
  Ios: 'IOS',
  Android: 'ANDROID',
  Web: 'WEB',
} as const;

export type PushPlatform = (typeof PushPlatform)[keyof typeof PushPlatform];

export const PUSH_PLATFORM_VALUES: readonly PushPlatform[] = [
  PushPlatform.Ios,
  PushPlatform.Android,
  PushPlatform.Web,
];

/** Request body for POST /notifications/device-tokens (register/refresh a token). */
export interface RegisterPushTokenRequest {
  /**
   * Device push token from the client. Android: FCM registration token.
   * iOS: APNs device token (the API converts it to an FCM registration token).
   */
  token: string;
  platform: PushPlatform;
}

/** Request body for DELETE /notifications/device-tokens (unregister on logout). */
export interface UnregisterPushTokenRequest {
  token: string;
}

/**
 * Notification content handed to the shared notification service. `data` is the
 * FCM data payload (string values only once serialized). `dedupeKey`, when set,
 * makes the logical send idempotent (timed jobs / retries won't double-send).
 */
export interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Idempotency key, e.g. "MATCH_REMINDER:matchX:2026-07-07". */
  dedupeKey?: string;
  /** Semantic trigger key recorded on the log (e.g. "MATCH_REMINDER"). */
  triggerKey: string;
  /** Optional human-readable audience description for traceability. */
  audienceSummary?: string;
}

/**
 * Push notification trigger keys (§17.1, §6.4 mid-tournament edits). Recorded as
 * `NotificationLog.triggerKey` and used to build dedupe keys.
 */
export const NotificationTrigger = {
  /** Fallback copy for tournament-edit messages; never sent under this key. */
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
  /** Defined by the spec but not sent anywhere yet. */
  CaptainRosterChanged: 'CAPTAIN_ROSTER_CHANGED',
  /** §17: a new tournament was created. */
  NewTournamentCreated: 'NEW_TOURNAMENT_CREATED',
  /** §17: a tournament's registration window opened (timed). */
  RegistrationOpened: 'REGISTRATION_OPENED',
  /** §17: an Admin/CM published a broadcast announcement. */
  BroadcastPosted: 'BROADCAST_POSTED',
  /** §7.3: the player is notified when their registration is confirmed. */
  RegistrationConfirmed: 'REGISTRATION_CONFIRMED',
  /** §7.3: the player is notified when their registration is declined. */
  RegistrationDeclined: 'REGISTRATION_DECLINED',
  /** §9.7: selected players are notified when the Playing 11 is posted/confirmed. */
  PlayingXiPosted: 'PLAYING_XI_POSTED',
  /** §11.1: a player is notified they have been granted match Scorer access. */
  ScorerAssigned: 'SCORER_ASSIGNED',
  /** §17: the winning team's squad is notified when a match result is confirmed. */
  MatchResultConfirmed: 'MATCH_RESULT_CONFIRMED',
  /** §17: both squads are notified when a match is scheduled. */
  MatchScheduled: 'MATCH_SCHEDULED',
  /** §17: both squads are notified when a match's date/time changes. */
  MatchRescheduled: 'MATCH_RESCHEDULED',
  /** §17: a suspended player is notified when designated to serve a penalty. */
  PenaltyServeDesignated: 'PENALTY_SERVE_DESIGNATED',
  /** §17: daily reminder to leather poll non-voters until close (timed). */
  PollReminder: 'POLL_REMINDER',
  /** §17: day-before reminder to both squads (timed). */
  MatchReminder: 'MATCH_REMINDER',
  /** §17: shortly before registration close, to the tournament audience (timed). */
  RegistrationClosing: 'REGISTRATION_CLOSING',
  /** §17: shortly before the video upload deadline, to registered players (timed). */
  VideoUploadClosing: 'VIDEO_UPLOAD_CLOSING',
  /** §17: when videoUploadStartAt arrives, to registered players (Confirmed + In Waitlist). */
  VideoUploadOpened: 'VIDEO_UPLOAD_OPENED',
  /** §17: on registration when video is required — informs the registrant of the deadline. */
  VideoUploadDeadline: 'VIDEO_UPLOAD_DEADLINE',
  /** §17: before the verification deadline — Center Sevaks of the tournament's centers. */
  VerificationReminder: 'VERIFICATION_REMINDER',
  /** Once-per-tournament guard for the waitlist auto-confirm; players receive REGISTRATION_CONFIRMED. */
  WaitlistAutoConfirm: 'WAITLIST_AUTO_CONFIRM',
  /** §17: on a user's birthday, to all active users (timed). */
  Birthday: 'BIRTHDAY',
  /** §17: Captain carried a pending suspension forward — notify Club Managers. */
  SuspensionCarriedForward: 'SUSPENSION_CARRIED_FORWARD',
  /** §17: Captain cancelled a pending suspension — notify Club Managers. */
  SuspensionCancelled: 'SUSPENSION_CANCELLED',
} as const;

export type NotificationTrigger = (typeof NotificationTrigger)[keyof typeof NotificationTrigger];

/** Local hour (venue timezone) of the daily notification run: poll reminders, match reminders, birthdays. */
export const NOTIFICATION_DAILY_JOB_HOUR = 10;

/** Result summary returned by the notification service for a single send. */
export interface NotificationSendResult {
  /** Whether the send actually dispatched (false when short-circuited by de-dup). */
  sent: boolean;
  recipientUserCount: number;
  tokenCount: number;
  successCount: number;
  failureCount: number;
  /** Set when skipped because the dedupeKey already existed. */
  deduped?: boolean;
}
