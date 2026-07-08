import { TOURNAMENT_POSTER_MAX_BYTES } from './tournament-media';
import { TOURNAMENT_FORM_MESSAGES } from './tournament-validation';
import type { BallType } from './rbac';
import type { RegistrationPlayerType } from './registration';

/** Display name length cap for Add Team (§6.3). */
export const TEAM_NAME_MAX_LENGTH = 40;

/** Team logo upload limits — JPEG only, max 5MB (same as tournament poster). */
export const TEAM_LOGO_MAX_BYTES = TOURNAMENT_POSTER_MAX_BYTES;

export interface TeamSummary {
  id: string;
  tournamentId: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  groupId: string | null;
  groupName: string | null;
  /** True when the team appears in any active tournament match — blocks deletion. */
  hasMatches: boolean;
}

/** ACC leather-ball roster category (TeamMembership.playerCategory). */
export const PlayerCategory = {
  Fulltime: 'FULLTIME',
  Parttime: 'PARTTIME',
} as const;
export type PlayerCategory = (typeof PlayerCategory)[keyof typeof PlayerCategory];

export interface TeamDetailPlayerRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isManager: boolean;
  /** Leather ACC only; null for tennis or unset membership category. */
  playerCategory: PlayerCategory | null;
  /** Full E.164 number when the viewer may manage roster contacts; null otherwise. */
  mobileNumber: string | null;
  battingRating: number | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
}

/** Team roster detail for the mobile Team Detail screen. */
export interface TeamDetailView {
  id: string;
  tournamentId: string;
  name: string;
  logoUrl: string | null;
  ballType: BallType;
  /** False for tennis-ball tournaments (no FT/PT split in UI). */
  showPlayerCategorySplit: boolean;
  activePlayerCount: number;
  fulltimePlayerCount: number;
  parttimePlayerCount: number;
  /** True when the viewer may open another player's profile from this roster. */
  canViewPlayerProfiles: boolean;
  /** Admin / Club Manager may assign Captain / Vice-Captain / Manager. */
  canAssignTeamRoles: boolean;
  /** Admin / Club Manager may add registered players to the roster. */
  canAddPlayers: boolean;
  /** Null when the tournament has no roster cap (Players per Team unset). */
  playersPerTeamCap: number | null;
  /** Null when unlimited; otherwise slots left before hitting the cap. */
  rosterSlotsRemaining: number | null;
  players: TeamDetailPlayerRow[];
}

export type { TournamentPlayerProfileView } from './player-profile';

export interface CreateTeamRequest {
  name: string;
  logoUrl?: string | null;
  /** Optional at create — Admin / Club Manager only; assignee is auto-added to the new team squad. */
  captainUserId?: string | null;
  viceCaptainUserId?: string | null;
  managerUserId?: string | null;
}

export interface UpdateTeamRequest {
  name?: string;
  logoUrl?: string | null;
}

export interface UploadTeamLogoResponse {
  storageKey: string;
  /** Presigned read URL for immediate display. Persist storageKey as logoUrl. */
  logoUrl: string;
}

/** Assign Captain, Vice-Captain, and/or Manager per team (organizer flow). */
export interface AssignTeamRolesRequest {
  captainUserId?: string | null;
  viceCaptainUserId?: string | null;
  managerUserId?: string | null;
}

export interface AssignTeamRolesResponse {
  captainUserId: string | null;
  viceCaptainUserId: string | null;
  managerUserId: string | null;
}

/** Registered player eligible for Captain / VC / Manager on a new team (not rostered elsewhere). */
export interface TeamRoleCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  centerName: string;
}

export interface TeamRoleCandidatesView {
  candidates: TeamRoleCandidate[];
  /** Confirmed registrants with selectable (active, non-deleted) accounts. */
  confirmedRegistrantCount: number;
  /** Distinct players on an active team in this tournament (excluded from candidates). */
  rosteredCount: number;
}

/** Unassigned confirmed registrant eligible to join a team roster. */
export interface UnassignedTeamPlayerCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  centerName: string;
  profilePhotoUrl: string | null;
  playerType: RegistrationPlayerType | null;
  battingRating: number | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
}

