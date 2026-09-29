import {
  type AssignTeamRolesRequest,
  BallType,
  type TeamDetailPlayerRow,
  type TeamDetailView,
} from '@acc/types';

export type TeamRoleKey = 'captain' | 'viceCaptain' | 'manager';

/** One holder per role; each holder a different player (mirrors validateTeamRoleAssignments). */
export type TeamRoleSelection = Record<TeamRoleKey, string | null>;

export const EMPTY_ROLE_SELECTION: TeamRoleSelection = {
  captain: null,
  viceCaptain: null,
  manager: null,
};

const ROLE_LABELS: Record<TeamRoleKey, string> = {
  captain: 'Captain',
  viceCaptain: 'Vice-Captain',
  manager: 'Manager',
};

/** Manager is Tennis-only (no Manager in ACC / leather — RBAC D1). */
export function teamRoleColumns(
  ballType: BallType,
): readonly { key: TeamRoleKey; label: string }[] {
  const keys: TeamRoleKey[] =
    ballType === BallType.Tennis
      ? ['captain', 'viceCaptain', 'manager']
      : ['captain', 'viceCaptain'];
  return keys.map((key) => ({ key, label: ROLE_LABELS[key] }));
}

export function rolesHeldBy(selection: TeamRoleSelection, userId: string): TeamRoleKey[] {
  return (Object.keys(selection) as TeamRoleKey[]).filter((key) => selection[key] === userId);
}

/** Disabled when another player holds the role, or this player already holds a different role. */
export function isRoleCheckboxDisabled(
  selection: TeamRoleSelection,
  userId: string,
  role: TeamRoleKey,
): boolean {
  const holder = selection[role];
  if (holder !== null && holder !== userId) return true;
  return rolesHeldBy(selection, userId).some((held) => held !== role);
}

export function toggleRole(
  selection: TeamRoleSelection,
  userId: string,
  role: TeamRoleKey,
  checked: boolean,
): TeamRoleSelection {
  if (!checked) return selection[role] === userId ? { ...selection, [role]: null } : selection;
  if (isRoleCheckboxDisabled(selection, userId, role)) return selection;
  return { ...selection, [role]: userId };
}

export function roleSelectionFromRoster(
  players: readonly TeamDetailPlayerRow[],
): TeamRoleSelection {
  return {
    captain: players.find((p) => p.isCaptain)?.userId ?? null,
    viceCaptain: players.find((p) => p.isViceCaptain)?.userId ?? null,
    manager: players.find((p) => p.isManager)?.userId ?? null,
  };
}

export function hasAnyLeadership(roster: Pick<TeamDetailView, 'players'>): boolean {
  return roster.players.some((p) => p.isCaptain || p.isViceCaptain || p.isManager);
}

/** PATCH body for the given roles only; Manager is never sent for leather (server rejects it). */
export function toAssignRolesRequest(
  selection: TeamRoleSelection,
  ballType: BallType,
  roles: readonly TeamRoleKey[] = ['captain', 'viceCaptain', 'manager'],
): AssignTeamRolesRequest {
  const body: AssignTeamRolesRequest = {};
  if (roles.includes('captain')) body.captainUserId = selection.captain;
  if (roles.includes('viceCaptain')) body.viceCaptainUserId = selection.viceCaptain;
  if (roles.includes('manager') && ballType === BallType.Tennis)
    body.managerUserId = selection.manager;
  return body;
}
