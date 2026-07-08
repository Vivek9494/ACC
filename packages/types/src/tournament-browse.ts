import type { TournamentDashboardEntry } from './center-sevak';
import {
  TournamentDisplayStatus,
  resolveTournamentDisplayStatus,
} from './tournament-display-status';

/** Tournament row for the browse tab — includes soft-deleted (cancelled) records. */
export interface TournamentBrowseEntry extends TournamentDashboardEntry {
  cancelled: boolean;
}

export type TournamentBrowseSectionKey = 'live' | 'upcoming' | 'completed' | 'cancelled';

export const TOURNAMENT_BROWSE_SECTION_ORDER: readonly TournamentBrowseSectionKey[] = [
  'live',
  'upcoming',
  'completed',
  'cancelled',
];

export const TOURNAMENT_BROWSE_SECTION_LABELS: Record<TournamentBrowseSectionKey, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function classifyTournamentBrowseSection(
  entry: Pick<TournamentBrowseEntry, 'cancelled' | 'tournament'>,
): TournamentBrowseSectionKey {
  const displayStatus = resolveTournamentDisplayStatus(entry.tournament, {
    cancelled: entry.cancelled,
  });
  if (displayStatus === TournamentDisplayStatus.Cancelled) {
    return 'cancelled';
  }
  if (displayStatus === TournamentDisplayStatus.Live) {
    return 'live';
  }
  if (displayStatus === TournamentDisplayStatus.Completed) {
    return 'completed';
  }
  return 'upcoming';
}

function compareIsoAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

function compareIsoDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

/** Groups browse rows into Live → Upcoming → Completed → Cancelled with section-local sort. */
export function groupTournamentBrowseEntries(
  entries: readonly TournamentBrowseEntry[],
): Record<TournamentBrowseSectionKey, TournamentBrowseEntry[]> {
  const groups: Record<TournamentBrowseSectionKey, TournamentBrowseEntry[]> = {
    live: [],
    upcoming: [],
    completed: [],
    cancelled: [],
  };

  for (const entry of entries) {
    groups[classifyTournamentBrowseSection(entry)].push(entry);
  }

  groups.live.sort((a, b) => compareIsoDesc(a.tournament.startAt, b.tournament.startAt));
  groups.upcoming.sort((a, b) => compareIsoAsc(a.tournament.startAt, b.tournament.startAt));
  groups.completed.sort((a, b) => compareIsoDesc(a.tournament.endAt, b.tournament.endAt));
  groups.cancelled.sort((a, b) => compareIsoDesc(a.tournament.endAt, b.tournament.endAt));

  return groups;
}
