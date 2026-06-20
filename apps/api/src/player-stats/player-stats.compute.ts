import type { ScorecardResponse } from '@acc/types';
import {
  DismissalType,
  computeBattingAverage,
  computeStrikeRate,
  computeStrikeRateBarPercent,
  formatPlayerProfileBestBowling,
  formatPlayerProfileHighestScore,
  type PlayerProfileCareerStats,
  type PlayerProfilePeriodStats,
} from '@acc/types';

export interface HighestScoreRecord {
  runs: number;
  notOut: boolean;
  opponent: string | null;
  venue: string | null;
  year: number | null;
}

export interface BestBowlingRecord {
  wickets: number;
  runsConceded: number;
  opponent: string | null;
  year: number | null;
}

export interface PlayerStatsAccumulator {
  lockedXiMatchIds: Set<string>;
  runs: number;
  balls: number;
  dismissals: number;
  fours: number;
  sixes: number;
  wickets: number;
  catches: number;
  droppedCatches: number;
  stumpings: number;
  highestScore: HighestScoreRecord | null;
  bestBowling: BestBowlingRecord | null;
  lastStumpingYear: number | null;
  earliestMatchDate: Date | null;
  latestMatchDate: Date | null;
}

export function createPlayerStatsAccumulator(): PlayerStatsAccumulator {
  return {
    lockedXiMatchIds: new Set(),
    runs: 0,
    balls: 0,
    dismissals: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    catches: 0,
    droppedCatches: 0,
    stumpings: 0,
    highestScore: null,
    bestBowling: null,
    lastStumpingYear: null,
    earliestMatchDate: null,
    latestMatchDate: null,
  };
}

export interface PlayerMatchStatsContext {
  matchId: string;
  matchDate: Date | null;
  opponentName: string | null;
  groundLocation: string | null;
  year: number;
}

function isBetterHighestScore(
  current: HighestScoreRecord | null,
  candidate: HighestScoreRecord,
): boolean {
  if (!current) {
    return true;
  }
  if (candidate.runs !== current.runs) {
    return candidate.runs > current.runs;
  }
  return candidate.notOut && !current.notOut;
}

function isBetterBowling(current: BestBowlingRecord | null, candidate: BestBowlingRecord): boolean {
  if (!current) {
    return true;
  }
  if (candidate.wickets !== current.wickets) {
    return candidate.wickets > current.wickets;
  }
  return candidate.runsConceded < current.runsConceded;
}

function trackMatchDates(acc: PlayerStatsAccumulator, matchDate: Date | null): void {
  if (!matchDate) {
    return;
  }
  if (!acc.earliestMatchDate || matchDate < acc.earliestMatchDate) {
    acc.earliestMatchDate = matchDate;
  }
  if (!acc.latestMatchDate || matchDate > acc.latestMatchDate) {
    acc.latestMatchDate = matchDate;
  }
}

function applyFieldingCredit(
  acc: PlayerStatsAccumulator,
  batter: {
    fielderId: string | null;
    isOut: boolean;
    dismissalType: string | null;
  },
  userId: string,
  year: number,
): void {
  if (!batter.isOut || batter.fielderId !== userId || !batter.dismissalType) {
    return;
  }
  if (batter.dismissalType === DismissalType.Stumped) {
    acc.stumpings += 1;
    acc.lastStumpingYear = year;
    return;
  }
  if (batter.dismissalType === DismissalType.Caught) {
    acc.catches += 1;
  }
}

/** Fold one locked-XI scored match into a player's running totals. */
export function applyMatchToPlayerStats(
  acc: PlayerStatsAccumulator,
  userId: string,
  context: PlayerMatchStatsContext,
  scorecard: ScorecardResponse,
): void {
  acc.lockedXiMatchIds.add(context.matchId);
  trackMatchDates(acc, context.matchDate);

  for (const innings of scorecard.innings) {
    for (const batter of innings.batters) {
      if (batter.playerId === userId) {
        acc.runs += batter.runs;
        acc.balls += batter.balls;
        acc.fours += batter.fours;
        acc.sixes += batter.sixes;
        if (batter.isOut) {
          acc.dismissals += 1;
        }

        if (batter.runs > 0 || batter.balls > 0 || batter.isOut) {
          const candidate: HighestScoreRecord = {
            runs: batter.runs,
            notOut: !batter.isOut,
            opponent: context.opponentName,
            venue: context.groundLocation,
            year: context.year,
          };
          if (isBetterHighestScore(acc.highestScore, candidate)) {
            acc.highestScore = candidate;
          }
        }
      }

      applyFieldingCredit(acc, batter, userId, context.year);
    }

    for (const drop of innings.droppedCatches ?? []) {
      if (drop.playerId === userId) {
        acc.droppedCatches += drop.count;
      }
    }

    for (const bowler of innings.bowlers) {
      if (bowler.playerId !== userId) {
        continue;
      }
      acc.wickets += bowler.wickets;

      if (bowler.wickets > 0 || bowler.legalBalls > 0) {
        const candidate: BestBowlingRecord = {
          wickets: bowler.wickets,
          runsConceded: bowler.runsConceded,
          opponent: context.opponentName,
          year: context.year,
        };
        if (isBetterBowling(acc.bestBowling, candidate)) {
          acc.bestBowling = candidate;
        }
      }
    }
  }
}

function formatHighestScoreContext(record: HighestScoreRecord | null): string | null {
  if (!record) {
    return null;
  }
  const parts = [record.venue, record.year != null ? String(record.year) : null].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatBestBowlingContext(record: BestBowlingRecord | null): string | null {
  if (!record) {
    return null;
  }
  const parts = [
    record.opponent ? `vs ${record.opponent}` : null,
    record.year != null ? String(record.year) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function buildPlayerProfilePeriodStats(acc: PlayerStatsAccumulator): PlayerProfilePeriodStats {
  const hs = acc.highestScore;
  const bbi = acc.bestBowling;

  return {
    matches: acc.lockedXiMatchIds.size,
    runs: acc.runs,
    average: computeBattingAverage(acc.runs, acc.dismissals),
    highestScore: hs ? formatPlayerProfileHighestScore(hs.runs, hs.notOut) : null,
    highestScoreOpponent: hs?.opponent ?? null,
    highestScoreContext: formatHighestScoreContext(hs),
    strikeRate: computeStrikeRate(acc.runs, acc.balls),
    wickets: acc.wickets,
    bestBowling: bbi ? formatPlayerProfileBestBowling(bbi.wickets, bbi.runsConceded) : null,
    bestBowlingContext: formatBestBowlingContext(bbi),
    catches: acc.catches,
    droppedCatches: acc.droppedCatches,
    stumpings: acc.stumpings,
    sixes: acc.sixes,
    fours: acc.fours,
  };
}

export function buildPlayerProfileCareerStats(
  acc: PlayerStatsAccumulator,
): PlayerProfileCareerStats {
  const period = buildPlayerProfilePeriodStats(acc);

  let careerSpanYears: number | null = null;
  if (acc.earliestMatchDate && acc.latestMatchDate) {
    const startYear = acc.earliestMatchDate.getUTCFullYear();
    const endYear = acc.latestMatchDate.getUTCFullYear();
    careerSpanYears = Math.max(0, endYear - startYear);
  }

  return {
    ...period,
    careerSpanYears,
    strikeRateBarPercent: computeStrikeRateBarPercent(period.strikeRate),
  };
}
