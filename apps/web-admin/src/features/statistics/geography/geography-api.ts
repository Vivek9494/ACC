import type { AdminUsersByGeography } from '@acc/types';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const usersByGeographyQueryKey = ['admin-users-by-geography'] as const;

/** GET /admin/users-by-geography — Admin only (VIEW_ADMIN_OVERVIEW). */
export function useUsersByGeography() {
  return useQuery({
    queryKey: usersByGeographyQueryKey,
    queryFn: ({ signal }) => apiFetch<AdminUsersByGeography>('/admin/users-by-geography', { signal }),
  });
}
