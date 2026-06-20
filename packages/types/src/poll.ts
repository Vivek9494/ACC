/** Player participation vote for a leather-ball match poll (§9.7). */
import { DateTime } from 'luxon';

import type { RegistrationPlayerType } from './registration';
import type { MatchScheduleAnchor } from './timezone';
import { getMatchCalendarDayInZone } from './timezone';

export const PollVoteChoice = {
  In: 'IN',
  Out: 'OUT',
} as const;
export type PollVoteChoice = (typeof PollVoteChoice)[keyof typeof PollVoteChoice];

/** Days before match date when the participation poll opens. */
export const PARTICIPATION_POLL_OPEN_LEAD_DAYS = 5;

/** Poll auto-closes at 5 PM on this many calendar days before the match date. */
export const PARTICIPATION_POLL_CLOSE_LEAD_DAYS = 2;

/** Local hour (24h) on the close calendar day. */
export const PARTICIPATION_POLL_CLOSE_HOUR = 17;

/** Dashboard "Are you playing?" card for a rostered player. */
export interface ParticipationPollCardView {
  pollId: string;
  matchId: string;
  teamId: string;
  tournamentName: string;
  teamName: string;
  opponentName: string;
  /** e.g. "ACC 3 vs ACC 6" */
  matchTitle: string;
  dateTimeLine: string;
  venue: string | null;
  /** UTC instants — canonical open/close for server and client comparisons. */
  opensAt: string;
  closesAt: string;
  /** IANA timezone persisted on the tournament; null when not resolved yet. */
  timezone: string | null;
  /** True when the client should format times in the viewer device timezone. */
  timezoneFallback: boolean;
  /** True while the player may submit or change their vote. */
  isOpen: boolean;
  userVote: PollVoteChoice | null;
}

export interface PollTallyPlayerRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  /** Registration-derived role/skill line (e.g. "Opening Batsman", "Fast Bowler"). */
  skillLabel: string | null;
  /** Leather registration player type; null for tennis. */
  playerType?: RegistrationPlayerType | null;
  /** Locked Playing XI appearances this tournament (part-time leather only). */
  matchesPlayedCount?: number | null;
}

/** Section headings on the Poll Results screen. */
export const POLL_RESULTS_SECTION_LABELS = {
  in: 'CONFIRMED PLAYERS',
  out: 'UNAVAILABLE PLAYERS',
  pending: 'AWAITING RESPONSE',
} as const;

export type PollResultsTab = keyof typeof POLL_RESULTS_SECTION_LABELS;

/** Team poll results for View Poll (§9.7). */
export interface ParticipationPollTallyView {
  pollId: string;
  matchId: string;
  teamName: string;
  inCount: number;
  outCount: number;
  /** Zero and empty when the requester is not the team captain. */
  pendingCount: number;
  in: PollTallyPlayerRow[];
  out: PollTallyPlayerRow[];
  pending: PollTallyPlayerRow[];
  /** Captain-only: whether {@link pending} is populated. */
  canViewPending: boolean;
}

export interface SubmitParticipationPollVoteRequest {
  choice: PollVoteChoice;
}

/** Captain dashboard card after the poll closes (§9.7). */
export interface CaptainPlayingXiCardView {
  pollId: string;
  matchId: string;
  teamId: string;
  tournamentName: string;
  teamName: string;
  opponentName: string;
  matchTitle: string;
  dateTimeLine: string;
  venue: string | null;
  /** Squad already saved — primary button becomes "Edit Playing 11". */
  hasSavedSquad: boolean;
}

/** One IN voter row on the poll-based Playing XI selection screen. */
export interface PollPlayingXiPlayerRow extends PollTallyPlayerRow {
  /** Current saved squad role for this player, if any. */
  squadRole: 'PLAYING_XI' | 'SUBSTITUTE' | null;
  /** Phase 1 punch recorded (match day on-ground status). */
  hasPunched?: boolean;
  /** Tournament team captain (RoleAssignment). */
  isTeamCaptain?: boolean;
  /** Registration fielding position Wicketkeeper. */
  isWicketkeeper?: boolean;
}

/** Penalty server designated at this match. */
export interface PollPenaltyServingPlayerRow extends PollTallyPlayerRow {
  penaltyId: string;
  /** Display label for penalty serve status (e.g. "Serving Penalty"). */
  statusLabel: string;
  hasPunched?: boolean;
}

/** Team member who currently owes a late-arrival penalty (OWED or ASSIGNED). */
export interface PollPenaltyOwingPlayerRow extends PollTallyPlayerRow {
  penaltyId: string;
  penaltyState: 'OWED' | 'ASSIGNED';
  /** True when designated to serve at this match. */
  designatedForThisMatch: boolean;
  /** False when already assigned to serve at a different match. */
  canDesignateForThisMatch: boolean;
}

