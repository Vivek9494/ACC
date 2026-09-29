import { type AuthUser, UserRole } from '@acc/types';

/** Platform roles allowed into the web admin dashboard. */
export const ADMIN_DASHBOARD_ROLES: readonly UserRole[] = [UserRole.Admin, UserRole.ClubManager];

export const ACCESS_DENIED_MESSAGE = 'This dashboard is for Admin and Club Manager accounts only.';

export const MUST_CHANGE_PASSWORD_MESSAGE =
  'Your account needs a new password. Finish the password change in the ACC mobile app, then sign in here.';

export const SESSION_ENDED_MESSAGE =
  'Your session ended — this account may have signed in on another device.';

export function canAccessAdminDashboard(user: Pick<AuthUser, 'role' | 'isActive'>): boolean {
  return user.isActive && ADMIN_DASHBOARD_ROLES.includes(user.role);
}

/** Why an authenticated user cannot use the dashboard, or null when they can. */
export function dashboardAccessBlocker(
  user: Pick<AuthUser, 'role' | 'isActive' | 'mustChangePassword'>,
): string | null {
  if (!canAccessAdminDashboard(user)) return ACCESS_DENIED_MESSAGE;
  if (user.mustChangePassword) return MUST_CHANGE_PASSWORD_MESSAGE;
  return null;
}
