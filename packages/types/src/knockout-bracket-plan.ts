import { MatchSide, MatchType } from './match';
import {
  KnockoutRound2SlotSide,
  type KnockoutSeedingResult,
} from './knockout-seeding';

export interface PlannedKnockoutMatch {
  bracketRoundIndex: number;
  bracketPosition: number;
  bracketRoundLabel: string;
  matchType: MatchType;
  homeTeamId: string | null;
  awayTeamId: string | null;
  awaitingTeams: boolean;
  /** Parent match key `${roundIndex}:${position}` — null for the final. */
  nextMatchKey: string | null;
  nextMatchSlot: MatchSide | null;
}

export function deriveKnockoutRoundLabel(
  bracketSize: number,
  roundIndex: number,
): string {
  const teamsInRound = 2 ** (roundIndex + 1);
  if (teamsInRound === 2) {
    return 'Final';
  }
  if (teamsInRound === 4) {
    return 'Semi Final';
  }
  if (teamsInRound === 8) {
    return 'Quarter Final';
  }
  if (teamsInRound === 16) {
    return 'Round of 16';
  }
  if (teamsInRound === 32) {
    return 'Round of 32';
  }
  return `Round of ${teamsInRound}`;
}

export function matchTypeForKnockoutRound(
  bracketSize: number,
  roundIndex: number,
): MatchType {
  const label = deriveKnockoutRoundLabel(bracketSize, roundIndex);
  switch (label) {
    case 'Final':
      return MatchType.Final;
    case 'Semi Final':
      return MatchType.SemiFinal;
    case 'Quarter Final':
      return MatchType.QuarterFinal;
    default:
      return MatchType.PreQuarterFinal;
  }
}

function matchKey(roundIndex: number, position: number): string {
  return `${roundIndex}:${position}`;
}

function resolveAwaitingTeams(
  homeTeamId: string | null,
  awayTeamId: string | null,
): boolean {
  return !(homeTeamId && awayTeamId);
}

/** Pure bracket tree plan from Phase 2 seeding output. */
export function buildKnockoutBracketPlan(
  seeding: KnockoutSeedingResult,
): PlannedKnockoutMatch[] {
  const { bracketSize, byeCount, round1Matches, byeTeams } = seeding;
  const roundCount = Math.log2(bracketSize);
  if (!Number.isInteger(roundCount) || roundCount < 1) {
    throw new Error(`Invalid bracket size ${bracketSize}`);
  }

  const maxRoundIndex = roundCount - 1;
  const planned: PlannedKnockoutMatch[] = [];
  const byKey = new Map<string, PlannedKnockoutMatch>();

  for (let roundIndex = 0; roundIndex <= maxRoundIndex - 1; roundIndex += 1) {
    const matchCount = 2 ** roundIndex;
    for (let position = 0; position < matchCount; position += 1) {
      let homeTeamId: string | null = null;
      let awayTeamId: string | null = null;

      if (roundIndex === maxRoundIndex - 1 && byeCount > 0) {
        for (const bye of byeTeams) {
          if (bye.feedsRound2Slot !== position) {
            continue;
          }
          if (bye.round2SlotSide === KnockoutRound2SlotSide.Home) {
            homeTeamId = bye.teamId;
          } else {
            awayTeamId = bye.teamId;
          }
        }
      }

      const entry: PlannedKnockoutMatch = {
        bracketRoundIndex: roundIndex,
        bracketPosition: position,
        bracketRoundLabel: deriveKnockoutRoundLabel(bracketSize, roundIndex),
        matchType: matchTypeForKnockoutRound(bracketSize, roundIndex),
        homeTeamId,
        awayTeamId,
        awaitingTeams: resolveAwaitingTeams(homeTeamId, awayTeamId),
        nextMatchKey: roundIndex > 0 ? matchKey(roundIndex - 1, Math.floor(position / 2)) : null,
        nextMatchSlot:
          roundIndex > 0
            ? position % 2 === 0
              ? MatchSide.TeamA
              : MatchSide.TeamB
            : null,
      };
      planned.push(entry);
      byKey.set(matchKey(roundIndex, position), entry);
    }
  }

  const playInLabel =
    byeCount > 0
      ? 'Pre Quarter Final'
      : deriveKnockoutRoundLabel(bracketSize, maxRoundIndex);

  for (const playIn of round1Matches) {
    const parentKey = matchKey(maxRoundIndex - 1, playIn.feedsRound2Slot);
    const parent = byKey.get(parentKey);
    if (!parent) {
      throw new Error(
        `Missing parent match for play-in at feedsRound2Slot ${playIn.feedsRound2Slot}`,
      );
    }

    let nextMatchSlot: MatchSide;
    if (parent.homeTeamId && !parent.awayTeamId) {
      nextMatchSlot = MatchSide.TeamB;
    } else if (!parent.homeTeamId && parent.awayTeamId) {
      nextMatchSlot = MatchSide.TeamA;
    } else if (!parent.homeTeamId && !parent.awayTeamId) {
      nextMatchSlot =
        playIn.bracketPosition % 2 === 0 ? MatchSide.TeamA : MatchSide.TeamB;
    } else {
      throw new Error(
        `Parent match ${parentKey} has no open slot for play-in bracketPosition ${playIn.bracketPosition}`,
      );
    }

    planned.push({
      bracketRoundIndex: maxRoundIndex,
      bracketPosition: playIn.bracketPosition,
      bracketRoundLabel: playInLabel,
      matchType: MatchType.PreQuarterFinal,
      homeTeamId: playIn.higherSeedTeamId,
      awayTeamId: playIn.lowerSeedTeamId,
      awaitingTeams: false,
      nextMatchKey: parentKey,
      nextMatchSlot,
    });
  }

  return planned;
}

export function countPlannedKnockoutMatches(plan: readonly PlannedKnockoutMatch[]): number {
  return plan.length;
}
