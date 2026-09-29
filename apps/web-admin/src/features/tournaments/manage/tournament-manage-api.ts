import {
  BallType,
  TOURNAMENT_POSTER_MAX_BYTES,
  type CreateTournamentRequest,
  type PlaceDetails,
  type PlaceSuggestion,
  type ResolvedLocationResult,
  type ReverseGeocodeResult,
  type TournamentBrowseEntry,
  type TournamentDashboardPermissions,
  type TournamentDetail,
  type TournamentEditFormData,
  type TournamentTypeDefinitionCatalogEntry,
  type UpdateTournamentRequest,
  type UploadTournamentPosterResponse,
} from '@acc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiSend } from '@/lib/api-client';
import { uploadJpegImage } from '@/lib/image-upload';

import { tournamentDetailKeys } from '../detail/tournament-detail-api';

export const tournamentManageKeys = {
  editForm: (tournamentId: string) => ['tournament', tournamentId, 'edit-form'] as const,
  permissions: ['tournaments', 'browse-permissions'] as const,
  typeCatalog: (provinceId: string) => ['tournament-types', 'catalog', provinceId] as const,
};

const tournamentPath = (tournamentId: string, resource = ''): string =>
  `/tournaments/${encodeURIComponent(tournamentId)}${resource ? `/${resource}` : ''}`;

/** GET /tournaments/:id/edit-form — detail + locked scope labels + dates that already have matches. Organizer only. */
export function useTournamentEditForm(tournamentId: string) {
  return useQuery({
    queryKey: tournamentManageKeys.editForm(tournamentId),
    queryFn: ({ signal }) =>
      apiFetch<TournamentEditFormData>(tournamentPath(tournamentId, 'edit-form'), { signal }),
    staleTime: 0,
  });
}

/** GET /tournaments/browse — server-resolved edit/delete permissions per tournament (organizer rules). */
export function useTournamentPermissions() {
  return useQuery({
    queryKey: tournamentManageKeys.permissions,
    queryFn: ({ signal }) => apiFetch<TournamentBrowseEntry[]>('/tournaments/browse', { signal }),
    select: (entries): ReadonlyMap<string, TournamentDashboardPermissions> =>
      new Map(entries.map((entry) => [entry.tournament.id, entry.permissions])),
  });
}

/** GET /tournament-types?provinceId&ballType=TENNIS — the APL scopes offered for a province. */
export function useTournamentTypeCatalog(provinceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: tournamentManageKeys.typeCatalog(provinceId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<TournamentTypeDefinitionCatalogEntry[]>(
        `/tournament-types?provinceId=${encodeURIComponent(provinceId ?? '')}&ballType=${BallType.Tennis}`,
        { signal },
      ),
    enabled: enabled && Boolean(provinceId),
  });
}

function useInvalidateTournaments() {
  const queryClient = useQueryClient();
  return (tournamentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    if (tournamentId)
      void queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.detail(tournamentId) });
  };
}

/** POST /tournaments. */
export function useCreateTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (body: CreateTournamentRequest) =>
      apiFetch<TournamentDetail>('/tournaments', { method: 'POST', body }),
    onSuccess: (created) => invalidate(created.id),
  });
}

/** PATCH /tournaments/:id. */
export function useUpdateTournament(tournamentId: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (body: UpdateTournamentRequest) =>
      apiFetch<TournamentDetail>(tournamentPath(tournamentId), { method: 'PATCH', body }),
    onSuccess: () => invalidate(tournamentId),
  });
}

/** DELETE /tournaments/:id — soft delete; registrants are notified server-side. */
export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) =>
      apiSend(tournamentPath(tournamentId), { method: 'DELETE' }),
    onSuccess: (_data, tournamentId) => {
      queryClient.removeQueries({ queryKey: tournamentDetailKeys.detail(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export const POSTER_TOO_LARGE_MESSAGE = `Poster must be ${TOURNAMENT_POSTER_MAX_BYTES / (1024 * 1024)} MB or smaller`;

/** Poster: session → presigned PUT → complete. Persist `storageKey`; show `posterUrl`. */
export function uploadTournamentPoster(file: File): Promise<UploadTournamentPosterResponse> {
  return uploadJpegImage<UploadTournamentPosterResponse>(file, {
    sessionPath: '/tournaments/poster/upload-session',
    completePath: '/tournaments/poster/complete',
    maxBytes: TOURNAMENT_POSTER_MAX_BYTES,
    tooLargeMessage: POSTER_TOO_LARGE_MESSAGE,
  });
}

export function searchPlaces(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ q: query, sessionToken });
  return apiFetch<PlaceSuggestion[]>(`/places/autocomplete?${params.toString()}`, { signal });
}

export function placeDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const params = new URLSearchParams({ placeId, sessionToken });
  return apiFetch<PlaceDetails>(`/places/details?${params.toString()}`);
}

export function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  return apiFetch<ReverseGeocodeResult>(`/places/reverse?${params.toString()}`);
}

export function resolveMapsLink(url: string): Promise<ResolvedLocationResult> {
  const params = new URLSearchParams({ url });
  return apiFetch<ResolvedLocationResult>(`/places/resolve-maps-link?${params.toString()}`);
}
