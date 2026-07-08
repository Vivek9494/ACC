import {
  KnockoutBracketSlotKind,
  MatchSide,
  knockoutMatchAwaitingScorecardConfirmation,
  type KnockoutBracketMatchSlot,
  type KnockoutBracketMatchSummary,
} from '@acc/types';

export interface KnockoutBracketMatchDisplayRow {
  id: string;
  bracketRoundIndex: number | null;
  bracketPosition: number | null;
  bracketRoundLabel: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: MatchSide | null;
  state: KnockoutBracketMatchSummary['state'];
  confirmedAt: string | null;
  winningTeamId: string | null;
  isNoResult: boolean;
  awaitingTeams: boolean;
  requiresResolution: boolean;
  homeTeam: { name: string; logoUrl: string | null } | null;
  awayTeam: { name: string; logoUrl: string | null } | null;
}

function feederMapKey(parentId: string, slot: MatchSide): string {
  return `${parentId}:${slot}`;
}

function buildFeederMap(
  matches: readonly KnockoutBracketMatchDisplayRow[],
): Map<string, KnockoutBracketMatchDisplayRow> {
  const map = new Map<string, KnockoutBracketMatchDisplayRow>();
  for (const match of matches) {
    if (match.nextMatchId == null || match.nextMatchSlot == null) {
      continue;
    }
    map.set(feederMapKey(match.nextMatchId, match.nextMatchSlot), match);
  }
  return map;
}

export function formatKnockoutFeederLabel(
  feeder: Pick<KnockoutBracketMatchDisplayRow, 'bracketRoundLabel' | 'bracketPosition'>,
): string {
  const roundLabel = feeder.bracketRoundLabel ?? 'Match';
  const matchNumber = (feeder.bracketPosition ?? 0) + 1;
  return `Winner of ${roundLabel} · Match ${matchNumber}`;
}

function teamAppearsInHigherRound(
  teamId: string,
  matchRoundIndex: number,
  matches: readonly KnockoutBracketMatchDisplayRow[],
): boolean {
  return matches.some(
    (row) =>
      (row.bracketRoundIndex ?? 0) > matchRoundIndex &&
      (row.homeTeamId === teamId || row.awayTeamId === teamId),
  );
}

function assignedTeamSlotKind(
  teamId: string,
  match: KnockoutBracketMatchDisplayRow,
  matches: readonly KnockoutBracketMatchDisplayRow[],
): typeof KnockoutBracketSlotKind.Team | typeof KnockoutBracketSlotKind.Bye {
  const roundIndex = match.bracketRoundIndex ?? 0;
  const maxRoundIndex = Math.max(...matches.map((row) => row.bracketRoundIndex ?? 0));

  if (teamAppearsInHigherRound(teamId, roundIndex, matches)) {
    return KnockoutBracketSlotKind.Team;
  }
  if (roundIndex < maxRoundIndex) {
    return KnockoutBracketSlotKind.Bye;
  }
  return KnockoutBracketSlotKind.Team;
}

function mapAssignedSlot(
  teamId: string,
  team: { name: string; logoUrl: string | null } | null,
  match: KnockoutBracketMatchDisplayRow,
  matches: readonly KnockoutBracketMatchDisplayRow[],
): KnockoutBracketMatchSlot {
  const kind = assignedTeamSlotKind(teamId, match, matches);
  return {
    kind,
    teamId,
    teamName: team?.name ?? null,
    logoUrl: team?.logoUrl ?? null,
    feederLabel: null,
  };
}

function mapOpenSlot(
  feeder: KnockoutBracketMatchDisplayRow | undefined,
): KnockoutBracketMatchSlot {
  if (feeder) {
    const feederAwaitingConfirmation = knockoutMatchAwaitingScorecardConfirmation({
      state: feeder.state,
      confirmedAt: feeder.confirmedAt,
    });
    return {
      kind: KnockoutBracketSlotKind.WinnerOf,
      teamId: null,
      teamName: null,
      logoUrl: null,
      feederLabel: formatKnockoutFeederLabel(feeder),
      ...(feederAwaitingConfirmation ? { feederAwaitingConfirmation: true } : {}),
    };
  }
  return {
    kind: KnockoutBracketSlotKind.Tbd,
    teamId: null,
    teamName: null,
    logoUrl: null,
    feederLabel: null,
  };
}

export function mapKnockoutBracketMatchDisplay(
  match: KnockoutBracketMatchDisplayRow,
  matches: readonly KnockoutBracketMatchDisplayRow[],
  feeders: Map<string, KnockoutBracketMatchDisplayRow>,
): Pick<KnockoutBracketMatchSummary, 'homeSlot' | 'awaySlot'> {
  const homeFeeder = feeders.get(feederMapKey(match.id, MatchSide.TeamA));
  const awayFeeder = feeders.get(feederMapKey(match.id, MatchSide.TeamB));

  const homeSlot =
    match.homeTeamId != null
      ? mapAssignedSlot(match.homeTeamId, match.homeTeam, match, matches)
      : mapOpenSlot(homeFeeder);

  const awaySlot =
    match.awayTeamId != null
      ? mapAssignedSlot(match.awayTeamId, match.awayTeam, match, matches)
      : mapOpenSlot(awayFeeder);

  return { homeSlot, awaySlot };
}

export function enrichKnockoutBracketMatches(
  matches: KnockoutBracketMatchDisplayRow[],
): KnockoutBracketMatchSummary[] {
  const feeders = buildFeederMap(matches);
  return matches.map((row) => ({
    id: row.id,
    bracketRoundIndex: row.bracketRoundIndex,
    bracketPosition: row.bracketPosition,
    bracketRoundLabel: row.bracketRoundLabel,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    state: row.state,
    confirmedAt: row.confirmedAt,
    winningTeamId: row.winningTeamId,
    isNoResult: row.isNoResult,
    awaitingTeams: row.awaitingTeams,
    requiresResolution: row.requiresResolution,
    awaitingScorecardConfirmation: knockoutMatchAwaitingScorecardConfirmation({
      state: row.state,
      confirmedAt: row.confirmedAt,
    }),
    ...mapKnockoutBracketMatchDisplay(row, matches, feeders),
  }));
}
