/**
 * Tournament points-table / standings contracts shared between api and mobile.
 */

import { MatchSchedulingFormat } from './match-scheduling-format';

/** One row in a standings table (TEAM | M | W | L | NR | PTS | NRR). */
export interface TeamStandingRow {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  /** Matches played (decided result or no-result). */
  matches: number;
  wins: number;
  losses: number;
  noResults: number;
  points: number;
  /** Net run rate — displayed to 3 decimals with a sign; also used for ordering. */
  netRunRate: number;
}

/** A match excluded from standings because its stored result is invalid. */
export interface StandingsDataError {
  matchId: string;
  message: string;
}

/** A standings table for one group, or the single combined table. */
export interface StandingsTableSection {
  groupId: string | null;
  groupName: string;
  teams: TeamStandingRow[];
}

export interface TournamentStandings {
  tournamentId: string;
  tables: StandingsTableSection[];
  /** Matches skipped because the stored outcome could not be scored (e.g. tie without Super Over). */
  dataErrors: StandingsDataError[];
}

/** Per-innings inputs for NRR — derived from completed match scorecards. */
export interface StandingsInningsInput {
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  runs: number;
  legalBalls: number;
  wasAllOut: boolean;
  oversAllotted: number | null;
}

/** Completed-match inputs consumed by the standings aggregator. */
export interface StandingsMatchInput {
  matchId: string;
  groupId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  isNoResult: boolean;
  winningTeamId: string | null;
  /** True when regulation scores are level and a Super Over is still required (§14). */
  requiresSuperOver?: boolean;
  /** Normal innings only — Super Overs excluded from NRR. */
  innings: StandingsInningsInput[];
}

/** Format NRR for display: signed, 3 decimal places (e.g. "+1.250", "-0.480"). */
export function formatSignedNetRunRate(nrr: number): string {
  const rounded = Math.round(nrr * 1000) / 1000;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(3)}`;
}

/** Group-stage knockout (or any tournament with groups) → one table per group. */
export function shouldSplitStandingsByGroup(
  matchSchedulingFormat: MatchSchedulingFormat | null,
  groupCount: number,
): boolean {
  return (
    matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout || groupCount > 0
  );
}

/** Round robin / manual without groups → single combined table. */
export function usesCombinedStandingsTable(
  matchSchedulingFormat: MatchSchedulingFormat | null,
  groupCount: number,
): boolean {
  return !shouldSplitStandingsByGroup(matchSchedulingFormat, groupCount);
}
