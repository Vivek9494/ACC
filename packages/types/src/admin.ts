import { UserRole } from './auth';

/** Admin dashboard aggregate counts (GET /admin/overview). */
export interface AdminOverview {
  provinceCount: number;
  centerCount: number;
  activeTournamentCount: number;
  totalUserCount: number;
  tournamentCount: number;
  matchesTodayCount: number;
  pendingApprovalsCount: number;
}

/** Display labels for platform / scoped roles on admin user screens. */
export const ADMIN_USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Admin]: 'Admin',
  [UserRole.ClubManager]: 'Club Manager',
  [UserRole.CenterSevak]: 'Center Sevak',
  [UserRole.Captain]: 'Captain',
  [UserRole.ViceCaptain]: 'Vice Captain',
  [UserRole.Manager]: 'Manager',
  [UserRole.Player]: 'Player',
};

/** Default page size for GET /admin/users. */
export const ADMIN_USERS_PAGE_SIZE = 20;

/** Max page size for GET /admin/users. */
export const ADMIN_USERS_PAGE_SIZE_MAX = 50;

/** Row on the admin user directory (PII masked server-side). */
export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  maskedMobileNumber: string;
  profilePhotoUrl: string | null;
  isActive: boolean;
  /** Deduped platform + scoped roles for chip display. */
  roles: UserRole[];
  /** Account created (UTC ISO 8601). */
  createdAt: string;
}

/** Scoped role grant with human-readable context for the detail screen. */
export interface AdminUserRoleAssignment {
  role: UserRole;
  tournamentName: string | null;
  teamName: string | null;
  centerName: string | null;
}

/** Read-only admin user detail (GET /admin/users/:id). */
export interface AdminUserDetail extends AdminUserSummary {
  email: string;
  centerName: string;
  provinceName: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string;
  jerseyNumber: number;
  jerseyName: string | null;
  roleAssignments: AdminUserRoleAssignment[];
}

/** Cursor-paginated admin user list (GET /admin/users). */
export interface AdminUsersPage {
  items: AdminUserSummary[];
  nextCursor: string | null;
}

/** Query params for GET /admin/users. */
export interface ListAdminUsersParams {
  q?: string;
  cursor?: string;
  limit?: number;
}

const USER_ROLE_ORDER: UserRole[] = [
  UserRole.Admin,
  UserRole.ClubManager,
  UserRole.CenterSevak,
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
  UserRole.Player,
];

/** Sort roles for display; omit generic Player when other roles are present. */
export function formatAdminUserRolesForDisplay(roles: readonly UserRole[]): UserRole[] {
  const unique = [...new Set(roles)];
  const filtered =
    unique.length > 1 && unique.includes(UserRole.Player)
      ? unique.filter((role) => role !== UserRole.Player)
      : unique;
  return filtered.sort(
    (a, b) => USER_ROLE_ORDER.indexOf(a) - USER_ROLE_ORDER.indexOf(b),
  );
}
