import type { BatterCard, BowlerCard } from '@acc/types';
import {
  computeBattingAverage,
  computeEconomyRate,
  computeStrikeRate,
  type BattingLeaderboardEntry,
  type BowlingLeaderboardEntry,
} from '@acc/types';

/** Per-player batting totals while folding completed-match scorecards. */
export interface BattingAccumulator {
  runs: number;
  balls: number;
  dismissals: number;
  battedMatchIds: Set<string>;
}

export function createBattingAccumulator(): BattingAccumulator {
  return { runs: 0, balls: 0, dismissals: 0, battedMatchIds: new Set() };
}

export function applyBatterInnings(
  acc: BattingAccumulator,
  matchId: string,
  batter: Pick<BatterCard, 'runs' | 'balls' | 'isOut'>,
): void {
  acc.runs += batter.runs;
  acc.balls += batter.balls;
  if (batter.isOut) {
    acc.dismissals += 1;
  }
  if (batter.balls > 0 || batter.runs > 0 || batter.isOut) {
    acc.battedMatchIds.add(matchId);
  }
}

export interface BuildBattingLeaderboardPlayerInput {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  accumulator: BattingAccumulator;
}

/** Sort by runs descending; assign rank = list position (1-based). */
export function buildBattingLeaderboardEntries(
  players: BuildBattingLeaderboardPlayerInput[],
): BattingLeaderboardEntry[] {
  const sorted = [...players].sort((left, right) => {
    const runsDiff = right.accumulator.runs - left.accumulator.runs;
    if (runsDiff !== 0) {
      return runsDiff;
    }
    const leftName = `${left.lastName} ${left.firstName}`.trim();
    const rightName = `${right.lastName} ${right.firstName}`.trim();
    return leftName.localeCompare(rightName);
  });

  return sorted.map((player, index) => {
    const { runs, balls, dismissals, battedMatchIds } = player.accumulator;
    return {
      rank: index + 1,
      userId: player.userId,
      firstName: player.firstName,
      lastName: player.lastName,
      profilePhotoUrl: player.profilePhotoUrl,
      teamId: player.teamId,
      teamName: player.teamName,
      teamLogoUrl: player.teamLogoUrl,
      matches: battedMatchIds.size,
      runs,
      average: computeBattingAverage(runs, dismissals),
      strikeRate: computeStrikeRate(runs, balls),
    };
  });
}

/** Per-player bowling totals while folding completed-match scorecards. */
export interface BowlingAccumulator {
  runsConceded: number;
  legalBalls: number;
  wickets: number;
  bowledMatchIds: Set<string>;
}

export function createBowlingAccumulator(): BowlingAccumulator {
  return { runsConceded: 0, legalBalls: 0, wickets: 0, bowledMatchIds: new Set() };
}

export function applyBowlerInnings(
  acc: BowlingAccumulator,
  matchId: string,
  bowler: Pick<BowlerCard, 'runsConceded' | 'legalBalls' | 'wickets'>,
): void {
  acc.runsConceded += bowler.runsConceded;
  acc.legalBalls += bowler.legalBalls;
  acc.wickets += bowler.wickets;
  if (bowler.legalBalls > 0 || bowler.wickets > 0 || bowler.runsConceded > 0) {
    acc.bowledMatchIds.add(matchId);
  }
}

export interface BuildBowlingLeaderboardPlayerInput {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  accumulator: BowlingAccumulator;
}

/**
 * Sort by wickets descending; tie-break lower economy, then fewer matches bowled.
 * Rank = list position (1-based).
 */
export function buildBowlingLeaderboardEntries(
  players: BuildBowlingLeaderboardPlayerInput[],
): BowlingLeaderboardEntry[] {
  const sorted = [...players].sort((left, right) => {
    const wicketsDiff = right.accumulator.wickets - left.accumulator.wickets;
    if (wicketsDiff !== 0) {
      return wicketsDiff;
    }

    const leftEconomy =
      computeEconomyRate(left.accumulator.runsConceded, left.accumulator.legalBalls) ??
      Number.POSITIVE_INFINITY;
    const rightEconomy =
      computeEconomyRate(right.accumulator.runsConceded, right.accumulator.legalBalls) ??
      Number.POSITIVE_INFINITY;
    const economyDiff = leftEconomy - rightEconomy;
    if (economyDiff !== 0) {
      return economyDiff;
    }

    const matchesDiff =
      left.accumulator.bowledMatchIds.size - right.accumulator.bowledMatchIds.size;
    if (matchesDiff !== 0) {
      return matchesDiff;
    }

    const leftName = `${left.lastName} ${left.firstName}`.trim();
    const rightName = `${right.lastName} ${right.firstName}`.trim();
    return leftName.localeCompare(rightName);
  });

  return sorted.map((player, index) => {
    const { runsConceded, legalBalls, wickets, bowledMatchIds } = player.accumulator;
    return {
      rank: index + 1,
      userId: player.userId,
      firstName: player.firstName,
      lastName: player.lastName,
      profilePhotoUrl: player.profilePhotoUrl,
      teamId: player.teamId,
      teamName: player.teamName,
      teamLogoUrl: player.teamLogoUrl,
      matches: bowledMatchIds.size,
      wickets,
      economy: computeEconomyRate(runsConceded, legalBalls),
    };
  });
}
