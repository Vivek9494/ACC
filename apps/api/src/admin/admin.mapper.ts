import {
  formatAdminUserRolesForDisplay,
  formatCanadianMobileMasked,
  type AdminUserDetail,
  type AdminUserRoleAssignment,
  type AdminUserSummary,
  type UserRole,
} from '@acc/types';
import type { Prisma, UserRole as PrismaUserRole } from '@prisma/client';

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
  center: {
    name: string;
    province: { name: string };
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

export function toAdminUserSummary(user: UserListRow): AdminUserSummary {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    maskedMobileNumber: formatCanadianMobileMasked(user.mobileNumber),
    profilePhotoUrl: user.profilePhotoUrl,
    isActive: user.isActive,
    roles: collectRoles(user),
    createdAt: user.createdAt.toISOString(),
  };
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
    email: user.email,
    centerName: user.center.name,
    provinceName: user.center.province.name,
    dateOfBirth: user.dateOfBirth.toISOString().slice(0, 10),
    jerseyNumber: user.jerseyNumber,
    jerseyName: user.jerseyName,
    roleAssignments: user.roleAssignments.map((row) => toRoleAssignment(row, centerNameById)),
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
