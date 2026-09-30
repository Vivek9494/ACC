import type { MatchSchedulingFormat } from './match-scheduling-format';
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
  /** Count of non-deleted matches with this groupId. */
  liveMatchCount: number;
  /** True when one or more non-deleted matches are assigned to this group. */
  hasLiveMatches: boolean;
  /** A match involving one of this group's teams exists — rename, membership edits and delete are blocked. */
  isLocked: boolean;
}

export interface CreateGroupRequest {
  name: string;
  teamIds?: string[];
  /** Sent from the Schedule Matches flow — finalizes Group Stage + Knockout with the first group. */
  schedulingFormat?: typeof MatchSchedulingFormat.GroupStageKnockout;
}

export interface UpdateGroupMembersRequest {
  addTeamIds?: string[];
  removeTeamIds?: string[];
}

export interface UpdateGroupRequest extends UpdateGroupMembersRequest {
  name?: string;
}

export const GROUP_FORM_MESSAGES = {
  name: {
    required: 'Group name is required',
    maxLength: `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`,
    duplicate: 'A group with this name already exists in this tournament.',
  },
  delete: {
    hasMatches: 'This group has matches scheduled and can\'t be deleted',
    confirmTitle: 'Delete Group?',
    confirmMessage: (name: string) =>
      `Delete ${name}? Its teams will no longer be assigned to a group.`,
  },
  locked: 'Matches have been scheduled for this group\'s teams, so it can no longer be edited or deleted.',
  allTeamsAssigned: 'All the teams are already assigned to existing groups.',
  members: {
    emptyDiff: 'No team changes to save',
    teamAlreadyGrouped: 'One or more teams are already assigned to another group',
    teamNotInGroup: 'One or more teams are not in this group',
    teamNotInTournament: 'One or more teams do not belong to this tournament',
  },
} as const;

/** User-facing message when group delete is blocked by scheduled fixtures. */
export function formatGroupDeleteBlockedMessage(liveMatchCount: number): string {
  if (liveMatchCount <= 0) {
    return GROUP_FORM_MESSAGES.delete.hasMatches;
  }
  if (liveMatchCount === 1) {
    return 'This group has 1 scheduled match assigned to it. Delete it from the Matches tab first.';
  }
  return `This group has ${liveMatchCount} scheduled matches assigned to it. Delete them from the Matches tab first.`;
}

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
