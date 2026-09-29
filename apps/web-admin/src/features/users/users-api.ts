import type {
  AdminUserDetail,
  AdminUsersPage,
  CreateAdminUserRequest,
  CreateAdminUserResponse,
  ListAdminUsersParams,
  UnlockAccountRequest,
  UpdateAdminUserRequest,
  UpdateAdminUserStatusRequest,
  UpdateAdminUserStatusResponse,
} from '@acc/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiSend } from '@/lib/api-client';

import { adminUsersSearchParams } from './user-list';

export const adminUsersKeys = {
  all: ['admin-users'] as const,
  page: (params: ListAdminUsersParams) => ['admin-users', 'page', params] as const,
  detail: (userId: string) => ['admin-users', 'detail', userId] as const,
};

/** One cursor page of GET /admin/users (Admin + Club Manager). */
export function useAdminUsersPage(params: ListAdminUsersParams) {
  return useQuery({
    queryKey: adminUsersKeys.page(params),
    queryFn: ({ signal }) =>
      apiFetch<AdminUsersPage>(`/admin/users?${adminUsersSearchParams(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: adminUsersKeys.detail(userId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId ?? '')}`, { signal }),
    enabled: userId !== null,
    // The edit form seeds from this once — always start from a fresh read.
    gcTime: 0,
  });
}

/** Mutations below are Admin-only server-side (MANAGE_ADMIN_USERS / UNLOCK). */
function useInvalidatingMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminUsersKeys.all }),
  });
}

export function useCreateAdminUser() {
  return useInvalidatingMutation((body: CreateAdminUserRequest) =>
    apiFetch<CreateAdminUserResponse>('/admin/users', { method: 'POST', body }),
  );
}

export function useUpdateAdminUser() {
  return useInvalidatingMutation(({ userId, body }: { userId: string; body: UpdateAdminUserRequest }) =>
    apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body }),
  );
}

export function useSetAdminUserStatus() {
  return useInvalidatingMutation(
    ({ userId, body }: { userId: string; body: UpdateAdminUserStatusRequest }) =>
      apiFetch<UpdateAdminUserStatusResponse>(`/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body,
      }),
  );
}

export function useDeleteAdminUser() {
  return useInvalidatingMutation((userId: string) =>
    apiSend(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  );
}

export function useUnlockAdminUser() {
  return useInvalidatingMutation((body: UnlockAccountRequest) =>
    apiSend('/auth/unlock', { method: 'POST', body }),
  );
}
