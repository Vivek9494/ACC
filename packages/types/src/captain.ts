import type { CaptainUpcomingMatchActions } from './captain-dashboard-actions';
import type { MatchState } from './match';
import type { CaptainPunchTimeCardView } from './attendance';
import type { ManagerPlayerStats, MatchSummaryTeamView } from './club-manager';
import type { CaptainPlayingXiCardView, ParticipationPollCardView } from './poll';
import type { TournamentSummary } from './tournament';

/** Featured match presentation on the Captain / Vice-Captain home screen. */
export type CaptainFeaturedMatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

/** Featured match for a captain's team (current or next fixture). */
export interface CaptainFeaturedMatchSummary {
  matchId: string;
  tournamentName: string;
  state: MatchState;
  status: CaptainFeaturedMatchStatus;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  /** Toss / pre-match line shown while live or before a result (blue text). */
  infoLine: string | null;
  /** Completed-match result line, e.g. "Barrie Cobras won by 40 runs". */
  resultLine: string | null;
}

/** Completed match awaiting Man of the Match from the winning captain (§13.3). */
export interface CaptainPendingManOfMatch {
  matchId: string;
  teamName: string;
  resultLine: string | null;
  /** MoM selection is mandatory for registered winning teams. */
  required: boolean;
  /** End of the match calendar day (UTC ISO). */
  dueAt: string | null;
  /** Past deadline with no selection — still selectable. */
  overdue: boolean;
}

/** Currently assigned per-match Scorer, if any (§11.1). */
export interface AssignedScorerSummary {
  userId: string;
  firstName: string;
  lastName: string;
}

/**
 * Match the captain/organizer may assign a Scorer for during the pre-live window
 * (§11.1). Same card chrome as {@link ScorerStartableMatch}; button drives assign/switch.
 */
export interface CaptainScorerAssignmentMatch {
  matchId: string;
  tournamentName: string;
  dateTimeLine: string;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  assignedScorer: AssignedScorerSummary | null;
}

/** Captain-only upcoming leather match card with stacked prep actions. */
export interface CaptainUpcomingMatchCardView {
  matchId: string;
  teamId: string;
  tournamentName: string;
  dateTimeLine: string;
  venue: string | null;
  matchTitle: string;
  /** While the poll is open — captain votes inline on this card. */
  participationPoll: ParticipationPollCardView | null;
  /** After poll close — launches Confirm/Edit Playing XI. */
  playingXiEntry: { pollId: string; hasSavedSquad: boolean } | null;
  /** Pre-live scorer assignment for this match (populated when assign button may show). */
  scorerAssignment: CaptainScorerAssignmentMatch | null;
  /** Server-computed visibility for each stacked action button. */
  actions: CaptainUpcomingMatchActions;
}

/** Captain / Vice-Captain dashboard payload (GET /captain/dashboard). */
export interface CaptainDashboard {
  featuredMatch: CaptainFeaturedMatchSummary | null;
  /** Captain-only unified upcoming leather match card; null for vice-captains. */
  upcomingMatchCard: CaptainUpcomingMatchCardView | null;
  /** Leather-ball participation poll for vice-captains (and when no unified card). */
  participationPoll: ParticipationPollCardView | null;
  /** @deprecated Folded into {@link upcomingMatchCard}. */
  playingXiCard: CaptainPlayingXiCardView | null;
  /** @deprecated Folded into {@link upcomingMatchCard}. */
  punchTimeCard: CaptainPunchTimeCardView | null;
  /** Most recent completed win still needing a MoM pick from this captain. */
  pendingManOfMatch: CaptainPendingManOfMatch | null;
  /** Pre-live fixture in the scorer-assignment window; null when none or outside window. */
  scorerAssignmentMatch: CaptainScorerAssignmentMatch | null;
  /** Captains and VCs are always players — zeros allowed. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentSummary[];
}
