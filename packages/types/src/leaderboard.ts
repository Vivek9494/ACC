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
  /** Balls faced (qualifies Best Strike Rate). */
  balls: number;
  /** Innings scoring 30–49 (exclusive of fifties/hundreds). */
  thirties: number;
  /** Innings scoring 50–99 (exclusive of hundreds). */
  fifties: number;
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
  /** Matches in the Playing XI (independent of whether they bowled). */
  matches: number;
  /** Innings in which the bowler bowled at least one delivery. */
  innings: number;
  wickets: number;
  /** Legal balls bowled (qualifies Best Economy). */
  legalBalls: number;
  /**
   * Best per-innings figures as "W/R" (e.g. "5/23"); null when no bowling innings.
   * Ranking: most wickets, then fewer runs conceded.
   */
  bestBowling: string | null;
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

/** Bowling strike rate = legal balls ÷ wickets; null when no wickets. */
export function computeBowlingStrikeRate(
  legalBalls: number,
  wickets: number,
): number | null {
  if (wickets <= 0) {
    return null;
  }
  return Math.round((legalBalls / wickets) * 100) / 100;
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

/** Rows on each tournament top-N leaderboard card. */
export const LEADERBOARD_TOP_N = 10;
/** Balls faced needed to appear on Best Strike Rate. */
export const BEST_STRIKE_RATE_MIN_BALLS = 10;
/** Legal balls bowled (2 overs) needed to appear on Best Economy. */
export const BEST_ECONOMY_MIN_LEGAL_BALLS = 12;

function byPlayerName(
  left: Pick<BattingLeaderboardEntry, 'firstName' | 'lastName'>,
  right: Pick<BattingLeaderboardEntry, 'firstName' | 'lastName'>,
): number {
  return `${left.lastName} ${left.firstName}`.trim().localeCompare(`${right.lastName} ${right.firstName}`.trim());
}

/** Top run scorers (server order: runs desc), batters who batted at least once. */
export function topRunScorers(
  entries: readonly BattingLeaderboardEntry[],
  limit = LEADERBOARD_TOP_N,
): BattingLeaderboardEntry[] {
  return entries.filter((entry) => entry.matches > 0).slice(0, limit);
}

/** Top wicket takers (server order: wickets desc, economy asc), bowlers with at least one wicket. */
export function topWicketTakers(
  entries: readonly BowlingLeaderboardEntry[],
  limit = LEADERBOARD_TOP_N,
): BowlingLeaderboardEntry[] {
  return entries.filter((entry) => entry.wickets > 0).slice(0, limit);
}

/** Highest strike rate among batters with at least {@link BEST_STRIKE_RATE_MIN_BALLS} balls faced. */
export function bestStrikeRates(
  entries: readonly BattingLeaderboardEntry[],
  limit = LEADERBOARD_TOP_N,
): BattingLeaderboardEntry[] {
  return entries
    .filter((entry) => entry.balls >= BEST_STRIKE_RATE_MIN_BALLS && entry.strikeRate != null)
    .sort(
      (left, right) =>
        (right.strikeRate ?? 0) - (left.strikeRate ?? 0) || right.runs - left.runs || byPlayerName(left, right),
    )
    .slice(0, limit);
}

/** Lowest economy among bowlers with at least {@link BEST_ECONOMY_MIN_LEGAL_BALLS} legal balls. */
export function bestEconomies(
  entries: readonly BowlingLeaderboardEntry[],
  limit = LEADERBOARD_TOP_N,
): BowlingLeaderboardEntry[] {
  return entries
    .filter((entry) => entry.legalBalls >= BEST_ECONOMY_MIN_LEGAL_BALLS && entry.economy != null)
    .sort(
      (left, right) =>
        (left.economy ?? 0) - (right.economy ?? 0) ||
        right.legalBalls - left.legalBalls ||
        byPlayerName(left, right),
    )
    .slice(0, limit);
}
