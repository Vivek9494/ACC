import type { CaptainFeaturedMatchSummary } from './captain';
import type { JerseySize } from './jersey-size';
import { UserRole } from './auth';
import type { BallType } from './rbac';
import type {
  PlayerRegistrationRole,
  RegistrationPlayerType,
} from './registration';
import type {
  PlayerProfileCareerStats,
  PlayerProfileTournamentSummary,
  PlayerProfileYearSummary,
} from './player-profile';

/** Admin dashboard aggregate counts (GET /admin/overview). */
export interface AdminOverview {
  provinceCount: number;
  centerCount: number;
  activeTournamentCount: number;
  totalUserCount: number;
  tournamentCount: number;
  matchesTodayCount: number;
  pendingApprovalsCount: number;
  /** App-wide fixtures scheduled today (venue-local), same set as other role dashboards. */
  featuredMatches: CaptainFeaturedMatchSummary[];
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

/** User with a birthday today (GET /admin/birthdays/today). */
export type { BirthdayUserSummary, TodayBirthdayUserSummary } from './birthdays';

/** Row on the admin user directory (PII masked server-side for non-admin requesters). */
export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  maskedMobileNumber: string;
  /** Full E.164 mobile — included only for platform Admin / Club Manager directory viewers. */
  mobileNumber?: string;
  profilePhotoUrl: string | null;
  isActive: boolean;
  /** Deduped platform + scoped roles for chip display. */
  roles: UserRole[];
  /** Account created (UTC ISO 8601). */
  createdAt: string;
  /**
   * Ball formats this user has actually played (non-voided delivery participation),
   * for Admin / Club Manager Users list icons. Empty when neither.
   */
  playedBallTypes: BallType[];
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
  /** Full E.164 mobile — admin detail/edit only. */
  mobileNumber: string;
  email: string;
  centerId: string;
  centerName: string;
  provinceId: string;
  provinceName: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string;
  jerseyNumber: number;
  jerseyName: string | null;
  jerseySize: JerseySize | null;
  /** Platform `User.role` (distinct from scoped role assignments). */
  platformRole: UserRole;
  /** Latest registration skill ratings (0–10); null when none. */
  battingRating: number | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
  /** Latest registration self-reported role label, e.g. "All-rounder". */
  playerRoleLabel: string | null;
  roleAssignments: AdminUserRoleAssignment[];
  /** True when the user must set a new password before other app access. */
  mustChangePassword: boolean;
  /** UTC ISO 8601 expiry for an admin-issued temporary password; null when not applicable. */
  tempPasswordExpiresAt: string | null;
}

/** Cursor-paginated admin user list (GET /admin/users). */
export interface AdminUsersPage {
  items: AdminUserSummary[];
  nextCursor: string | null;
}

/** Query params for GET /admin/users. */
export interface ListAdminUsersParams {
  q?: string;
  /** Filter to users whose registration center is in this province. */
  provinceId?: string;
  /** Filter to users whose registration center matches (implies province when both sent). */
  centerId?: string;
  cursor?: string;
  limit?: number;
}

/** Body for PATCH /admin/users/:id/status. */
export interface UpdateAdminUserStatusRequest {
  isActive: boolean;
}

export interface UpdateAdminUserStatusResponse {
  id: string;
  isActive: boolean;
}

/** Platform roles stored on `User.role` (legacy admin edit subset). */
export const ADMIN_PLATFORM_ROLES: UserRole[] = [
  UserRole.Admin,
  UserRole.ClubManager,
  UserRole.CenterSevak,
  UserRole.Player,
];

/** All roles an admin may assign to `User.role` when creating or editing a user. */
export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.Admin,
  UserRole.ClubManager,
  UserRole.CenterSevak,
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
  UserRole.Player,
];

/** Roles that participate in cricket — show player type + skill ratings on admin user forms. */
export const ADMIN_PLAYING_ROLES: UserRole[] = [
  UserRole.Player,
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
];

