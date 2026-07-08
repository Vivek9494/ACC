/**
 * Tournament Matches tab list cards — display state, ordering, and API shape.
 */

import { canViewAdminUsersDirectory } from './admin';
import type { UserRole } from './auth';
import type { HomeAway } from './match';
import { MatchState, LIVE_MATCH_STATES, type MatchState as MatchStateType } from './match';
import { RegistrationStatus, type RegistrationStatus as RegistrationStatusType } from './registration';
export const MatchCardDisplayState = {
  Completed: 'COMPLETED',
  Live: 'LIVE',
  Scheduled: 'SCHEDULED',
  Cancelled: 'CANCELLED',
} as const;
export type MatchCardDisplayState =
  (typeof MatchCardDisplayState)[keyof typeof MatchCardDisplayState];

/** Card chrome per display bucket — badge copy comes from {@link MATCH_STATE_BADGE_META}. */
export const MATCH_CARD_DISPLAY_META: Record<
  MatchCardDisplayState,
  { badgeLabel: string; contextStatusLine: string }
> = {
  [MatchCardDisplayState.Live]: { badgeLabel: 'LIVE', contextStatusLine: 'LIVE' },
  [MatchCardDisplayState.Scheduled]: {
    badgeLabel: 'Scheduled',
    contextStatusLine: 'SCHEDULED',
  },
  [MatchCardDisplayState.Completed]: {
    badgeLabel: 'Completed',
    contextStatusLine: 'COMPLETED',
  },
  [MatchCardDisplayState.Cancelled]: {
    badgeLabel: 'Cancelled',
    contextStatusLine: 'CANCELLED',
  },
};

/** Visual bucket for match-status badges on list cards. */
export const MatchStateBadgeStyle = {
  Live: 'live',
  Muted: 'muted',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Paused: 'paused',
  Delayed: 'delayed',
  PreLive: 'preLive',
} as const;
export type MatchStateBadgeStyle =
  (typeof MatchStateBadgeStyle)[keyof typeof MatchStateBadgeStyle];

export interface MatchStateBadgeMeta {
  label: string;
  style: MatchStateBadgeStyle;
}

/** Single source of truth: machine state → badge label + style on match list cards. */
export const MATCH_STATE_BADGE_META: Record<MatchStateType, MatchStateBadgeMeta> = {
  [MatchState.Live]: { label: 'LIVE', style: MatchStateBadgeStyle.Live },
  [MatchState.Scheduled]: { label: 'Scheduled', style: MatchStateBadgeStyle.Muted },
  [MatchState.PlayingXiLocked]: {
    label: 'Playing 11 Locked',
    style: MatchStateBadgeStyle.PreLive,
  },
  [MatchState.TossCompleted]: { label: 'Toss Completed', style: MatchStateBadgeStyle.PreLive },
  [MatchState.Delayed]: { label: 'Delayed', style: MatchStateBadgeStyle.Delayed },
  [MatchState.RainInterrupted]: {
    label: 'Rain Interrupted',
    style: MatchStateBadgeStyle.Paused,
  },
  [MatchState.Cancelled]: { label: 'Cancelled', style: MatchStateBadgeStyle.Cancelled },
  [MatchState.NoResult]: { label: 'No Result', style: MatchStateBadgeStyle.Muted },
  [MatchState.Completed]: { label: 'Completed', style: MatchStateBadgeStyle.Completed },
  /** Legacy rows — display the same Completed badge (scoring ended). */
  [MatchState.ScorecardLocked]: { label: 'Completed', style: MatchStateBadgeStyle.Completed },
};

/** Badge display treats legacy locked rows as Completed (scoring ended). */
export function normalizeMatchStateForBadge(state: string): MatchStateType {
  if (state === MatchState.ScorecardLocked) {
    return MatchState.Completed;
  }
  return state as MatchStateType;
}

const FALLBACK_BADGE_META: MatchStateBadgeMeta = {
  label: 'Unknown',
  style: MatchStateBadgeStyle.Muted,
};

/** Resolve badge metadata for a match state, with a safe fallback for legacy/unexpected values. */
export function resolveMatchStateBadge(state: string): MatchStateBadgeMeta {
  const normalized = normalizeMatchStateForBadge(state);
  const known = MATCH_STATE_BADGE_META[normalized];
  if (known) {
    return known;
  }
  const humanized = state
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
  return { label: humanized || FALLBACK_BADGE_META.label, style: MatchStateBadgeStyle.Muted };
}

export interface MatchListTeamView {
  id: string | null;
  name: string;
  logoUrl: string | null;
}

/** Populated from the scoring engine / live feed when a match is in progress. */
export interface MatchLiveScoreSummary {
  inningsNumber: number;
  runs: number;
  wickets: number;
  /** Decimal overs text, e.g. `"15.2"`. */
  oversText: string;
}

