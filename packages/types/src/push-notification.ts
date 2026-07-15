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
