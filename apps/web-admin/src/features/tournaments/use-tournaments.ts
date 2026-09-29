import type { TournamentSummary } from '@acc/types';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const tournamentsQueryKey = ['tournaments', 'list'] as const;

/** GET /tournaments — viewer-scoped; Admin / Club Manager see every active tournament. */
export function useTournaments() {
  return useQuery({
    queryKey: tournamentsQueryKey,
    queryFn: ({ signal }) => apiFetch<TournamentSummary[]>('/tournaments', { signal }),
  });
}
