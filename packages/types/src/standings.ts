/**
 * Tournament points-table / standings contracts shared between api and mobile.
 */

import { MatchState } from './match';
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

/** States that award 1 point each (NR column, excluded from NRR) — same rule as No Result. */
export const STANDINGS_SPLIT_POINT_MATCH_STATES: readonly MatchState[] = [
  MatchState.NoResult,
  MatchState.Cancelled,
];

/**
 * Whether a completed fixture counts as a split-point outcome (1 pt each, NR++, no NRR).
 * Cancelled matches use the same path as No Result (`isNoResult` on {@link StandingsMatchInput}).
 */
export function resolveStandingsSplitPointOutcome(input: {
  state: MatchState;
  isNoResult: boolean;
  scorecardIsNoResult: boolean;
}): boolean {
  return (
    STANDINGS_SPLIT_POINT_MATCH_STATES.includes(input.state) ||
    input.isNoResult ||
    input.scorecardIsNoResult
  );
}

/** Format NRR for display: signed, 3 decimal places (e.g. "+1.250", "-0.480"). */
export function formatSignedNetRunRate(nrr: number): string {
  const rounded = Math.round(nrr * 1000) / 1000;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(3)}`;
}

/** Standard points-table ordering: PTS desc, NRR desc, team name asc. */
export function compareTeamStandingRows(a: TeamStandingRow, b: TeamStandingRow): number {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  if (b.netRunRate !== a.netRunRate) {
    return b.netRunRate - a.netRunRate;
  }
  return a.teamName.localeCompare(b.teamName);
}

export function sortTeamStandingRows(rows: readonly TeamStandingRow[]): TeamStandingRow[] {
  return [...rows].sort(compareTeamStandingRows);
}

export interface MergedStandingsListView {
  teams: TeamStandingRow[];
  /** teamId → group name (Group A, etc.) for list-view labels. */
  groupLabelByTeamId: Record<string, string>;
}

/** Flatten per-group tables into one list sorted by PTS / NRR. */
export function mergeStandingsTablesForListView(
  tables: readonly StandingsTableSection[],
): MergedStandingsListView {
  const groupLabelByTeamId: Record<string, string> = {};
  const teams: TeamStandingRow[] = [];

  for (const table of tables) {
    for (const team of table.teams) {
      teams.push(team);
      groupLabelByTeamId[team.teamId] = table.groupName;
    }
  }

  return {
    teams: sortTeamStandingRows(teams),
    groupLabelByTeamId,
  };
}

/** List View toggle — only when the tournament is split into multiple groups. */
export function shouldShowStandingsListViewToggle(
  matchSchedulingFormat: MatchSchedulingFormat | null,
  groupCount: number,
  tableCount: number,
): boolean {
  return shouldSplitStandingsByGroup(matchSchedulingFormat, groupCount) && tableCount > 1;
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
