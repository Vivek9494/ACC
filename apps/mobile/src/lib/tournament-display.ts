import { TournamentState, type TournamentSummary } from '@acc/types';

import type { StatusPillVariant } from '../components/ui/StatusPill';

export function tournamentStatusPill(state: TournamentState): {
  variant: StatusPillVariant;
  label: string;
} {
  if (state === TournamentState.Completed) {
    return { variant: 'completed', label: 'Completed' };
  }
  if (state === TournamentState.Live || state === TournamentState.Knockout) {
    return { variant: 'ongoing', label: 'Ongoing' };
  }
  return { variant: 'upcoming', label: 'Upcoming' };
}

export function formatTournamentDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (sameMonth) {
    return `${startLabel} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${startLabel} – ${endLabel}`;
}

/** Title-row range, e.g. "June 15 - June 20". */
export function formatTournamentHeadingDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startLabel = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
}

/** Registration card datetime, e.g. "June 01, 2024 • 10:00 AM". */
export function formatTournamentDateTimeLabel(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
}

/** Schedule card date, e.g. "June 15, 2024". */
export function formatTournamentCalendarDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Individual match day (YYYY-MM-DD), e.g. "Sat, June 15, 2024". */
export function formatTournamentMatchDay(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    return dateOnly;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0),
  );
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Chronological sort for stored YYYY-MM-DD tournament dates. */
export function sortTournamentDates(dates: readonly string[]): string[] {
  return [...dates].sort((a, b) => a.localeCompare(b));
}

/** Short open date for disabled registration CTA. */
export function formatRegistrationOpensLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function tournamentLocation(tournament: TournamentSummary): string {
  return tournament.locationAddress?.trim() || 'Location TBD';
}
