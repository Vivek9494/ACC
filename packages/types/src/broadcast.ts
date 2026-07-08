/** Platform-wide broadcast message shown on home dashboards (24h TTL). */

import { DateTime } from 'luxon';

import { DEFAULT_VENUE_TIMEZONE, serverVenueTimezone } from './timezone';

export const BROADCAST_TTL_HOURS = 24;

export const BROADCAST_TEXT_MAX_LENGTH = 2000;

export interface ActiveBroadcast {
  id: string;
  imageUrl: string | null;
  text: string | null;
  postedAt: string;
  expiresAt: string;
}

/** Admin settings view — includes poster identity and time remaining. */
export interface AdminBroadcastView extends ActiveBroadcast {
  postedByUserId: string;
  postedByName: string;
  remainingSeconds: number;
}

export const BroadcastDisplayStatus = {
  Active: 'ACTIVE',
  Expired: 'EXPIRED',
} as const;

export type BroadcastDisplayStatus =
  (typeof BroadcastDisplayStatus)[keyof typeof BroadcastDisplayStatus];

/** One row in the admin broadcast history list (newest first). */
export interface BroadcastHistoryEntry {
  id: string;
  imageUrl: string | null;
  text: string | null;
  postedAt: string;
  expiresAt: string;
  removedAt: string | null;
  postedByName: string;
  status: BroadcastDisplayStatus;
}

export function deriveBroadcastDisplayStatus(input: {
  removedAt: Date | string | null;
  expiresAt: Date | string;
  now?: Date;
}): BroadcastDisplayStatus {
  const now = input.now ?? new Date();
  const removedAt =
    input.removedAt == null
      ? null
      : input.removedAt instanceof Date
        ? input.removedAt
        : new Date(input.removedAt);
  const expiresAt =
    input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
  if (removedAt == null && expiresAt.getTime() > now.getTime()) {
    return BroadcastDisplayStatus.Active;
  }
  return BroadcastDisplayStatus.Expired;
}

/** History list — "Posted at 4:32 PM" today, or "Posted Jun 12 · 4:32 PM" (venue-local). */
export function formatBroadcastPostedLabel(
  postedAtIso: string,
  persistedTimezone: string | null | undefined = DEFAULT_VENUE_TIMEZONE,
  now: Date = new Date(),
): string {
  const timeZone = serverVenueTimezone(persistedTimezone);
  const posted = DateTime.fromISO(postedAtIso, { zone: 'utc' }).setZone(timeZone);
  const today = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(timeZone);
  const isToday =
    posted.year === today.year && posted.month === today.month && posted.day === today.day;
  const timePart = posted.toLocaleString(DateTime.TIME_SIMPLE);
  if (isToday) {
    return `Posted at ${timePart}`;
  }
  const datePart = posted.toLocaleString({ month: 'short', day: 'numeric' });
  return `Posted ${datePart} · ${timePart}`;
}

export const BROADCAST_VALIDATION_MESSAGES = {
  contentRequired: 'Enter a message and/or choose an image',
  textTooLong: `Message must be ${BROADCAST_TEXT_MAX_LENGTH} characters or fewer`,
} as const;

export function isValidBroadcastContent(text: string | null | undefined, hasImage: boolean): boolean {
  const trimmed = text?.trim() ?? '';
  if (trimmed.length > BROADCAST_TEXT_MAX_LENGTH) {
    return false;
  }
  return trimmed.length > 0 || hasImage;
}

export function formatBroadcastTimeRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return 'Expired';
  }
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  if (minutes > 0) {
    return `${minutes}m remaining`;
  }
  return 'Less than 1m remaining';
}
