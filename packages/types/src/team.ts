import { TOURNAMENT_POSTER_MAX_BYTES } from './tournament-media';
import { TOURNAMENT_FORM_MESSAGES } from './tournament-validation';
import type { BallType } from './rbac';

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
  /** Leather ACC only; null for tennis or unset membership category. */
  playerCategory: PlayerCategory | null;
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
  /** True when the viewer (Club Manager) may assign Captain / Vice-Captain. */
  canAssignTeamRoles: boolean;
  players: TeamDetailPlayerRow[];
}

export type { TournamentPlayerProfileView } from './player-profile';

export interface CreateTeamRequest {
  name: string;
  logoUrl?: string | null;
}

export interface UploadTeamLogoResponse {
  logoUrl: string;
}

/** Assign one Captain and/or one Vice-Captain per team (organizer flow). */
export interface AssignTeamRolesRequest {
  captainUserId?: string | null;
  viceCaptainUserId?: string | null;
}

export interface AssignTeamRolesResponse {
  captainUserId: string | null;
  viceCaptainUserId: string | null;
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
