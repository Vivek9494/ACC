import type {
  AdminAppSettings,
  ChangePasswordRequest,
  ChangePasswordResponse,
  UpdateAdminAppSettingsRequest,
  UploadLimits,
} from '@acc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const settingsKeys = {
  admin: ['settings', 'admin'] as const,
  uploadLimits: ['settings', 'upload-limits'] as const,
};

/** GET /admin/settings — upload limits, Maps key, masked AWS key. Admin. */
export function useAdminSettings(enabled: boolean) {
  return useQuery({
    queryKey: settingsKeys.admin,
    queryFn: ({ signal }) => apiFetch<AdminAppSettings>('/admin/settings', { signal }),
    enabled,
  });
}

/** GET /settings/upload-limits — public limits any signed-in user uploads against. */
export function useUploadLimits() {
  return useQuery({
    queryKey: settingsKeys.uploadLimits,
    queryFn: ({ signal }) => apiFetch<UploadLimits>('/settings/upload-limits', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAdminAppSettingsRequest) =>
      apiFetch<AdminAppSettings>('/admin/settings', { method: 'PATCH', body }),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.admin, saved);
      void queryClient.invalidateQueries({ queryKey: settingsKeys.uploadLimits });
    },
  });
}

/** POST /auth/change-password — bumps tokenVersion, so every session (this one included) ends. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      apiFetch<ChangePasswordResponse>('/auth/change-password', { method: 'POST', body }),
  });
}
