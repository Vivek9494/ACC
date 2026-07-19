import {
  MatchSchedulingFormat,
  POINTS_LOSS,
  POINTS_TIE_OR_NO_RESULT,
  POINTS_WIN,
  shouldSplitStandingsByGroup,
  type StandingsDataError,
  type StandingsMatchInput,
  type StandingsTableSection,
  type TeamStandingRow,
} from '@acc/types';

import {
  accumulateInningsNrr,
  computeNetRunRate,
  emptyNrrTotals,
  roundNetRunRate,
  type TeamNrrTotals,
} from './standings.nrr';

interface TeamSeed {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  groupId: string | null;
}

interface MutableStanding {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  matches: number;
  wins: number;
  losses: number;
  noResults: number;
  points: number;
}

/**
 * Decided outcomes may omit winner/loser when one side is an external opponent
 * (Leather ACC fixtures). `winnerId` null + decided ⇒ system team lost.
 */
type MatchOutcome =
  | { kind: 'no_result' }
  | { kind: 'decided'; winnerId: string | null; loserId: string | null };

const UNDECIDED_MATCH_MESSAGE =
  'Match has no winner — level scores must be resolved by a Super Over (§14).';

type ClassifyResult =
  | { ok: true; outcome: MatchOutcome }
  | { ok: false; error: StandingsDataError };

function classifyOutcome(match: StandingsMatchInput): ClassifyResult {
  const { homeTeamId, awayTeamId, matchId } = match;
  if (!homeTeamId && !awayTeamId) {
    return { ok: false, error: { matchId, message: 'Match is missing a system team.' } };
  }

  if (match.isNoResult) {
    // Includes No Result, Cancelled, and scorecard-flagged NR — shared split-point path.
    return { ok: true, outcome: { kind: 'no_result' } };
  }

  if (match.winningTeamId) {
    const winnerId = match.winningTeamId;
    const loserId =
      winnerId === homeTeamId ? awayTeamId : winnerId === awayTeamId ? homeTeamId : null;
    return { ok: true, outcome: { kind: 'decided', winnerId, loserId } };
  }

  // Leather: external opponent won — scorecard is decided but winningTeamId is null
  // because the external side has no system team id.
  const isExternalFixture = Boolean(homeTeamId) !== Boolean(awayTeamId);
  if (match.isDecided && isExternalFixture) {
    const systemTeamId = homeTeamId ?? awayTeamId;
    return {
      ok: true,
      outcome: { kind: 'decided', winnerId: null, loserId: systemTeamId },
    };
  }

  const message = match.requiresSuperOver
    ? 'Super Over is required but no winner is recorded (§14).'
    : UNDECIDED_MATCH_MESSAGE;

  return { ok: false, error: { matchId, message } };
}

function applyOutcome(row: MutableStanding, outcome: MatchOutcome, teamId: string): void {
  row.matches += 1;
  if (outcome.kind === 'no_result') {
    row.noResults += 1;
    row.points += POINTS_TIE_OR_NO_RESULT;
    return;
  }
  if (outcome.winnerId === teamId) {
    row.wins += 1;
    row.points += POINTS_WIN;
  } else {
    row.losses += 1;
    row.points += POINTS_LOSS;
  }
}

function initStanding(seed: TeamSeed): MutableStanding {
  return {
    teamId: seed.teamId,
    teamName: seed.teamName,
    logoUrl: seed.logoUrl,
    matches: 0,
    wins: 0,
    losses: 0,
    noResults: 0,
    points: 0,
  };
}

function sortRows(rows: TeamStandingRow[], includeNrr: boolean): TeamStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (includeNrr && b.netRunRate !== a.netRunRate) {
      return b.netRunRate - a.netRunRate;
    }
    return a.teamName.localeCompare(b.teamName);
  });
}

function toRow(
  standing: MutableStanding,
  nrrTotals: TeamNrrTotals | undefined,
  includeNrr: boolean,
): TeamStandingRow {
  const totals = nrrTotals ?? emptyNrrTotals();
  return {
    teamId: standing.teamId,
    teamName: standing.teamName,
    logoUrl: standing.logoUrl,
    matches: standing.matches,
    wins: standing.wins,
    losses: standing.losses,
    noResults: standing.noResults,
    points: standing.points,
    netRunRate: includeNrr ? roundNetRunRate(computeNetRunRate(totals)) : 0,
  };
}

