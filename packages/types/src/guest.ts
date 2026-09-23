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
  /** Currently live public (tennis) matches — carousel when 2+. */
  liveMatches: CaptainFeaturedMatchSummary[];
  /** Public tennis fixtures in the next 7 days, soonest→latest. */
  upcomingMatches: CaptainFeaturedMatchSummary[];
  /** Most recently completed fixture when nothing is live (unchanged). */
  recentMatch: CaptainFeaturedMatchSummary | null;
  /** Tournament for the featured match(es) — live, else upcoming, else recent. */
  featuredTournament: TournamentSummary | null;
}
