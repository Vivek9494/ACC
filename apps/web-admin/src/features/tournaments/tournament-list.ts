import type {
  BallType,
  TournamentDisplayStatus,
  TournamentSummary,
  TournamentType,
} from '@acc/types';

export const ALL = 'ALL';
export type FilterValue<T extends string> = T | typeof ALL;

export interface TournamentFilters {
  search: string;
  ballType: FilterValue<BallType>;
  status: FilterValue<TournamentDisplayStatus>;
  type: FilterValue<TournamentType>;
}

export const DEFAULT_TOURNAMENT_FILTERS: TournamentFilters = {
  search: '',
  ballType: ALL,
  status: ALL,
  type: ALL,
};

/** Venue address, else the "Tournament For" scope (province / centers). */
export function tournamentLocationLabel(t: TournamentSummary): string {
  if (t.locationAddress?.trim()) return t.locationAddress.trim();
  const { provinceName, centerNames } = t.scopeDisplay;
  if (centerNames.length > 0) return centerNames.join(', ');
  return provinceName ?? '—';
}

export function filterTournaments(
  rows: readonly TournamentSummary[],
  filters: TournamentFilters,
): TournamentSummary[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((t) => {
    if (filters.ballType !== ALL && t.ballType !== filters.ballType) return false;
    if (filters.status !== ALL && t.displayStatus !== filters.status) return false;
    if (filters.type !== ALL && t.type !== filters.type) return false;
    if (!query) return true;
    return (
      t.name.toLowerCase().includes(query) ||
      tournamentLocationLabel(t).toLowerCase().includes(query) ||
      String(t.year).includes(query)
    );
  });
}

export function countByStatus(
  rows: readonly TournamentSummary[],
): Record<TournamentDisplayStatus, number> {
  const counts: Record<TournamentDisplayStatus, number> = {
    UPCOMING: 0,
    LIVE: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const t of rows) counts[t.displayStatus] += 1;
  return counts;
}

// startAt / endAt are calendar days stored as UTC midnight — format in UTC so
// the day never shifts with the admin's browser timezone.
const DAY = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_NO_YEAR = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatTournamentDates(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime())) return '—';
  if (Number.isNaN(end.getTime()) || start.getTime() === end.getTime()) return DAY.format(start);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${sameYear ? DAY_NO_YEAR.format(start) : DAY.format(start)} – ${DAY.format(end)}`;
}
