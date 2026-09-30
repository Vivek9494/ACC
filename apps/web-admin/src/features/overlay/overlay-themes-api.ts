import {
  OVERLAY_THEME_UPLOAD_FIELD,
  type CreateOverlayThemeRequest,
  type OverlayThemeControlKey,
  type OverlayThemeDetail,
  type OverlayThemeGraphicSource,
  type OverlayThemeSummary,
  type UpdateOverlayThemeRequest,
} from '@acc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiSend } from '@/lib/api-client';

const BASE = '/admin/overlay-themes';

export const overlayThemeKeys = {
  all: ['overlay-themes'] as const,
  list: ['overlay-themes', 'list'] as const,
  detail: (themeId: string) => ['overlay-themes', 'detail', themeId] as const,
};

function themePath(themeId: string): string {
  return `${BASE}/${encodeURIComponent(themeId)}`;
}

function graphicPath(themeId: string, controlKey: OverlayThemeControlKey): string {
  return `${themePath(themeId)}/graphics/${encodeURIComponent(controlKey)}`;
}

export function useOverlayThemes() {
  return useQuery({
    queryKey: overlayThemeKeys.list,
    queryFn: ({ signal }) => apiFetch<OverlayThemeSummary[]>(BASE, { signal }),
  });
}

export function useOverlayTheme(themeId: string | undefined) {
  return useQuery({
    queryKey: overlayThemeKeys.detail(themeId ?? ''),
    queryFn: ({ signal }) => apiFetch<OverlayThemeDetail>(themePath(themeId ?? ''), { signal }),
    enabled: themeId != null,
  });
}

/** Raw HTML for the sandboxed preview — fetched as JSON, never navigated to. */
export function fetchOverlayGraphicSource(
  themeId: string,
  controlKey: OverlayThemeControlKey,
): Promise<OverlayThemeGraphicSource> {
  return apiFetch<OverlayThemeGraphicSource>(`${graphicPath(themeId, controlKey)}/source`);
}

export function useOverlayThemeMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: overlayThemeKeys.all });
  return {
    create: useMutation({
      mutationFn: (body: CreateOverlayThemeRequest) =>
        apiFetch<OverlayThemeDetail>(BASE, { method: 'POST', body }),
      onSuccess,
    }),
    rename: useMutation({
      mutationFn: ({ themeId, body }: { themeId: string; body: UpdateOverlayThemeRequest }) =>
        apiFetch<OverlayThemeDetail>(themePath(themeId), { method: 'PATCH', body }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (themeId: string) => apiSend(themePath(themeId), { method: 'DELETE' }),
      onSuccess,
    }),
    upload: useMutation({
      mutationFn: ({
        themeId,
        controlKey,
        file,
      }: {
        themeId: string;
        controlKey: OverlayThemeControlKey;
        file: File;
      }) => {
        const body = new FormData();
        body.append(OVERLAY_THEME_UPLOAD_FIELD, file, file.name);
        return apiFetch<OverlayThemeDetail>(graphicPath(themeId, controlKey), {
          method: 'PUT',
          body,
        });
      },
      onSuccess,
    }),
    removeGraphic: useMutation({
      mutationFn: ({ themeId, controlKey }: { themeId: string; controlKey: OverlayThemeControlKey }) =>
        apiFetch<OverlayThemeDetail>(graphicPath(themeId, controlKey), { method: 'DELETE' }),
      onSuccess,
    }),
  };
}
