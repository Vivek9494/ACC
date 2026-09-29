import {
  formatCanadianMobileForDisplay,
  type AdminUserSummary,
  type CenterSummary,
  type ListAdminUsersParams,
  type UserRole,
} from '@acc/types';

export interface UserListFilters {
  search: string;
  provinceId: string | null;
  centerId: string | null;
  role: UserRole | null;
}

export const DEFAULT_USER_FILTERS: UserListFilters = {
  search: '',
  provinceId: null,
  centerId: null,
  role: null,
};

export function hasActiveUserFilters(filters: UserListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.provinceId !== null ||
    filters.centerId !== null ||
    filters.role !== null
  );
}

/** Province change clears a center that belongs to a different province. */
export function withProvince(
  filters: UserListFilters,
  provinceId: string | null,
  centers: readonly CenterSummary[],
): UserListFilters {
  const center = filters.centerId ? centers.find((c) => c.id === filters.centerId) : undefined;
  const keepCenter = provinceId === null || center?.provinceId === provinceId;
  return { ...filters, provinceId, centerId: keepCenter ? filters.centerId : null };
}

/** Picking a center also selects its province (mirrors the mobile directory). */
export function withCenter(
  filters: UserListFilters,
  centerId: string | null,
  centers: readonly CenterSummary[],
): UserListFilters {
  const center = centerId ? centers.find((c) => c.id === centerId) : undefined;
  return { ...filters, centerId, provinceId: center ? center.provinceId : filters.provinceId };
}

export function toListParams(
  filters: UserListFilters,
  cursor: string | null,
  limit: number,
): ListAdminUsersParams {
  const q = filters.search.trim();
  return {
    ...(q ? { q } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
    ...(filters.centerId ? { centerId: filters.centerId } : {}),
    ...(cursor ? { cursor } : {}),
    limit,
  };
}

export function adminUsersSearchParams(params: ListAdminUsersParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  return qs.toString();
}

/**
 * Cursor paging for GET /admin/users: `cursors[i]` is the cursor that loads
 * page i (page 0 has none), so Previous is just stepping back.
 */
export interface CursorPaging {
  cursors: (string | null)[];
  pageIndex: number;
}

export const FIRST_PAGE: CursorPaging = { cursors: [null], pageIndex: 0 };

export function currentCursor(paging: CursorPaging): string | null {
  return paging.cursors[paging.pageIndex] ?? null;
}

export function nextPage(paging: CursorPaging, nextCursor: string | null): CursorPaging {
  if (!nextCursor) return paging;
  const cursors = paging.cursors.slice(0, paging.pageIndex + 1);
  cursors.push(nextCursor);
  return { cursors, pageIndex: paging.pageIndex + 1 };
}

export function previousPage(paging: CursorPaging): CursorPaging {
  return paging.pageIndex === 0 ? paging : { ...paging, pageIndex: paging.pageIndex - 1 };
}

export function userDisplayName(user: Pick<AdminUserSummary, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** Full number for Admin / Club Manager viewers; masked otherwise. */
export function userMobileLabel(user: Pick<AdminUserSummary, 'mobileNumber' | 'maskedMobileNumber'>): string {
  return user.mobileNumber ? formatCanadianMobileForDisplay(user.mobileNumber) : user.maskedMobileNumber;
}
