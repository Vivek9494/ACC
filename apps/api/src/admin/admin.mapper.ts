import {
  formatAdminUserRolesForDisplay,
  formatCanadianMobileMasked,
  type AdminUserDetail,
  type AdminUserRoleAssignment,
  type AdminUserSummary,
  type BallType,
  type UserRole,
} from '@acc/types';
import type { Prisma, UserRole as PrismaUserRole, JerseySize as PrismaJerseySize } from '@prisma/client';

import { adminDirectoryUserWhere } from '../users/user-query';

type UserListRow = {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  profilePhotoUrl: string | null;
  isActive: boolean;
  role: PrismaUserRole;
  createdAt: Date;
  roleAssignments: { role: PrismaUserRole }[];
};

type UserDetailRow = Omit<UserListRow, 'roleAssignments'> & {
  email: string;
  dateOfBirth: Date;
  jerseyNumber: number;
  jerseyName: string | null;
  jerseySize: PrismaJerseySize | null;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: Date | null;
  center: {
    id: string;
    name: string;
    provinceId: string;
    province: { id: string; name: string };
  };
  roleAssignments: {
    role: PrismaUserRole;
    tournament: { name: string } | null;
    team: { name: string } | null;
    centerId: string | null;
  }[];
};

function collectRoles(user: {
  role: PrismaUserRole;
  roleAssignments: { role: PrismaUserRole }[];
}): UserRole[] {
  const roles = new Set<UserRole>([user.role]);
  for (const assignment of user.roleAssignments) {
    roles.add(assignment.role);
  }
  return formatAdminUserRolesForDisplay([...roles]);
}

export function toAdminUserSummary(
  user: UserListRow,
  options?: { includeFullMobile?: boolean; playedBallTypes?: BallType[] },
): AdminUserSummary {
  const summary: AdminUserSummary = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    maskedMobileNumber: formatCanadianMobileMasked(user.mobileNumber),
    profilePhotoUrl: user.profilePhotoUrl,
    isActive: user.isActive,
    roles: collectRoles(user),
    createdAt: user.createdAt.toISOString(),
    playedBallTypes: options?.playedBallTypes ?? [],
  };

  if (options?.includeFullMobile) {
    summary.mobileNumber = user.mobileNumber;
  }

  return summary;
}

function toRoleAssignment(
  assignment: UserDetailRow['roleAssignments'][number],
  centerNameById: Map<string, string>,
): AdminUserRoleAssignment {
  return {
    role: assignment.role,
    tournamentName: assignment.tournament?.name ?? null,
    teamName: assignment.team?.name ?? null,
    centerName: assignment.centerId
      ? (centerNameById.get(assignment.centerId) ?? null)
      : null,
  };
}

export function toAdminUserDetail(
  user: UserDetailRow,
  centerNameById: Map<string, string>,
): AdminUserDetail {
  const summary = toAdminUserSummary(user);
  return {
    ...summary,
    mobileNumber: user.mobileNumber,
    email: user.email,
    centerId: user.center.id,
    centerName: user.center.name,
    provinceId: user.center.provinceId,
    provinceName: user.center.province.name,
    dateOfBirth: user.dateOfBirth.toISOString().slice(0, 10),
    jerseyNumber: user.jerseyNumber,
    jerseyName: user.jerseyName,
    jerseySize: user.jerseySize,
    platformRole: user.role,
    battingRating: null,
    bowlingRating: null,
    fieldingRating: null,
    playerRoleLabel: null,
    roleAssignments: user.roleAssignments.map((row) => toRoleAssignment(row, centerNameById)),
    mustChangePassword: user.mustChangePassword,
    tempPasswordExpiresAt: user.tempPasswordExpiresAt?.toISOString() ?? null,
  };
}

export function buildAdminUserSearchWhere(q: string | undefined): Prisma.UserWhereInput | undefined {
  const trimmed = q?.trim();
  if (!trimmed) {
    return undefined;
  }

  const or: Prisma.UserWhereInput[] = [
    { firstName: { contains: trimmed, mode: 'insensitive' } },
    { lastName: { contains: trimmed, mode: 'insensitive' } },
  ];

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 3) {
    if (digits.length >= 10) {
      or.push({ mobileNumber: { contains: `+1${digits.slice(-10)}` } });
    } else {
      or.push({ mobileNumber: { contains: digits } });
    }
  }

  return { OR: or };
}

export interface AdminUserListFilterParams {
  q?: string;
  provinceId?: string;
  centerId?: string;
}

/** Combines name/mobile search with optional province/center geography filters. */
export function buildAdminUserListWhere(
  params: AdminUserListFilterParams,
): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [adminDirectoryUserWhere];

  const searchWhere = buildAdminUserSearchWhere(params.q);
  if (searchWhere) {
    conditions.push(searchWhere);
  }

  if (params.centerId) {
    conditions.push({ centerId: params.centerId });
  } else if (params.provinceId) {
    conditions.push({
      center: { provinceId: params.provinceId },
    });
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }
  return { AND: conditions };
}
