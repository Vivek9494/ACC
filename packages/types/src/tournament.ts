/**
 * Tournament contracts shared between the api and mobile (spec §5.1, §6, §24).
 * Single source of truth for the lifecycle/format enums and the create/update/
 * read shapes.
 */

import type { GroupSummary } from './group';
import type { MatchSchedulingFormat } from './match-scheduling-format';
import type { BallType, CitySelection, TournamentType } from './rbac';
import type { TournamentDisplayStatus } from './tournament-display-status';

/** Tournament lifecycle states (spec §5.1). */
export const TournamentState = {
  New: 'NEW',
  RegistrationOpen: 'REGISTRATION_OPEN',
  RegistrationClosed: 'REGISTRATION_CLOSED',
  TeamsFinalized: 'TEAMS_FINALIZED',
  FixturePublished: 'FIXTURE_PUBLISHED',
  Live: 'LIVE',
  Knockout: 'KNOCKOUT',
  Completed: 'COMPLETED',
} as const;
export type TournamentState = (typeof TournamentState)[keyof typeof TournamentState];

/** Human labels for the state badge. */
export const TOURNAMENT_STATE_LABELS: Record<TournamentState, string> = {
  NEW: 'New',
  REGISTRATION_OPEN: 'Registration Open',
  REGISTRATION_CLOSED: 'Registration Closed',
  TEAMS_FINALIZED: 'Teams Finalized',
  FIXTURE_PUBLISHED: 'Fixture Published',
  LIVE: 'Live',
  KNOCKOUT: 'Knockout',
  COMPLETED: 'Completed',
};

/**
 * Allowed forward state transitions (spec §5.1). The graph is linear with one
 * branch: Live can go to Knockout (group+knockout formats) or straight to
 * Completed. Reopening a closed registration is permitted.
 */
