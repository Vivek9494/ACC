/**
 * Tournament player leaderboards (§15.5) — derived from completed-match scoring data.
 */

export interface LeaderboardTeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** One ranked row on the batting leaderboard tab. */
export interface BattingLeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  /** Matches batted in (M). */
  matches: number;
  /** Total runs (R). */
  runs: number;
  /** Batting average; null when never dismissed (÷0 guard). */
  average: number | null;
  /** Strike rate; null when no balls faced. */
  strikeRate: number | null;
}

export interface TournamentBattingLeaderboard {
  entries: BattingLeaderboardEntry[];
}

/** One ranked row on the bowling leaderboard tab. */
export interface BowlingLeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  /** Matches bowled in. */
  matches: number;
  wickets: number;
  /** Economy rate; null when no balls bowled. */
  economy: number | null;
}

export interface TournamentBowlingLeaderboard {
  entries: BowlingLeaderboardEntry[];
}

export interface TournamentLeaderboard {
  tournamentId: string;
  /** True when at least one batting or bowling stat row exists. */
  hasRecords: boolean;
  teams: LeaderboardTeamOption[];
  batting: TournamentBattingLeaderboard;
  bowling: TournamentBowlingLeaderboard;
}

export function tournamentLeaderboardHasRecords(
  leaderboard:
    | Pick<TournamentLeaderboard, 'hasRecords' | 'batting' | 'bowling'>
    | null
    | undefined,
): boolean {
  if (!leaderboard) {
    return false;
  }
  return (
    leaderboard.hasRecords ||
    leaderboard.batting.entries.length > 0 ||
    leaderboard.bowling.entries.length > 0
  );
}

/** Batting average = runs ÷ dismissals; null when dismissed zero times. */
export function computeBattingAverage(runs: number, dismissals: number): number | null {
  if (dismissals <= 0) {
    return null;
  }
  return Math.round((runs / dismissals) * 100) / 100;
}

/** Bowling average = runs conceded ÷ wickets; null when no wickets. */
export function computeBowlingAverage(
  runsConceded: number,
  wickets: number,
): number | null {
  if (wickets <= 0) {
    return null;
  }
  return Math.round((runsConceded / wickets) * 100) / 100;
}

/** Strike rate = (runs ÷ balls) × 100; null when no balls faced. */
export function computeStrikeRate(runs: number, balls: number): number | null {
  if (balls <= 0) {
    return null;
  }
  return Math.round(((runs / balls) * 100) * 100) / 100;
}

export function formatLeaderboardAverage(average: number | null): string {
  return average == null ? '–' : average.toFixed(2);
}

export function formatLeaderboardStrikeRate(strikeRate: number | null): string {
  return strikeRate == null ? '–' : strikeRate.toFixed(2);
}

/** Economy = runs conceded ÷ (legal balls ÷ 6); null when no balls bowled. */
export function computeEconomyRate(runsConceded: number, legalBalls: number): number | null {
  if (legalBalls <= 0) {
    return null;
  }
  const overs = legalBalls / 6;
  return Math.round((runsConceded / overs) * 100) / 100;
}

export function formatLeaderboardEconomy(economy: number | null): string {
  return economy == null ? '–' : economy.toFixed(2);
}
