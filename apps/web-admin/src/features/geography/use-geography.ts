import type { CenterSummary, ProvinceSummary } from '@acc/types';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

const GEOGRAPHY_STALE_MS = 5 * 60_000;

/** Active provinces (GET /provinces). */
export function useProvinces() {
  return useQuery({
    queryKey: ['geography', 'provinces'],
    queryFn: ({ signal }) => apiFetch<ProvinceSummary[]>('/provinces', { signal }),
    staleTime: GEOGRAPHY_STALE_MS,
  });
}

/** Every active center (GET /centers); cascade by `provinceId` client-side. */
export function useCenters() {
  return useQuery({
    queryKey: ['geography', 'centers'],
    queryFn: ({ signal }) => apiFetch<CenterSummary[]>('/centers', { signal }),
    staleTime: GEOGRAPHY_STALE_MS,
  });
}

export function centersInProvince(
  centers: readonly CenterSummary[],
  provinceId: string | null,
): CenterSummary[] {
  return provinceId ? centers.filter((c) => c.provinceId === provinceId) : [...centers];
}
