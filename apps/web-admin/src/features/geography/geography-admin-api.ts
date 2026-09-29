import type {
  CenterDetail,
  CreateCenterRequest,
  CreateProvinceRequest,
  CreateTournamentTypeDefinitionRequest,
  ProvinceDetail,
  TournamentTypeDefinitionDetail,
  TournamentTypeDefinitionSummary,
  UpdateCenterRequest,
  UpdateProvinceRequest,
  UpdateTournamentTypeDefinitionRequest,
} from '@acc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiSend } from '@/lib/api-client';

/** Shares the `geography` prefix with the public province/center hooks so every write refreshes both. */
export const geographyAdminKeys = {
  all: ['geography'] as const,
  provinces: ['geography', 'admin', 'provinces'] as const,
  centers: (provinceId: string) => ['geography', 'admin', 'centers', provinceId] as const,
  types: ['geography', 'admin', 'tournament-types'] as const,
  type: (id: string) => ['geography', 'admin', 'tournament-types', id] as const,
};

const byId = (base: string, id: string): string => `${base}/${encodeURIComponent(id)}`;

/** GET /provinces/admin — every province (incl. archived) with its center count. Admin. */
export function useAdminProvinces() {
  return useQuery({
    queryKey: geographyAdminKeys.provinces,
    queryFn: ({ signal }) => apiFetch<ProvinceDetail[]>('/provinces/admin', { signal }),
  });
}

/** GET /centers/admin?provinceId= — a province's centers (incl. archived). Admin. */
export function useAdminCenters(provinceId: string | null) {
  return useQuery({
    queryKey: geographyAdminKeys.centers(provinceId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<CenterDetail[]>(
        `/centers/admin?provinceId=${encodeURIComponent(provinceId ?? '')}`,
        { signal },
      ),
    enabled: Boolean(provinceId),
  });
}

/** GET /admin/tournament-types — name, province, ball type, center count. Admin. */
export function useTournamentTypes() {
  return useQuery({
    queryKey: geographyAdminKeys.types,
    queryFn: ({ signal }) =>
      apiFetch<TournamentTypeDefinitionSummary[]>('/admin/tournament-types', { signal }),
  });
}

/** GET /admin/tournament-types/:id — adds the participating center ids for editing. */
export function useTournamentType(id: string | null) {
  return useQuery({
    queryKey: geographyAdminKeys.type(id ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<TournamentTypeDefinitionDetail>(byId('/admin/tournament-types', id ?? ''), {
        signal,
      }),
    enabled: Boolean(id),
  });
}

export function useGeographyMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: geographyAdminKeys.all });

  return {
    createProvince: useMutation({
      mutationFn: (body: CreateProvinceRequest) =>
        apiFetch<ProvinceDetail>('/provinces', { method: 'POST', body }),
      onSuccess,
    }),
    updateProvince: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateProvinceRequest }) =>
        apiFetch<ProvinceDetail>(byId('/provinces', id), { method: 'PATCH', body }),
      onSuccess,
    }),
    deleteProvince: useMutation({
      mutationFn: (id: string) => apiSend(byId('/provinces', id), { method: 'DELETE' }),
      onSuccess,
    }),
    createCenter: useMutation({
      mutationFn: (body: CreateCenterRequest) =>
        apiFetch<CenterDetail>('/centers', { method: 'POST', body }),
      onSuccess,
    }),
    updateCenter: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateCenterRequest }) =>
        apiFetch<CenterDetail>(byId('/centers', id), { method: 'PATCH', body }),
      onSuccess,
    }),
    deleteCenter: useMutation({
      mutationFn: (id: string) => apiSend(byId('/centers', id), { method: 'DELETE' }),
      onSuccess,
    }),
    createType: useMutation({
      mutationFn: (body: CreateTournamentTypeDefinitionRequest) =>
        apiFetch<TournamentTypeDefinitionDetail>('/admin/tournament-types', {
          method: 'POST',
          body,
        }),
      onSuccess,
    }),
    updateType: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateTournamentTypeDefinitionRequest }) =>
        apiFetch<TournamentTypeDefinitionDetail>(byId('/admin/tournament-types', id), {
          method: 'PATCH',
          body,
        }),
      onSuccess,
    }),
    deleteType: useMutation({
      mutationFn: (id: string) =>
        apiSend(byId('/admin/tournament-types', id), { method: 'DELETE' }),
      onSuccess,
    }),
  };
}
