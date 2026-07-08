import type { BallType } from './rbac';
import { BallType as BallTypeValues } from './rbac';
import { computeBattingAverage, computeStrikeRate } from './leaderboard';
import type { OwnPlayerMomStatsSummary } from './player-mom-stats';

/** Period-scoped stats (year or tournament drilldown). */
export interface PlayerProfilePeriodStats {
  matches: number;
  runs: number;
  average: number | null;
  highestScore: string | null;
  highestScoreOpponent: string | null;
  highestScoreContext: string | null;
  strikeRate: number | null;
  wickets: number;
  bestBowling: string | null;
  bestBowlingContext: string | null;
  catches: number;
  /** Derived from CATCH_DROP events — available for profile display. */
  droppedCatches: number;
  stumpings: number;
  sixes: number;
  fours: number;
}

/** Career aggregates for one ball-type scope (all Leather or all Tennis matches). */
export interface PlayerProfileCareerStats extends PlayerProfilePeriodStats {
  /** Whole years between earliest and latest locked-XI match dates in this scope. */
  careerSpanYears: number | null;
  /** Cosmetic 0–100 fill for strike-rate progress bar (SR capped at 200). */
  strikeRateBarPercent: number | null;
}

export interface PlayerProfileYearSummary {
  year: number;
  stats: PlayerProfilePeriodStats;
}

export interface PlayerProfileTournamentSummary {
  tournamentId: string;
  tournamentName: string;
  year: number;
  teamName: string | null;
  stats: PlayerProfilePeriodStats;
}

export const PLAYER_PROFILE_BALL_TYPE_LABELS: Record<BallType, string> = {
  [BallTypeValues.Leather]: 'Leather Ball stats',
  [BallTypeValues.Tennis]: 'Tennis Ball stats',
};

/** Tournament-scoped player profile — captains and Club Managers only (server-enforced). */
export interface TournamentPlayerProfileView {
  userId: string;
  tournamentId: string;
  teamId: string | null;
  teamName: string | null;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  /** Player's home center (User.center). */
  centerName: string | null;
  /** Ball type of the originating tournament — scopes all stats on this profile. */
  ballType: BallType;
  /** Display label for the active ball-type scope. */
  ballTypeLabel: string;
  /** Registration self-reported role label, e.g. "All-rounder". */
  playerRoleLabel: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  /** Registration fielding position Wicketkeeper in the context tournament. */
  isWicketkeeper: boolean;
  /** True when isWicketkeeper and career stumpings > 0 — mobile shows the stumpings card. */
  showStumpingsCard: boolean;
  /** Registration skill ratings (§7.1 / §7.5): integers 0–10. */
  battingRating: number | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
  career: PlayerProfileCareerStats;
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
}

/** Logged-in player's overall career stats (GET /profile/stats). */
export interface OwnPlayerStatsView {
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  centerName: string | null;
  playerRoleLabel: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  ballType: BallType;
  ballTypeLabel: string;
  career: PlayerProfileCareerStats;
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
  showStumpingsCard: boolean;
  /** Man of the Match awards in this ball-type scope (logged-in user only). */
  manOfTheMatch: OwnPlayerMomStatsSummary;
}

export function formatPlayerProfileDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function formatPlayerProfileHighestScore(runs: number, notOut: boolean): string {
  return notOut ? `${runs}*` : String(runs);
}

export function formatPlayerProfileBestBowling(wickets: number, runsConceded: number): string {
  return `${wickets}/${runsConceded}`;
}

export function formatPlayerProfileAverage(value: number | null): string {
  return value == null ? '–' : value.toFixed(2);
}

export function formatPlayerProfileStrikeRate(value: number | null): string {
  if (value == null) {
    return '–';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatPlayerProfileCareerSpanYears(years: number | null): string | null {
  if (years == null) {
    return null;
  }
  if (years < 1) {
    return '<1 yr';
  }
  return `${years} yr${years === 1 ? '' : 's'}`;
}

/** Cosmetic bar width — caps strike rate at 200 for display. */
export function computeStrikeRateBarPercent(strikeRate: number | null): number | null {
  if (strikeRate == null) {
    return null;
  }
  return Math.min(100, Math.round((strikeRate / 200) * 100));
}

export function formatPlayerProfileInteger(value: number): string {
  return value.toLocaleString('en-CA');
}

export { computeBattingAverage, computeStrikeRate };
