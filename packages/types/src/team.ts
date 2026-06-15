import { TOURNAMENT_POSTER_MAX_BYTES } from './tournament-media';
import { TOURNAMENT_FORM_MESSAGES } from './tournament-validation';

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

export interface CreateTeamRequest {
  name: string;
  logoUrl?: string | null;
}

export interface UploadTeamLogoResponse {
  logoUrl: string;
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
