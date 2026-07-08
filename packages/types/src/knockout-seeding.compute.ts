import { compareTeamStandingRows } from './standings';
import {
  KnockoutRound2SlotSide,
  KnockoutSeedingOrder,
  nextPowerOfTwo,
  type KnockoutByeTeam,
  type KnockoutRound1Match,
  type KnockoutSeedAssignment,
  type KnockoutSeedingResult,
} from './knockout-seeding';
import type { QualifiedTeam } from './knockout-qualification';

export type HeadToHeadWinnerLookup = (
  teamAId: string,
  teamBId: string,
) => string | null;

export interface ComputeKnockoutSeedingInput {
  qualifiedTeams: readonly QualifiedTeam[];
  seedingOrder?: KnockoutSeedingOrder;
  headToHeadWinner?: HeadToHeadWinnerLookup;
}

function compareQualifiedTeams(
  a: QualifiedTeam,
  b: QualifiedTeam,
  headToHeadWinner: HeadToHeadWinnerLookup,
): number {
  const standingCompare = compareTeamStandingRows(
    {
      teamId: a.teamId,
      teamName: a.teamName,
      logoUrl: null,
      matches: 0,
      wins: 0,
      losses: 0,
      noResults: 0,
      points: a.points,
      netRunRate: a.netRunRate,
    },
    {
      teamId: b.teamId,
      teamName: b.teamName,
      logoUrl: null,
      matches: 0,
      wins: 0,
      losses: 0,
      noResults: 0,
      points: b.points,
      netRunRate: b.netRunRate,
    },
  );
  if (standingCompare !== 0) {
    return standingCompare;
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

function orderQualifiedTeamsForSeeding(
  qualifiedTeams: readonly QualifiedTeam[],
  seedingOrder: KnockoutSeedingOrder,
  headToHeadWinner: HeadToHeadWinnerLookup,
): QualifiedTeam[] {
  if (seedingOrder === KnockoutSeedingOrder.FlatStandings) {
    return [...qualifiedTeams].sort((a, b) =>
      compareQualifiedTeams(a, b, headToHeadWinner),
    );
  }
  return [...qualifiedTeams];
}

/** Standard single-elimination leaf order for a power-of-two bracket. */
export function buildBracketSeedLine(bracketSize: number): number[] {
  if (bracketSize < 2 || (bracketSize & (bracketSize - 1)) !== 0) {
    throw new Error(`Bracket size must be a power of two, got ${bracketSize}`);
  }

  let seeds = [1];
  let size = 2;
  while (size <= bracketSize) {
    seeds = seeds.flatMap((seed) => [seed, size + 1 - seed]);
    size <<= 1;
  }
  return seeds;
}

function seedToLeafIndex(seedLine: readonly number[], seed: number): number {
  const index = seedLine.indexOf(seed);
  if (index < 0) {
    throw new Error(`Seed ${seed} missing from bracket seed line`);
  }
  return index;
}

function round2SlotSideForLeaf(leafIndex: number): KnockoutRound2SlotSide {
  return leafIndex % 2 === 0
    ? KnockoutRound2SlotSide.Home
    : KnockoutRound2SlotSide.Away;
}

function buildRound1Pairings(
  bracketSize: number,
  knockoutTeamCount: number,
  byeCount: number,
): Array<{ bracketPosition: number; highSeed: number; lowSeed: number }> {
  const seedLine = buildBracketSeedLine(bracketSize);
  const round1MatchCount = bracketSize / 2;
  const pairings: Array<{ bracketPosition: number; highSeed: number; lowSeed: number }> = [];

  for (let bracketPosition = 0; bracketPosition < round1MatchCount; bracketPosition += 1) {
    const highSeed = seedLine[bracketPosition * 2]!;
    const lowSeed = seedLine[bracketPosition * 2 + 1]!;

    const highPlays =
      highSeed > byeCount && highSeed <= knockoutTeamCount;
    const lowPlays =
      lowSeed > byeCount && lowSeed <= knockoutTeamCount;

    if (highPlays && lowPlays) {
      const betterSeed = Math.min(highSeed, lowSeed);
      const worseSeed = Math.max(highSeed, lowSeed);
      pairings.push({
        bracketPosition,
        highSeed: betterSeed,
        lowSeed: worseSeed,
      });
    }
  }

  return pairings;
}

function teamForSeed(
  seededTeams: readonly QualifiedTeam[],
  seed: number,
): QualifiedTeam {
  const team = seededTeams[seed - 1];
  if (!team) {
    throw new Error(`Missing qualified team for seed ${seed}`);
  }
  return team;
}

/** Pure seeding engine — assigns seeds, byes, and round-1 play-in pairings. */
export function computeKnockoutSeeding(
  input: ComputeKnockoutSeedingInput,
): KnockoutSeedingResult {
  const knockoutTeamCount = input.qualifiedTeams.length;
  if (knockoutTeamCount < 2) {
    throw new Error('At least two qualified teams are required for seeding');
  }

  const headToHeadWinner = input.headToHeadWinner ?? (() => null);
  const seedingOrder = input.seedingOrder ?? KnockoutSeedingOrder.TopperThenWildcard;
  const seededTeams = orderQualifiedTeamsForSeeding(
    input.qualifiedTeams,
    seedingOrder,
    headToHeadWinner,
  );

  const bracketSize = nextPowerOfTwo(knockoutTeamCount);
  const byeCount = bracketSize - knockoutTeamCount;
  const seedLine = buildBracketSeedLine(bracketSize);

  const seeds: KnockoutSeedAssignment[] = seededTeams.map((team, index) => {
    const seed = index + 1;
    const hasBye = seed <= byeCount;
    const leafIndex = seedToLeafIndex(seedLine, seed);
    return {
      seed,
      teamId: team.teamId,
      teamName: team.teamName,
      qualificationType: team.qualificationType,
      hasBye,
      bracketSlot: leafIndex + 1,
      entersAtRound: hasBye ? 2 : 1,
    };
  });

  const byeTeams: KnockoutByeTeam[] = seeds
    .filter((seedRow) => seedRow.hasBye)
    .map((seedRow) => {
      const leafIndex = seedRow.bracketSlot - 1;
      const firstLayerPosition = Math.floor(leafIndex / 2);
      return {
        seed: seedRow.seed,
        teamId: seedRow.teamId,
        teamName: seedRow.teamName,
        bracketSlot: seedRow.bracketSlot,
        feedsRound2Slot: Math.floor(firstLayerPosition / 2),
        round2SlotSide: round2SlotSideForLeaf(leafIndex),
      };
    });

  const round1Matches: KnockoutRound1Match[] = buildRound1Pairings(
    bracketSize,
    knockoutTeamCount,
    byeCount,
  ).map(({ bracketPosition, highSeed, lowSeed }) => {
    const higherTeam = teamForSeed(seededTeams, highSeed);
    const lowerTeam = teamForSeed(seededTeams, lowSeed);
    return {
      bracketPosition,
      higherSeed: highSeed,
      lowerSeed: lowSeed,
      higherSeedTeamId: higherTeam.teamId,
      lowerSeedTeamId: lowerTeam.teamId,
      feedsRound2Slot: Math.floor(bracketPosition / 2),
    };
  });

  return {
    knockoutTeamCount,
    bracketSize,
    byeCount,
    seeds,
    round1Matches,
    byeTeams,
  };
}

/** True when two top seeds are placed in opposite bracket halves. */
export function topSeedsInOppositeHalves(
  seedLine: readonly number[],
  bracketSize: number,
): boolean {
  const seed1Index = seedLine.indexOf(1);
  const seed2Index = seedLine.indexOf(2);
  if (seed1Index < 0 || seed2Index < 0) {
    return false;
  }
  const halfSize = bracketSize / 2;
  const seed1Half = seed1Index < halfSize ? 0 : 1;
  const seed2Half = seed2Index < halfSize ? 0 : 1;
  return seed1Half !== seed2Half;
}
