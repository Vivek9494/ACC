import type { CaptainFeaturedMatchSummary } from './captain';
import type { TournamentSummary } from './tournament';

/** One ball in the current over strip on the guest live card. */
export interface GuestThisOverBall {
  code: string;
  /** Boundary (4/6) or wicket — filled primary styling on mobile. */
  emphasis: 'normal' | 'primary' | 'wicket';
}

/** Current batter row on the guest live card. */
export interface GuestBatterView {
  name: string;
  runs: number;
  balls: number;
  isOut: boolean;
  onStrike: boolean;
}

/** Featured live match on the guest home screen (GET /guest/dashboard). */
export interface GuestFeaturedLiveMatch {
  matchId: string;
  tournamentName: string;
  battingTeamName: string;
  score: string;
  overs: string;
  batters: GuestBatterView[];
  projectedRuns: number;
  runRate: number;
  thisOver: GuestThisOverBall[];
}

/** Guest dashboard payload — public, no auth (spec §2). */
export interface GuestDashboard {
  /** When set, only the live card is featured on the home screen. */
  liveMatch: CaptainFeaturedMatchSummary | null;
  /** Soonest scheduled future fixture when nothing is live. */
  upcomingMatch: CaptainFeaturedMatchSummary | null;
  /** Most recently completed fixture when nothing is live. */
  recentMatch: CaptainFeaturedMatchSummary | null;
  /** Tournament for the featured match(es) — upcoming, else recent, else live. */
  featuredTournament: TournamentSummary | null;
}