export function isAdminPlayingRole(role: UserRole): boolean {
  return ADMIN_PLAYING_ROLES.includes(role);
}

/** Platform roles that may open the system-wide user directory (read-only for Club Manager). */
export function canViewAdminUsersDirectory(role: UserRole): boolean {
  return role === UserRole.Admin || role === UserRole.ClubManager;
}

/** Platform roles that may create, edit, or delete users via admin APIs. */
export function canManageAdminUsers(role: UserRole): boolean {
  return role === UserRole.Admin;
}

/** Roles that receive full E.164 mobile numbers in admin user list/detail payloads. */
export function canViewAdminUserFullMobile(role: UserRole): boolean {
  return canViewAdminUsersDirectory(role);
}

/** Body for PATCH /admin/users/:id (admin profile edit). */
export interface UpdateAdminUserRequest {
  firstName: string;
  lastName: string;
  /** Canadian mobile in E.164 (+1XXXXXXXXXX). */
  mobileNumber: string;
  /** Optional; empty string clears the stored email. */
  email?: string;
  provinceId: string;
  centerId: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string;
  jerseyNumber: number;
  jerseyName?: string | null;
  platformRole: UserRole;
  /** Applied to the user's most recent registration when present. */
  battingRating?: number | null;
  bowlingRating?: number | null;
  fieldingRating?: number | null;
}

/** Body for POST /admin/users (admin creates a user account). */
export interface CreateAdminUserRequest {
  firstName: string;
  lastName: string;
  /** Canadian mobile in E.164 (+1XXXXXXXXXX). */
  mobileNumber: string;
  /** Platform `User.role`; defaults to Player when omitted. */
  platformRole: UserRole;
  email?: string;
  provinceId: string;
  centerId: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth?: string;
  jerseyNumber?: number;
  jerseyName?: string | null;
  /** Leather registration player type — stored when the user later registers. */
  playerRole?: PlayerRegistrationRole | null;
  playerType?: RegistrationPlayerType | null;
  battingRating?: number | null;
  bowlingRating?: number | null;
  fieldingRating?: number | null;
}

/** Response from POST /admin/users — includes a one-time temporary password. */
export interface CreateAdminUserResponse {
  user: AdminUserDetail;
  /** Plaintext shown once to the admin — never stored or logged server-side. */
  temporaryPassword: string;
  /** UTC ISO 8601 — when the temporary password stops working. */
  expiresAt: string;
}

/** One-time response from POST /admin/users/:id/temporary-password. */
export interface GenerateTemporaryPasswordResponse {
  /** Plaintext shown once to the admin — never stored or logged server-side. */
  temporaryPassword: string;
  /** UTC ISO 8601 — when the temporary password stops working. */
  expiresAt: string;
}

/** Career stats for GET /admin/users/:id/stats (ball-type scoped). */
export interface AdminUserPlayerStatsView {
  ballType: BallType;
  ballTypeLabel: string;
  career: PlayerProfileCareerStats;
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
  showStumpingsCard: boolean;
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

/** Human-readable time remaining until a temporary password expires. */
export function formatAdminTempPasswordTimeRemaining(
  expiresAtIso: string,
  nowMs: number = Date.now(),
): string | null {
  const ms = new Date(expiresAtIso).getTime() - nowMs;
  if (ms <= 0) {
    return null;
  }
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    return `${days} day${days === 1 ? '' : 's'} remaining`;
  }
  if (hours >= 1) {
    return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
  }
  const minutes = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
}

/** Whether an admin-issued temporary password is still within its expiry window. */
export function isAdminTempPasswordActive(
  mustChangePassword: boolean,
  tempPasswordExpiresAt: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!mustChangePassword || tempPasswordExpiresAt == null) {
    return false;
  }
  return new Date(tempPasswordExpiresAt).getTime() > nowMs;
}
