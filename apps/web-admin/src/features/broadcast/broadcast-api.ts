import type {
  ActiveBroadcast,
  AdminBroadcastView,
  BroadcastHistoryEntry,
  CreateBroadcastRequest,
} from '@acc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiFetchOptional, apiSend } from '@/lib/api-client';

import { uploadBroadcastImage } from './broadcast-image';

export const broadcastKeys = {
  all: ['broadcast'] as const,
  active: ['broadcast', 'active'] as const,
  history: ['broadcast', 'history'] as const,
};

/** GET /admin/broadcast — the live banner (or null) with poster + time remaining. Admin + Club Manager. */
export function useAdminBroadcast() {
  return useQuery({
    queryKey: broadcastKeys.active,
    queryFn: ({ signal }) => apiFetchOptional<AdminBroadcastView>('/admin/broadcast', { signal }),
    refetchInterval: 60_000,
  });
}

/** GET /admin/broadcast/history — newest first. */
export function useBroadcastHistory() {
  return useQuery({
    queryKey: broadcastKeys.history,
    queryFn: ({ signal }) =>
      apiFetch<BroadcastHistoryEntry[]>('/admin/broadcast/history', { signal }),
  });
}

export interface PostBroadcastInput {
  text: string;
  image: File | null;
  imageMaxMb: number;
}

export function useBroadcastMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
  return {
    post: useMutation({
      mutationFn: async ({ text, image, imageMaxMb }: PostBroadcastInput) => {
        const imageStorageKey = image
          ? (await uploadBroadcastImage(image, imageMaxMb)).storageKey
          : null;
        const trimmed = text.trim();
        const body: CreateBroadcastRequest = {
          text: trimmed.length > 0 ? trimmed : null,
          imageStorageKey,
        };
        return apiFetch<ActiveBroadcast>('/admin/broadcast', { method: 'POST', body });
      },
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: () => apiSend('/admin/broadcast/active', { method: 'DELETE' }),
      onSuccess,
    }),
  };
}
