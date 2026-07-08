/** Injection token for the active {@link PushProvider} implementation. */
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

/** A single push message (already resolved to concrete title/body/data). */
export interface PushMessage {
  title: string;
  body: string;
  /** FCM data payload; values must be strings. */
  data?: Record<string, string>;
}

/**
 * Outcome of a multi-token send, partitioned so the caller can prune tokens
 * that FCM reports as permanently invalid while retaining ones that failed
 * transiently.
 */
export interface PushSendResult {
  /** Tokens FCM accepted. */
  successTokens: string[];
  /** Tokens FCM rejected as unregistered/invalid — safe to delete. */
  invalidTokens: string[];
  /** Tokens that failed for other (transient) reasons — keep and retry later. */
  failedTokens: string[];
}

/**
 * Provider-agnostic push gateway. FCM (stack §29) is the production adapter; a
 * dev stub logs messages locally without sending. The notification service is
 * the only caller — triggers never touch this directly.
 */
export interface PushProvider {
  /** Deliver one message to many device tokens, returning per-token outcomes. */
  sendToTokens(tokens: string[], message: PushMessage): Promise<PushSendResult>;
}
