import type { AuthUser } from '@acc/types';

/** True when the user holds a scoped Center Sevak assignment. */
export function hasCenterSevakAccess(user: AuthUser | null | undefined): boolean {
  return (user?.centerSevakCenterIds?.length ?? 0) > 0;
}
