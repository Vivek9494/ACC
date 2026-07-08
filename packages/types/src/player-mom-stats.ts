import type { ScorecardResponse } from './scoring';
import { formatBowlerOmRw, type BatterCard, type BowlerCard } from './scoring';
import {
  computeEconomyRate,
  computeStrikeRate,
  formatLeaderboardEconomy,
  formatLeaderboardStrikeRate,
} from './leaderboard';
import type { BallType } from './rbac';

export interface PlayerMomBattingFigures {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number | null;
}

export interface PlayerMomBowlingFigures {
  oversText: string;
  maidens: number;
  wickets: number;
  runsConceded: number;
  economy: number | null;
}

export interface PlayerMomMatchFigures {
  batting: PlayerMomBattingFigures | null;
  bowling: PlayerMomBowlingFigures | null;
}

export interface PlayerMomMatchSummary {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  matchDate: string | null;
  homeTeamName: string;
  awayTeamName: string;
  resultNote: string | null;
  figures: PlayerMomMatchFigures;
  awardedAt: string | null;
}

export interface OwnPlayerMomStatsSummary {
  count: number;
  mostRecent: PlayerMomMatchSummary | null;
}

export interface OwnPlayerMomMatchesView {
  ballType: BallType;
  count: number;
  matches: PlayerMomMatchSummary[];
}

function aggregateBatterCards(cards: BatterCard[]): BatterCard | null {
  if (cards.length === 0) return null;
  const first = cards[0]!;
  const aggregated = cards.slice(1).reduce(
    (acc, card) => ({
      ...acc,
      runs: acc.runs + card.runs,
      balls: acc.balls + card.balls,
      fours: acc.fours + card.fours,
      sixes: acc.sixes + card.sixes,
    }),
    { ...first },
  );
  return {
    ...aggregated,
    strikeRate: computeStrikeRate(aggregated.runs, aggregated.balls) ?? 0,
  };
}

function aggregateBowlerCards(cards: BowlerCard[]): BowlerCard | null {
  if (cards.length === 0) return null;
  const legalBalls = cards.reduce((sum, card) => sum + card.legalBalls, 0);
  const oversWhole = Math.floor(legalBalls / 6);
  const oversPart = legalBalls % 6;
  const runsConceded = cards.reduce((sum, card) => sum + card.runsConceded, 0);
  return {
    playerId: cards[0]!.playerId,
    legalBalls,
    oversText: `${oversWhole}.${oversPart}`,
    runsConceded,
    wickets: cards.reduce((sum, card) => sum + card.wickets, 0),
    maidens: cards.reduce((sum, card) => sum + card.maidens, 0),
    dotBalls: cards.reduce((sum, card) => sum + card.dotBalls, 0),
    wides: cards.reduce((sum, card) => sum + card.wides, 0),
    noBalls: cards.reduce((sum, card) => sum + card.noBalls, 0),
    fours: cards.reduce((sum, card) => sum + card.fours, 0),
    sixes: cards.reduce((sum, card) => sum + card.sixes, 0),
    economy: computeEconomyRate(runsConceded, legalBalls) ?? 0,
  };
}

/** Whole-match batting + bowling figures for one player from the event-sourced scorecard. */
export function buildPlayerMomMatchFigures(
  card: ScorecardResponse,
  userId: string,
): PlayerMomMatchFigures {
  const batterCards = card.innings.flatMap((innings) =>
    innings.batters.filter((batter) => batter.playerId === userId),
  );
  const bowlerCards = card.innings.flatMap((innings) =>
    innings.bowlers.filter((bowler) => bowler.playerId === userId),
  );
  const battingAgg = aggregateBatterCards(batterCards);
  const bowlingAgg = aggregateBowlerCards(bowlerCards);

  const batting =
    battingAgg && battingAgg.balls >= 1
      ? {
          runs: battingAgg.runs,
          balls: battingAgg.balls,
          fours: battingAgg.fours,
          sixes: battingAgg.sixes,
          strikeRate: computeStrikeRate(battingAgg.runs, battingAgg.balls),
        }
      : null;

  const bowling =
    bowlingAgg && bowlingAgg.legalBalls > 0
      ? {
          oversText: bowlingAgg.oversText,
          maidens: bowlingAgg.maidens,
          wickets: bowlingAgg.wickets,
          runsConceded: bowlingAgg.runsConceded,
          economy: computeEconomyRate(bowlingAgg.runsConceded, bowlingAgg.legalBalls),
        }
      : null;

  return { batting, bowling };
}

/** True when the player faced at least one ball or bowled at least one legal delivery. */
export function hasPlayerMomMatchFigures(card: ScorecardResponse, userId: string): boolean {
  const figures = buildPlayerMomMatchFigures(card, userId);
  return figures.batting != null || figures.bowling != null;
}

export function formatPlayerMomBattingLine(batting: PlayerMomBattingFigures): string {
  const sr = formatLeaderboardStrikeRate(batting.strikeRate);
  return `${batting.runs}(${batting.balls}), ${batting.fours}×4, ${batting.sixes}×6, SR ${sr}`;
}

export function formatPlayerMomBowlingLine(bowling: PlayerMomBowlingFigures): string {
  const omrw = formatBowlerOmRw({
    oversText: bowling.oversText,
    maidens: bowling.maidens,
    runsConceded: bowling.runsConceded,
    wickets: bowling.wickets,
  });
  return `${omrw}, Eco ${formatLeaderboardEconomy(bowling.economy)}`;
}

/** True when the innings tab belongs to the registered winning team. */
export function isWinningTeamInningsTab(
  innings: { battingTeamId: string | null },
  winningTeamId: string | null | undefined,
): boolean {
  return winningTeamId != null && innings.battingTeamId === winningTeamId;
}
