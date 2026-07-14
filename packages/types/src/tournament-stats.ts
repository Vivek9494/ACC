/** Tournament-wide aggregate stats derived from scored matches (incl. live). */

import type { LeaderboardTeamOption } from './leaderboard';

export interface TournamentAggregateStats {
  totalRuns: number;
  totalWickets: number;
  sixes: number;
  fours: number;
  fifties: number;
  hundreds: number;
  fifers: number;
}

/** One ranked row on a Most Sixes / Most Fours leaderboard. */
export interface TournamentBoundaryLeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  count: number;
}

export interface TournamentStatsView {
  tournamentId: string;
  /** True when at least one included match has scoring data (for the selected scope). */
  hasRecords: boolean;
  /** Non-deleted teams for the Stats tab filter (same shape as Leaderboard). */
  teams: LeaderboardTeamOption[];
  aggregates: TournamentAggregateStats;
  mostSixes: TournamentBoundaryLeaderboardEntry[];
  mostFours: TournamentBoundaryLeaderboardEntry[];
}

export function tournamentStatsHasRecords(
  stats: Pick<TournamentStatsView, 'hasRecords' | 'aggregates'> | null | undefined,
): boolean {
  if (!stats) {
    return false;
  }
  if (stats.hasRecords) {
    return true;
  }
  const { aggregates } = stats;
  return (
    aggregates.totalRuns > 0 ||
    aggregates.totalWickets > 0 ||
    aggregates.sixes > 0 ||
    aggregates.fours > 0
  );
}
