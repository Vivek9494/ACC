/**
 * Tournament contracts shared between the api and mobile (spec §5.1, §6, §24).
 * Single source of truth for the lifecycle/format enums and the create/update/
 * read shapes.
 */

import type { GroupSummary } from './group';
import type { MatchSchedulingFormat } from './match-scheduling-format';
import type { BallType, CitySelection, TournamentType } from './rbac';

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
  /** YYYY-MM-DD calendar days matches may be scheduled on. Server derives startAt/endAt. */
  dates: string[];
  ballType: BallType;
  /** City coverage; required for tennis-ball tournaments; ignored for leather/ACC. */
  citySelection?: CitySelection;
  /** Expected teams for fixture/setup (§6.1). */
  numberOfTeams: number;
  /** Squad size per team; defaults to 15 when omitted. Max 15 when provided. */
  playersPerTeam?: number;
  /** Substitutes allowed per match (§9.7). */
  substitutesAllowed: number;
  /** Province whose Centers participate (tennis tournaments only). */
  provinceId?: string;
  /** Participating Center ids for MULTI/SINGLE; ignored when citySelection=ALL. */
  centerIds?: string[];
  format: TournamentFormat;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  /** Required when videoRequired; must be after registration close (§19). */
  videoUploadEndDate?: string | null;
  youtubeUrl?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  /** Optional player auction date (§6.1 extension). */
  auctionAt?: string | null;
  /** Optional: clone team names (never players, §6.2) from this past tournament. */
  cloneFromTournamentId?: string | null;
  /** When cloning, also copy Captain/VC/Manager assignments (§6.2). */
  copyRoleAssignments?: boolean;
}

/** Mid-tournament edits (§6.4). All fields optional; only sent ones change. */
export interface UpdateTournamentRequest {
  name?: string;
  posterUrl?: string | null;
  oversPerInnings?: number;
  maxOversPerBowler?: number;
  numberOfTeams?: number;
  playersPerTeam?: number;
  substitutesAllowed?: number;
  locationAddress?: string | null;
  /** Set when the user picks a place or adjusts the map marker. */
  latitude?: number | null;
  longitude?: number | null;
  /** Calendar days matches may be scheduled on; server derives startAt/endAt. */
  dates?: string[];
  format?: TournamentFormat;
  impactPlayerEnabled?: boolean;
  videoRequired?: boolean;
  videoUploadEndDate?: string | null;
  youtubeUrl?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  auctionAt?: string | null;
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
  state: TournamentState;
  ballType: BallType;
  posterUrl: string | null;
  /** Derived min/max of scheduled dates; ISO 8601 UTC midnight. */
  startAt: string;
  endAt: string;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
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
  playersPerTeam: number;
  substitutesAllowed: number;
  format: TournamentFormat;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  videoUploadEndDate: string | null;
  youtubeUrl: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  auctionAt: string | null;
  /** True when both registrationOpenAt and registrationCloseAt are set. */
  hasRegistrationWindow: boolean;
  /** Whether the current instant is within the registration window. */
  registrationIsOpen: boolean;
  /** Set when the organizer picks a scheduling mode (Schedule Matches modal). */
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount: number;
  groups: GroupSummary[];
  teams: {
    id: string;
    name: string;
    logoUrl: string | null;
    memberCount: number;
    groupId: string | null;
    groupName: string | null;
  }[];
}

/** Clone suggestion returned when a name matches a past tournament (§6.2). */
export interface CloneSuggestion {
  tournamentId: string;
  name: string;
  year: number;
  teamNames: string[];
  hasRoleAssignments: boolean;
}