/** Add-players picker payload — unassigned pool split by leather player type when applicable. */
export interface TeamAddPlayersPickerView {
  ballType: BallType;
  showPlayerTypeTabs: boolean;
  playersPerTeamCap: number | null;
  currentRosterSize: number;
  rosterSlotsRemaining: number | null;
  fulltimeCandidates: UnassignedTeamPlayerCandidate[];
  parttimeCandidates: UnassignedTeamPlayerCandidate[];
  /** Tennis — all unassigned registrants (same rows as fulltime+parttime would be for leather). */
  candidates: UnassignedTeamPlayerCandidate[];
}

export interface AddTeamPlayersRequest {
  userIds: string[];
}

export interface AddTeamPlayersResponse {
  addedCount: number;
}

/** Remaining roster slots before the tournament cap; null when unlimited. */
export function teamRosterSlotsRemaining(
  cap: number | null | undefined,
  currentSize: number,
): number | null {
  if (cap == null) {
    return null;
  }
  return Math.max(0, cap - currentSize);
}

export function teamRosterCapExceededMessage(
  cap: number,
  currentSize: number,
  requestedCount: number,
): string {
  const remaining = teamRosterSlotsRemaining(cap, currentSize) ?? 0;
  if (requestedCount > remaining) {
    return `This team can have at most ${cap} players (${remaining} slot${remaining === 1 ? '' : 's'} remaining).`;
  }
  return `This team can have at most ${cap} players.`;
}

export const TEAM_ROSTER_MESSAGES = {
  selectAtLeastOne: 'Select at least one player to add.',
  noRemainingSlots: 'This team has reached its roster size limit.',
  addConfirmTitle: 'Add players',
  addConfirmMessage: (count: number, teamName: string) =>
    `Add ${count} player${count === 1 ? '' : 's'} to ${teamName}?`,
} as const;

/** Ensures one player cannot hold more than one of Captain / VC / Manager on the same team. */
export function validateTeamRoleAssignments(
  captainUserId: string | null | undefined,
  viceCaptainUserId: string | null | undefined,
  managerUserId: string | null | undefined,
): string | null {
  const assigned = [captainUserId, viceCaptainUserId, managerUserId].filter(
    (id): id is string => id != null && id.length > 0,
  );
  if (new Set(assigned).size !== assigned.length) {
    return 'One player cannot hold more than one leadership role on the same team';
  }
  return null;
}

export const TEAM_FORM_MESSAGES = {
  name: {
    required: 'Team name is required',
    maxLength: `Team name must be at most ${TEAM_NAME_MAX_LENGTH} characters`,
    duplicate: 'A team with this name already exists in this tournament.',
  },
  logo: {
    type: TOURNAMENT_FORM_MESSAGES.poster.type,
    size: TOURNAMENT_FORM_MESSAGES.poster.size,
  },
  delete: {
    hasMatches:
      'This team cannot be deleted because it has scheduled or completed matches in this tournament.',
    confirmTitle: 'Delete Team?',
    confirmMessage: (teamName: string) =>
      `Delete ${teamName}? This can't be undone.`,
  },
} as const;

export function teamCapError(numberOfTeams: number): string {
  return `This tournament allows up to ${numberOfTeams} teams`;
}

/** Trim + lowercase — used for per-tournament uniqueness (case-insensitive). */
export function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

export function scheduleMatchesGuardMessage(
  teamCount: number,
  canCreateTeam: boolean,
): string {
  if (!canCreateTeam) {
    return 'Teams have not been set up for this tournament yet. Please check back later.';
  }
  if (teamCount === 0) {
    return 'There are no teams added in this tournament. Please create teams to schedule matches.';
  }
  if (teamCount === 1) {
    return 'Only one team has been added. Add at least one more team to schedule matches.';
  }
  return '';
}

export function validateTeamName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return TEAM_FORM_MESSAGES.name.required;
  }
  if (trimmed.length > TEAM_NAME_MAX_LENGTH) {
    return TEAM_FORM_MESSAGES.name.maxLength;
  }
  return null;
}
