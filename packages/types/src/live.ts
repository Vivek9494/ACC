/**
 * Real-time live-score protocol (spec §29 — Socket.IO push; §28 — live
 * display). The scorer mutates state over REST; the server recomputes the full
 * {@link ScorecardResponse}, caches it in Redis, and pushes it to every
 * subscriber of the match room. Guests subscribe read-only, no auth (spec §2).
 */

import type { ScorecardResponse } from './scoring';

/** Socket.IO event names exchanged on the live namespace. */
export const LiveEvent = {
  /** Client → server: join a match room. Payload {@link LiveSubscribeMessage}. */
  Subscribe: 'live:subscribe',
  /** Client → server: leave a match room. Payload {@link LiveSubscribeMessage}. */
  Unsubscribe: 'live:unsubscribe',
  /** Server → client: acknowledges a subscription. */
  Subscribed: 'live:subscribed',
  /** Server → client: a full live-state snapshot/update. */
  State: 'live:state',
} as const;
export type LiveEvent = (typeof LiveEvent)[keyof typeof LiveEvent];

/** The Socket.IO namespace the live gateway is mounted on. */
export const LIVE_NAMESPACE = '/live';

/** Redis key for a match's cached live state (spec §29 live match cache). */
export function liveStateCacheKey(matchId: string): string {
  return `live:match:${matchId}`;
}

/** Socket.IO room name for a match. */
export function liveMatchRoom(matchId: string): string {
  return `match:${matchId}`;
}

export interface LiveSubscribeMessage {
  matchId: string;
}

export interface LiveSubscribedMessage {
  matchId: string;
  /** True when a cached snapshot was delivered immediately on subscribe. */
  hasSnapshot: boolean;
}

/** A pushed live-state frame. `state` is null only when nothing is cached yet. */
export interface LiveStateMessage {
  matchId: string;
  state: ScorecardResponse | null;
  /** Server timestamp (UTC ISO-8601) the frame was produced. */
  updatedAt: string;
}