export const TOURNAMENT_STATE_TRANSITIONS: Record<TournamentState, TournamentState[]> = {
  NEW: ['REGISTRATION_OPEN'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED'],
  REGISTRATION_CLOSED: ['REGISTRATION_OPEN', 'TEAMS_FINALIZED'],
  TEAMS_FINALIZED: ['FIXTURE_PUBLISHED'],
  FIXTURE_PUBLISHED: ['LIVE'],
  LIVE: ['KNOCKOUT', 'COMPLETED'],
  KNOCKOUT: ['COMPLETED'],
  COMPLETED: [],
};

/** Supported tournament formats (spec §24). */
export const TournamentFormat = {
  LeagueSingleRoundRobin: 'LEAGUE_SINGLE_ROUND_ROBIN',
  LeagueDoubleRoundRobin: 'LEAGUE_DOUBLE_ROUND_ROBIN',
  KnockoutSingleElimination: 'KNOCKOUT_SINGLE_ELIMINATION',
  KnockoutSeeded: 'KNOCKOUT_SEEDED',
  KnockoutDoubleElimination: 'KNOCKOUT_DOUBLE_ELIMINATION',
  GroupStageKnockout: 'GROUP_STAGE_KNOCKOUT',
  Swiss: 'SWISS',
  LadderChallenge: 'LADDER_CHALLENGE',
  Pool: 'POOL',
} as const;
export type TournamentFormat = (typeof TournamentFormat)[keyof typeof TournamentFormat];

/** Human labels for the §24 formats (format picker). */
export const TOURNAMENT_FORMAT_LABELS: Record<TournamentFormat, string> = {
  LEAGUE_SINGLE_ROUND_ROBIN: 'League — Single Round Robin',
  LEAGUE_DOUBLE_ROUND_ROBIN: 'League — Double Round Robin',
  KNOCKOUT_SINGLE_ELIMINATION: 'Knockout — Single Elimination',
  KNOCKOUT_SEEDED: 'Knockout — Seeded',
  KNOCKOUT_DOUBLE_ELIMINATION: 'Knockout — Double Elimination',
  GROUP_STAGE_KNOCKOUT: 'Group Stage + Knockout',
  SWISS: 'Swiss System',
  LADDER_CHALLENGE: 'Ladder / Challenge',
  POOL: 'Pool Format',
};

/**
 * The Manager role exists only in APL and Center-level tournaments (§2, D1).
 * Mobile uses this to hide Manager-related UI when the type is ACC.
 */
export function managerRoleAllowed(type: TournamentType): boolean {
  return type !== 'ACC';
}

/**
 * Add Tournament form payload (spec §6.1). `type` is NOT provided by the client;
 * the api derives it from `ballType` + `citySelection`. Powerplay Overs is
 * intentionally absent (removed per §6.1).
 */
export interface CreateTournamentRequest {
  name: string;
  year: number;
  posterUrl: string;
  maxOversPerBowler: number;
  locationAddress?: string | null;
  /** Set when the user picks a place or adjusts the map marker. */
  latitude?: number | null;
  longitude?: number | null;
  /** IANA timezone override; normally derived from coordinates on the server. */
  timezone?: string | null;
  /** YYYY-MM-DD calendar days matches may be scheduled on. Server derives startAt/endAt. */
  dates: string[];
  ballType: BallType;
  /** City coverage; required for tennis-ball tournaments; ignored for leather/ACC. */
  citySelection?: CitySelection;
  /** Expected teams for fixture/setup (§6.1). */
  numberOfTeams: number;
  /** Squad size per team; omit or leave unset for no roster cap. Max 30 when provided. */
  playersPerTeam?: number | null;
  /** Substitutes allowed per match (§9.7). */
  substitutesAllowed: number;
  /** Province the tournament belongs to (required on create). */
  provinceId: string;
  /** Participating Center ids for MULTI/SINGLE; ignored when citySelection=APL. */
  centerIds?: string[];
  format: TournamentFormat;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  /** Required when videoRequired; upload window start (ISO 8601). */
  videoUploadStartAt?: string | null;
  /** Required when videoRequired; must be after start and registration close (§19). */
  videoUploadEndDate?: string | null;
  youtubeUrl?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  /** Optional player auction date (§6.1 extension). */
  auctionAt?: string | null;
  /** Tennis: single fee; Leather: full-time player fee (CAD dollars). */
  feeFullTime?: number | null;
  /** Leather part-time player fee (CAD dollars); omitted/null for tennis. */
  feePartTime?: number | null;
  /** Optional: clone team names (never players, §6.2) from this past tournament. */
  cloneFromTournamentId?: string | null;
  /** When cloning, also copy Captain/VC/Manager assignments (§6.2). */
  copyRoleAssignments?: boolean;
  /** APL only — set in Edit once groups exist; omitted on create. */
  knockoutTeamCount?: number | null;
}

/** Mid-tournament edits (§6.4). All fields optional; only sent ones change. */
export interface UpdateTournamentRequest {
  name?: string;
  posterUrl?: string | null;
  oversPerInnings?: number;
  maxOversPerBowler?: number;
  numberOfTeams?: number;
  playersPerTeam?: number | null;
  substitutesAllowed?: number;
  locationAddress?: string | null;
  /** Set when the user picks a place or adjusts the map marker. */
  latitude?: number | null;
  longitude?: number | null;
  /** IANA timezone override; normally derived from coordinates on the server. */
  timezone?: string | null;
  /** Calendar days matches may be scheduled on; server derives startAt/endAt. */
  dates?: string[];
  format?: TournamentFormat;
  impactPlayerEnabled?: boolean;
  videoRequired?: boolean;
  videoUploadStartAt?: string | null;
  videoUploadEndDate?: string | null;
  youtubeUrl?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  auctionAt?: string | null;
  /** Tennis: single fee; Leather: full-time player fee (CAD dollars). */
  feeFullTime?: number | null;
  /** Leather part-time player fee (CAD dollars); omitted/null for tennis. */
  feePartTime?: number | null;
  /** Province the tournament belongs to. */
  provinceId?: string;
  /** APL only — even knockout size; locked once a bracket exists. */
  knockoutTeamCount?: number | null;
}

/** Locked scope summary for the edit form (type/ball/centers cannot change). */
export interface TournamentScopeDisplay {
  citySelection: CitySelection | null;
  provinceName: string | null;
  centerNames: string[];
}

/** Payload for GET /tournaments/:id/edit-form (authenticated, EDIT_TOURNAMENT). */
export interface TournamentEditFormData extends TournamentDetail {
  scopeDisplay: TournamentScopeDisplay;
  /** Dates that already have scheduled matches — cannot be removed. */
  datesWithMatches: string[];
}

export interface TransitionStateRequest {
  state: TournamentState;
}

/** List-row projection (spec dashboard Tournaments list). */
export interface TournamentSummary {
  id: string;
  name: string;
  year: number;
  type: TournamentType;
  /** Stored lifecycle state (registration, fixtures, etc.). */
  state: TournamentState;
  /** Date-derived status for badges/lists (Upcoming / Live / Completed). */
  displayStatus: TournamentDisplayStatus;
  ballType: BallType;
  posterUrl: string | null;
  /** Derived min/max of scheduled dates; ISO 8601 UTC midnight. */
  startAt: string;
  endAt: string;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Province the tournament belongs to; null on legacy rows until edited. */
  provinceId: string | null;
  /** Tournament For scope (province / centers) derived at read time. */
  scopeDisplay: TournamentScopeDisplay;
  /** IANA timezone for venue-local display and schedule rules; resolved once from location. */
  timezone: string | null;
  teamCount: number;
}

/** Full tournament detail (spec tournament_details mockups). */
export interface TournamentDetail extends TournamentSummary {
  /** Selected tournament calendar days (YYYY-MM-DD), source of truth for scheduling. */
  dates: string[];
  /** Null until set at match setup; scoring reads per-match overs when available. */
  oversPerInnings: number | null;
  maxOversPerBowler: number;
  numberOfTeams: number;
  /** Null when no roster cap is configured (Players per Team unset). */
  playersPerTeam: number | null;
  substitutesAllowed: number;
  format: TournamentFormat;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  videoUploadStartAt: string | null;
  videoUploadEndDate: string | null;
  youtubeUrl: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  auctionAt: string | null;
  /** Tennis: single fee; Leather: full-time player fee (CAD dollars). */
  feeFullTime: number | null;
  /** Leather part-time player fee (CAD dollars); null for tennis. */
  feePartTime: number | null;
  /** True when both registrationOpenAt and registrationCloseAt are set. */
  hasRegistrationWindow: boolean;
  /** Whether the current instant is within the registration window. */
  registrationIsOpen: boolean;
  /** Set when the organizer picks a scheduling mode (Schedule Matches modal). */
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount: number;
  /** APL only — configured knockout size; null until set. */
  knockoutTeamCount: number | null;
  /** True when a live KnockoutBracket row exists — locks knockoutTeamCount. */
  hasKnockoutBracket: boolean;
  groups: GroupSummary[];
  teams: {
    id: string;
    name: string;
    logoUrl: string | null;
    memberCount: number;
    groupId: string | null;
    groupName: string | null;
    hasMatches: boolean;
  }[];
  /** Logged-in viewer's rostered team in this tournament (membership, not role); null when unauthenticated or not rostered. */
  myTeamId: string | null;
  /**
   * Tennis only: registration window closed and every registrant approved or declined.
   * Drives Captain/Manager registration player buttons after Center Sevak verification.
   */
  registrationVerificationComplete: boolean;
  /** Tennis + team lead + verification complete — Registered Players List button. */
  canViewRegisteredPlayersList: boolean;
  /** Tennis + team lead + verification complete — Favourite Players button. */
  canViewFavouritePlayers: boolean;
  /** Leather: viewer may self-register (existing leather player or invited). */
  canRegisterForLeatherTournament: boolean;
  /**
   * Tennis APL/CENTER: viewer’s center participates (or Admin/CM). When false,
   * tournament is view-only — hide Registration CTA; server rejects submit.
   */
  canRegisterForTennisTournament: boolean;
  /** Leather: Admin / Club Manager may invite until start date. */
  canManageLeatherInvites: boolean;
  /** Authenticated viewer may open Edit Tournament (EDIT_TOURNAMENT). */
  canEdit: boolean;
  /** Viewer may schedule matches (organizer, or Captain/VC on Leather — server-resolved). */
  canScheduleMatches: boolean;
  /** Team ids the viewer leads (Captain/VC) in this tournament; empty when none. */
  viewerLeaderTeamIds: string[];
  /**
   * Tennis only: verified (confirmed) registrant may upload their own skill video
   * after Center Sevak verification completes and within the upload window
   * (videoUploadStartAt–videoUploadEndDate, when set).
   */
  canUploadSkillVideo: boolean;
  /** True when the viewer has already uploaded a skill video for this tournament. */
  hasSkillVideo: boolean;
  /** @deprecated Use {@link canUploadSkillVideo}. */
  canUploadPlayerVideo: boolean;
  /** @deprecated Use {@link hasSkillVideo}. */
  hasPlayerVideo: boolean;
  /** Tennis Phase 1: viewer may assign/manage the shared 5 tournament scorers. */
  canManageTournamentScorers: boolean;
  /** Count of assigned tournament scorers (0–5); tennis only. */
  tournamentScorerCount: number;
}

/** Clone suggestion returned when a name matches a past tournament (§6.2). */
export interface CloneSuggestion {
  tournamentId: string;
  name: string;
  year: number;
  teamNames: string[];
  hasRoleAssignments: boolean;
}
