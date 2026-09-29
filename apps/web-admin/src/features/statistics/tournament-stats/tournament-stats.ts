import { TournamentDisplayStatus, type TournamentSummary } from '@acc/types';

export const STAT_VIEWS = ['batting', 'bowling', 'points', 'boundaries'] as const;
export type StatView = (typeof STAT_VIEWS)[number];

export function parseStatView(value: string | null): StatView {
  return STAT_VIEWS.find((view) => view === value) ?? 'batting';
}

const STATUS_ORDER: Record<TournamentDisplayStatus, number> = {
  [TournamentDisplayStatus.Live]: 0,
  [TournamentDisplayStatus.Completed]: 1,
  [TournamentDisplayStatus.Upcoming]: 2,
  [TournamentDisplayStatus.Cancelled]: 3,
};

/** Picker order: live first, then completed, upcoming, cancelled — newest first within each. */
export function sortTournamentsForStats(tournaments: readonly TournamentSummary[]): TournamentSummary[] {
  return [...tournaments].sort(
    (a, b) =>
      STATUS_ORDER[a.displayStatus] - STATUS_ORDER[b.displayStatus] ||
      b.startAt.localeCompare(a.startAt) ||
      a.name.localeCompare(b.name),
  );
}

/** Requested id when it's still in the list, else the first (most relevant) tournament. */
export function resolveSelectedTournament(
  sorted: readonly TournamentSummary[],
  requestedId: string | null,
): TournamentSummary | null {
  return sorted.find((t) => t.id === requestedId) ?? sorted[0] ?? null;
}

/** Sort key for "W/R" best-bowling figures: more wickets first, then fewer runs. */
export function bestBowlingSortValue(best: string | null): number {
  const match = best ? /^(\d+)\/(\d+)$/.exec(best) : null;
  if (!match) return Number.NEGATIVE_INFINITY;
  return Number(match[1]) * 10_000 - Number(match[2]);
}
