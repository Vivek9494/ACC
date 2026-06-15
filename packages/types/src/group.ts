import { TOURNAMENT_FORM_MESSAGES } from './tournament-validation';

/** Display name length cap for Create Group. */
export const GROUP_NAME_MAX_LENGTH = 40;

export interface GroupTeamSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
}

export interface GroupSummary {
  id: string;
  tournamentId: string;
  name: string;
  teams: GroupTeamSummary[];
}

export interface CreateGroupRequest {
  name: string;
  teamIds?: string[];
}

export const GROUP_FORM_MESSAGES = {
  name: {
    required: 'Group name is required',
    maxLength: `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`,
    duplicate: 'A group with this name already exists in this tournament.',
  },
} as const;

/** Trim + lowercase — per-tournament group name uniqueness (case-insensitive). */
export function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase();
}

export function validateGroupName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return GROUP_FORM_MESSAGES.name.required;
  }
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    return GROUP_FORM_MESSAGES.name.maxLength;
  }
  return null;
}