export interface ComputeStandingsInput {
  tournamentId: string;
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount: number;
  teams: TeamSeed[];
  groups: { id: string; name: string; teamIds: string[] }[];
  matches: StandingsMatchInput[];
  /** When false (Leather), skip NRR accumulation and sort without NRR. */
  includeNetRunRate?: boolean;
}

export interface ComputeStandingsResult {
  tables: StandingsTableSection[];
  dataErrors: StandingsDataError[];
}

function processMatch(
  match: StandingsMatchInput,
  standings: Map<string, MutableStanding>,
  nrrByTeam: Map<string, TeamNrrTotals>,
  dataErrors: StandingsDataError[],
  includeNetRunRate: boolean,
  teamFilter?: Set<string>,
): void {
  const classified = classifyOutcome(match);
  if (!classified.ok) {
    dataErrors.push(classified.error);
    return;
  }

  const systemTeamIds = [match.homeTeamId, match.awayTeamId].filter(
    (id): id is string => id != null,
  );
  if (systemTeamIds.length === 0) {
    return;
  }

  // Group tables: only apply when at least one participating system team is in the group.
  if (teamFilter) {
    const inGroup = systemTeamIds.filter((id) => teamFilter.has(id));
    if (inGroup.length === 0) {
      return;
    }
  }

  const { outcome } = classified;
  for (const teamId of systemTeamIds) {
    if (teamFilter && !teamFilter.has(teamId)) {
      continue;
    }
    const row = standings.get(teamId);
    if (!row) {
      continue;
    }
    applyOutcome(row, outcome, teamId);
  }

  if (includeNetRunRate && outcome.kind !== 'no_result' && systemTeamIds.length === 2) {
    // NRR only for system-vs-system (both batting sides have team ids).
    accumulateInningsNrr(nrrByTeam, match.innings);
  }
}

/** Pure aggregation — standings rows from completed match inputs. */
export function computeStandings(input: ComputeStandingsInput): ComputeStandingsResult {
  const splitByGroup = shouldSplitStandingsByGroup(
    input.matchSchedulingFormat,
    input.groupCount,
  );
  const includeNetRunRate = input.includeNetRunRate !== false;
  const teamById = new Map(input.teams.map((team) => [team.teamId, team]));
  const dataErrors: StandingsDataError[] = [];

  if (splitByGroup) {
    const tables = input.groups.map((group) => {
      const groupTeamIds = new Set(group.teamIds);
      const standings = new Map<string, MutableStanding>();
      for (const teamId of group.teamIds) {
        const seed = teamById.get(teamId);
        if (seed) {
          standings.set(teamId, initStanding(seed));
        }
      }

      const nrrByTeam = new Map<string, TeamNrrTotals>();

      for (const match of input.matches) {
        if (match.groupId !== group.id) {
          continue;
        }
        processMatch(
          match,
          standings,
          nrrByTeam,
          dataErrors,
          includeNetRunRate,
          groupTeamIds,
        );
      }

      const rows = [...standings.values()].map((standing) =>
        toRow(standing, nrrByTeam.get(standing.teamId), includeNetRunRate),
      );
      return {
        groupId: group.id,
        groupName: group.name,
        teams: sortRows(rows, includeNetRunRate),
      };
    });

    return { tables, dataErrors };
  }

  const standings = new Map<string, MutableStanding>();
  for (const seed of input.teams) {
    standings.set(seed.teamId, initStanding(seed));
  }
  const nrrByTeam = new Map<string, TeamNrrTotals>();

  for (const match of input.matches) {
    processMatch(match, standings, nrrByTeam, dataErrors, includeNetRunRate);
  }

  const rows = [...standings.values()].map((standing) =>
    toRow(standing, nrrByTeam.get(standing.teamId), includeNetRunRate),
  );

  return {
    tables: [
      {
        groupId: null,
        groupName: 'Standings',
        teams: sortRows(rows, includeNetRunRate),
      },
    ],
    dataErrors,
  };
}
