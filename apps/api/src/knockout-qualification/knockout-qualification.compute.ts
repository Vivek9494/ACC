import {
  QualificationTieKind,
  QualificationTieResolution,
  QualificationType,
  type QualifiedTeam,
  type QualificationTieFlag,
  type TeamStandingRow,
} from '@acc/types';

export interface GroupStandingsInput {
  groupId: string;
  teams: readonly TeamStandingRow[];
}

export type HeadToHeadWinnerLookup = (
  teamAId: string,
  teamBId: string,
) => string | null;

export interface ComputeKnockoutQualificationInput {
  knockoutTeamCount: number;
  groups: readonly GroupStandingsInput[];
  headToHeadWinner?: HeadToHeadWinnerLookup;
}

export interface ComputeKnockoutQualificationResult {
  qualifiedTeams: QualifiedTeam[];
  ties: QualificationTieFlag[];
}

interface RankedCandidate {
  team: TeamStandingRow;
  groupId: string;
  groupRank: number;
}

function pointsAndNrrEqual(a: TeamStandingRow, b: TeamStandingRow): boolean {
  return a.points === b.points && a.netRunRate === b.netRunRate;
}

function resolveTieBreakMethod(
  teamAId: string,
  teamBId: string,
  headToHeadWinner: HeadToHeadWinnerLookup,
): QualificationTieResolution {
  const winner = headToHeadWinner(teamAId, teamBId);
  if (winner === teamAId || winner === teamBId) {
    return QualificationTieResolution.HeadToHead;
  }
  return QualificationTieResolution.TeamName;
}

function compareQualificationRows(
  a: TeamStandingRow,
  b: TeamStandingRow,
  headToHeadWinner: HeadToHeadWinnerLookup,
): number {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  if (b.netRunRate !== a.netRunRate) {
    return b.netRunRate - a.netRunRate;
  }
  const winner = headToHeadWinner(a.teamId, b.teamId);
  if (winner === a.teamId) {
    return -1;
  }
  if (winner === b.teamId) {
    return 1;
  }
  return a.teamName.localeCompare(b.teamName);
}

function sortQualificationRows(
  rows: readonly TeamStandingRow[],
  headToHeadWinner: HeadToHeadWinnerLookup,
): TeamStandingRow[] {
  return [...rows].sort((a, b) => compareQualificationRows(a, b, headToHeadWinner));
}

function groupRankForTeam(
  group: GroupStandingsInput,
  teamId: string,
): number {
  const index = group.teams.findIndex((team) => team.teamId === teamId);
  return index >= 0 ? index + 1 : group.teams.length + 1;
}

function pickGroupTopper(
  group: GroupStandingsInput,
  headToHeadWinner: HeadToHeadWinnerLookup,
): { candidate: RankedCandidate; tie?: QualificationTieFlag } {
  if (group.teams.length === 0) {
    throw new Error(`Group ${group.groupId} has no teams`);
  }

  const leader = group.teams[0]!;
  const tiedForFirst = group.teams.filter((team) => pointsAndNrrEqual(team, leader));
  if (tiedForFirst.length === 1) {
    return {
      candidate: {
        team: leader,
        groupId: group.groupId,
        groupRank: 1,
      },
    };
  }

  const sorted = sortQualificationRows(tiedForFirst, headToHeadWinner);
  const winner = sorted[0]!;
  const runnerUp = sorted[1]!;
  return {
    candidate: {
      team: winner,
      groupId: group.groupId,
      groupRank: 1,
    },
    tie: {
      kind: QualificationTieKind.GroupTopper,
      groupId: group.groupId,
      tiedTeamIds: tiedForFirst.map((team) => team.teamId),
      resolvedBy: resolveTieBreakMethod(winner.teamId, runnerUp.teamId, headToHeadWinner),
    },
  };
}