export const PlayingXiNoShowRecoveryAction = {
  PromotePenaltyServer: 'PROMOTE_PENALTY_SERVER',
  SwapInOnGround: 'SWAP_IN_ON_GROUND',
} as const;

export type PlayingXiNoShowRecoveryAction =
  (typeof PlayingXiNoShowRecoveryAction)[keyof typeof PlayingXiNoShowRecoveryAction];

export interface PlayingXiNoShowRecoveryRequest {
  absentUserId: string;
  action: PlayingXiNoShowRecoveryAction;
  replacementUserId: string;
}

export interface PlayingXiSwitchRequest {
  replacedUserId: string;
  replacementUserId: string;
  /** Set true when swapping in a penalty server (cancels their penalty). */
  confirmPenaltyCancellation?: boolean;
}

/** Poll-based Playing XI picker payload (captain, after poll close). */
export interface PollPlayingXiSelectionView {
  pollId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  inCount: number;
  outCount: number;
  in: PollPlayingXiPlayerRow[];
  out: PollTallyPlayerRow[];
  hasSavedSquad: boolean;
  isMatchDay: boolean;
  /** Saved Playing XI rows (read-only summary). */
  playingXi: PollPlayingXiPlayerRow[];
  /** Saved substitute rows (read-only summary). */
  substitutes: PollPlayingXiPlayerRow[];
  /** Players designated to serve a late-arrival penalty at this match. */
  penaltyServing: PollPenaltyServingPlayerRow[];
  /** Team members who owe a penalty — for serve-designation checkboxes. */
  penaltyOwing: PollPenaltyOwingPlayerRow[];
  /**
   * Own-squad players punched on ground but not in the saved XI/subs/servers.
   * Populated on match day when recovery is enabled.
   */
  onGroundSwapCandidates: PollPlayingXiPlayerRow[];
  /** Match-day no-show recovery actions (before LIVE). */
  recoveryActionsEnabled: boolean;
  /** Playing XI rows eligible for no-show recovery on match day. */
  recoveryEligiblePlayingXi: PollPlayingXiPlayerRow[];
  /** Designated penalty servers punched in on match day (promote recovery). */
  penaltyServersOnGround: PollPlayingXiPlayerRow[];
  /** Manual XI switch available before LIVE when squad is saved. */
  switchActionsEnabled: boolean;
  /** Switch picker — substitutes (on-ground only on match day). */
  switchSubstituteCandidates: PollPlayingXiPlayerRow[];
  /** Switch picker — penalty servers at this match. */
  switchPenaltyServerCandidates: PollPenaltyServingPlayerRow[];
  /** Switch picker — own-squad players outside XI/subs/servers. */
  switchUnselectedCandidates: PollPlayingXiPlayerRow[];
}

export interface ConfirmPollPlayingXiRequest {
  playingXi: string[];
  substitutes: string[];
  /** User ids designated to serve a late-arrival penalty at this match. */
  penaltyServerUserIds: string[];
}

function matchDayInZone(match: MatchScheduleAnchor, timeZone: string): DateTime {
  const { year, month, day } = getMatchCalendarDayInZone(match, timeZone);
  return DateTime.fromObject({ year, month, day }, { zone: timeZone });
}

/** Poll opens at start of day, {@link PARTICIPATION_POLL_OPEN_LEAD_DAYS} before match date (venue-local). */
export function computeParticipationPollOpensAt(
  match: MatchScheduleAnchor,
  timeZone: string,
): Date {
  return matchDayInZone(match, timeZone)
    .minus({ days: PARTICIPATION_POLL_OPEN_LEAD_DAYS })
    .startOf('day')
    .toUTC()
    .toJSDate();
}

/** Poll closes at 5 PM, {@link PARTICIPATION_POLL_CLOSE_LEAD_DAYS} before match date (venue-local). */
export function computeParticipationPollClosesAt(
  match: MatchScheduleAnchor,
  timeZone: string,
): Date {
  return matchDayInZone(match, timeZone)
    .minus({ days: PARTICIPATION_POLL_CLOSE_LEAD_DAYS })
    .set({
      hour: PARTICIPATION_POLL_CLOSE_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    .toUTC()
    .toJSDate();
}

/** Compare canonical UTC instants (from DB or {@link computeParticipationPoll*}). */
export function isParticipationPollOpen(
  opensAt: Date | string,
  closesAt: Date | string,
  now: Date = new Date(),
): boolean {
  const open = typeof opensAt === 'string' ? new Date(opensAt) : opensAt;
  const close = typeof closesAt === 'string' ? new Date(closesAt) : closesAt;
  return now >= open && now < close;
}
