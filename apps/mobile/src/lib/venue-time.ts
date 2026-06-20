import {
  formatMatchDateTimeLine,
  formatVenueDateTime,
  resolveDisplayTimezone,
  type FormatVenueDateTimeOptions,
} from '@acc/types';

import { getDeviceTimezone } from './device-timezone';

export function resolveVenueDisplayTimezone(
  persistedTimezone: string | null | undefined,
): { timezone: string; timezoneFallback: boolean } {
  return resolveDisplayTimezone(persistedTimezone, getDeviceTimezone());
}

export function formatVenueInstant(
  iso: string | Date,
  persistedTimezone: string | null | undefined,
  options?: FormatVenueDateTimeOptions,
): string {
  const { timezone } = resolveVenueDisplayTimezone(persistedTimezone);
  return formatVenueDateTime(iso, timezone, options);
}

export function formatMatchScheduleLine(
  match: { matchDate: string | null; startTime: string | null },
  persistedTimezone: string | null | undefined,
  options: { includeZoneAbbrev?: boolean } = { includeZoneAbbrev: true },
): string {
  const { timezone } = resolveVenueDisplayTimezone(persistedTimezone);
  return formatMatchDateTimeLine(match, timezone, options);
}

export function formatPollCloseLine(
  closesAt: string,
  persistedTimezone: string | null | undefined,
  timezoneFallback: boolean,
): string {
  const { timezone } = resolveVenueDisplayTimezone(
    timezoneFallback ? null : persistedTimezone,
  );
  return formatVenueDateTime(closesAt, timezone, {
    includeWeekday: true,
    includeYear: false,
    includeTime: true,
    includeZoneAbbrev: true,
  });
}