function detectWildcardCutoffTie(
  sortedPool: readonly RankedCandidate[],
  wildcardCount: number,
  headToHeadWinner: HeadToHeadWinnerLookup,
): QualificationTieFlag | undefined {
  if (wildcardCount <= 0 || wildcardCount >= sortedPool.length) {
    return undefined;
  }

  const lastIncluded = sortedPool[wildcardCount - 1]!;
  const firstExcluded = sortedPool[wildcardCount]!;
  if (!pointsAndNrrEqual(lastIncluded.team, firstExcluded.team)) {
    return undefined;
  }

  const tiedTeamIds = sortedPool
    .filter((candidate) => pointsAndNrrEqual(candidate.team, lastIncluded.team))
    .map((candidate) => candidate.team.teamId);

  return {
    kind: QualificationTieKind.WildcardCutoff,
    tiedTeamIds,
    resolvedBy: resolveTieBreakMethod(
      lastIncluded.team.teamId,
      firstExcluded.team.teamId,
      headToHeadWinner,
    ),
  };
}

function toQualifiedTeam(
  candidate: RankedCandidate,
  qualificationType: QualificationType,
): QualifiedTeam {
  return {
    teamId: candidate.team.teamId,
    teamName: candidate.team.teamName,
    qualificationType,
    groupId: candidate.groupId,
    groupRank: candidate.groupRank,
    points: candidate.team.points,
    netRunRate: candidate.team.netRunRate,
  };
}

/** Pure qualification engine — no I/O or persistence. */
export function computeKnockoutQualification(
  input: ComputeKnockoutQualificationInput,
): ComputeKnockoutQualificationResult {
  const headToHeadWinner = input.headToHeadWinner ?? (() => null);
  const groupCount = input.groups.length;
  const wildcardCount = input.knockoutTeamCount - groupCount;

  if (wildcardCount < 0) {
    throw new Error(
      `Knockout team count (${input.knockoutTeamCount}) is less than group count (${groupCount})`,
    );
  }

  const ties: QualificationTieFlag[] = [];
  const toppers: RankedCandidate[] = [];
  const topperIds = new Set<string>();

  for (const group of input.groups) {
    const { candidate, tie } = pickGroupTopper(group, headToHeadWinner);
    toppers.push(candidate);
    topperIds.add(candidate.team.teamId);
    if (tie) {
      ties.push(tie);
    }
  }

  const wildcardPool: RankedCandidate[] = [];
  for (const group of input.groups) {
    for (const team of group.teams) {
      if (topperIds.has(team.teamId)) {
        continue;
      }
      wildcardPool.push({
        team,
        groupId: group.groupId,
        groupRank: groupRankForTeam(group, team.teamId),
      });
    }
  }

  const sortedWildcards = sortQualificationRows(
    wildcardPool.map((candidate) => candidate.team),
    headToHeadWinner,
  ).map((team) => {
    const source = wildcardPool.find((candidate) => candidate.team.teamId === team.teamId);
    if (!source) {
      throw new Error(`Wildcard candidate ${team.teamId} missing from pool`);
    }
    return source;
  });

  const cutoffTie = detectWildcardCutoffTie(sortedWildcards, wildcardCount, headToHeadWinner);
  if (cutoffTie) {
    ties.push(cutoffTie);
  }

  const selectedWildcards = sortedWildcards.slice(0, wildcardCount);

  const sortedToppers = sortQualificationRows(
    toppers.map((candidate) => candidate.team),
    headToHeadWinner,
  ).map((team) => {
    const source = toppers.find((candidate) => candidate.team.teamId === team.teamId);
    if (!source) {
      throw new Error(`Topper candidate ${team.teamId} missing from pool`);
    }
    return source;
  });

  const qualifiedTeams = [
    ...sortedToppers.map((candidate) =>
      toQualifiedTeam(candidate, QualificationType.GroupTopper),
    ),
    ...selectedWildcards.map((candidate) =>
      toQualifiedTeam(candidate, QualificationType.Wildcard),
    ),
  ];

  return { qualifiedTeams, ties };
}
