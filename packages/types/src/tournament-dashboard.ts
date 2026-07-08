import { compareIsoDateOnly, utcMidnightIsoToDateOnly } from './tournament-dates';
import {
  deriveTournamentDisplayStatus,
  TournamentDisplayStatus,
} from './tournament-display-status';
import type { TournamentSummary } from './tournament';

export interface DashboardTournamentCandidate {
  tournament: Pick<
    TournamentSummary,
    'startAt' | 'endAt' | 'timezone' | 'displayStatus' | 'id'
  >;
  cancelled?: boolean;
}

function compareStartDateAsc(
  a: DashboardTournamentCandidate,
  b: DashboardTournamentCandidate,
): number {
  return compareIsoDateOnly(
    utcMidnightIsoToDateOnly(a.tournament.startAt),
    utcMidnightIsoToDateOnly(b.tournament.startAt),
  );
}

function compareEndDateDesc(
  a: DashboardTournamentCandidate,
  b: DashboardTournamentCandidate,
): number {
  return compareIsoDateOnly(
    utcMidnightIsoToDateOnly(b.tournament.endAt),
    utcMidnightIsoToDateOnly(a.tournament.endAt),
  );
}

function displayStatusForEntry(
  entry: DashboardTournamentCandidate,
  now: Date,
): TournamentDisplayStatus {
  return deriveTournamentDisplayStatus(
    {
      startAt: entry.tournament.startAt,
      endAt: entry.tournament.endAt,
      timezone: entry.tournament.timezone,
      cancelled: entry.cancelled,
    },
    now,
  );
}

/**
 * Dashboard tournament priority (all users, date-derived status):
 * 1. All upcoming (start asc) → 2. All live → 3. Single most-recent completed → none.
 * Cancelled entries are excluded.
 */
export function selectDashboardTournaments<T extends DashboardTournamentCandidate>(
  entries: readonly T[],
  now: Date = new Date(),
): T[] {
  const active = entries.filter((entry) => !entry.cancelled);

  const upcoming = active
    .filter((entry) => displayStatusForEntry(entry, now) === TournamentDisplayStatus.Upcoming)
    .sort(compareStartDateAsc);
  if (upcoming.length > 0) {
    return upcoming;
  }

  const live = active
    .filter((entry) => displayStatusForEntry(entry, now) === TournamentDisplayStatus.Live)
    .sort(compareStartDateAsc);
  if (live.length > 0) {
    return live;
  }

  const completed = active
    .filter((entry) => displayStatusForEntry(entry, now) === TournamentDisplayStatus.Completed)
    .sort(compareEndDateDesc);
  if (completed.length > 0) {
    return [completed[0] as T];
  }

  return [];
}