/** One row on GET /tournaments/:id/matches. */
export interface MatchListItem {
  id: string;
  tournamentId: string;
  matchCode: string | null;
  state: MatchStateType;
  displayState: MatchCardDisplayState;
  matchDate: string | null;
  startTime: string | null;
  /** Cumulative pre-live delay in minutes. */
  delayMinutes: number;
  teamA: MatchListTeamView;
  teamB: MatchListTeamView;
  groundLocation: string | null;
  /** ACC ground-setup responsibility (§27); null on older fixtures. */
  homeAway: HomeAway | null;
  /** Human result line, e.g. "Mumbai Mavericks won by 15 runs". Null until scoring finishes. */
  resultSummary: string | null;
  liveScore: MatchLiveScoreSummary | null;
  completedAt: string | null;
  /** True when the fixture was soft-deleted (admin-only on tournament Matches tab). */
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByName?: string | null;
  /** Server-resolved: Admin / Club Manager on upcoming fixtures only. */
  canEdit?: boolean;
  canDelete?: boolean;
  /** Group-stage fixture group; null for knockout bracket matches and non-group formats. */
  groupId: string | null;
  /** Group display name when `groupId` is set. */
  groupName: string | null;
}

/** True when the match card is in the pre-live Scheduled bucket (upcoming). */
export function isUpcomingMatchForScheduleManagement(state: MatchStateType): boolean {
  return deriveMatchCardDisplayState(state) === MatchCardDisplayState.Scheduled;
}

const COMPLETED_STATES: MatchStateType[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

const LIVE_STATES: MatchStateType[] = LIVE_MATCH_STATES;

/** Chronological sort key: `startTime` when set, otherwise noon UTC on `matchDate`. */
export function parseMatchSortInstant(
  match: Pick<MatchListItem, 'startTime' | 'matchDate'>,
): number {
  if (match.startTime) {
    return Date.parse(match.startTime);
  }
  if (match.matchDate) {
    return Date.parse(`${match.matchDate}T12:00:00.000Z`);
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Raw machine state → card bucket (COMPLETED, LIVE, CANCELLED, or SCHEDULED). */
export function deriveMatchCardDisplayState(state: MatchStateType): MatchCardDisplayState {
  if (LIVE_STATES.includes(state)) {
    return MatchCardDisplayState.Live;
  }
  if (state === MatchState.Cancelled) {
    return MatchCardDisplayState.Cancelled;
  }
  if (COMPLETED_STATES.includes(state)) {
    return MatchCardDisplayState.Completed;
  }
  return MatchCardDisplayState.Scheduled;
}

/** Oldest → newest by match datetime; `id` breaks ties for stable ordering. */
export function sortMatchesForDisplay(matches: readonly MatchListItem[]): MatchListItem[] {
  return [...matches].sort((a, b) => {
    const instantDiff = parseMatchSortInstant(a) - parseMatchSortInstant(b);
    if (instantDiff !== 0) {
      return instantDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Assign display buckets and sort chronologically (date, then time). */
export function prepareMatchListForDisplay(
  matches: readonly Omit<MatchListItem, 'displayState'>[],
): MatchListItem[] {
  const enriched: MatchListItem[] = matches.map((match) => ({
    ...match,
    displayState: deriveMatchCardDisplayState(match.state),
  }));
  return sortMatchesForDisplay(enriched);
}

/** True when either side of the fixture is the given team. */
export function matchInvolvesTeam(
  match: Pick<MatchListItem, 'teamA' | 'teamB'>,
  teamId: string,
): boolean {
  return match.teamA.id === teamId || match.teamB.id === teamId;
}

/** Filter to one team's fixtures; null/undefined teamId returns all matches. */
export function filterMatchListByTeam(
  matches: readonly MatchListItem[],
  teamId: string | null | undefined,
): MatchListItem[] {
  if (!teamId) {
    return [...matches];
  }
  return matches.filter((match) => matchInvolvesTeam(match, teamId));
}

/** Sentinel values for the tournament Matches tab group filter dropdown. */
export const MATCH_LIST_GROUP_FILTER = {
  All: 'all',
  Knockout: 'knockout',
} as const;

export type MatchListGroupFilterValue =
  | typeof MATCH_LIST_GROUP_FILTER.All
  | typeof MATCH_LIST_GROUP_FILTER.Knockout
  | string;

/**
 * Filter by group on the tournament Matches tab.
 * `all` / null / undefined → no filter; `knockout` → fixtures with no group (bracket).
 */
export function filterMatchListByGroup(
  matches: readonly MatchListItem[],
  groupFilter: MatchListGroupFilterValue | null | undefined,
): MatchListItem[] {
  if (!groupFilter || groupFilter === MATCH_LIST_GROUP_FILTER.All) {
    return [...matches];
  }
  if (groupFilter === MATCH_LIST_GROUP_FILTER.Knockout) {
    return matches.filter((match) => match.groupId == null);
  }
  return matches.filter((match) => match.groupId === groupFilter);
}

/** Apply team then group filters (additive, client-side). */
export function filterMatchList(
  matches: readonly MatchListItem[],
  filters: {
    teamId?: string | null;
    groupFilter?: MatchListGroupFilterValue | null;
  },
): MatchListItem[] {
  return filterMatchListByGroup(filterMatchListByTeam(matches, filters.teamId), filters.groupFilter);
}

/**
 * Cancelled match card — show the secondary Details CTA beside Scorecard.
 * Admin / Club Manager, or a CONFIRMED registrant in this tournament
 * (`Registration.tournamentId` + `Registration.userId`, same model as registered-players list).
 */
export function canViewCancelledMatchDetails(input: {
  role: UserRole | undefined;
  registrationStatus: RegistrationStatusType | null | undefined;
}): boolean {
  if (input.role !== undefined && canViewAdminUsersDirectory(input.role)) {
    return true;
  }
  return input.registrationStatus === RegistrationStatus.Confirmed;
}
