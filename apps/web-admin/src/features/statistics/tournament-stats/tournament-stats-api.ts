import type { TournamentLeaderboard, TournamentStandings, TournamentStatsView } from '@acc/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const tournamentStatsKeys = {
  all: ['tournament-stats'] as const,
  leaderboard: (tournamentId: string, teamId: string | null) =>
    ['tournament-stats', tournamentId, 'leaderboard', teamId] as const,
  stats: (tournamentId: string, teamId: string | null) => ['tournament-stats', tournamentId, 'stats', teamId] as const,
  standings: (tournamentId: string) => ['tournament-stats', tournamentId, 'standings'] as const,
};

function tournamentPath(tournamentId: string, resource: string, teamId: string | null = null): string {
  const query = teamId ? `?${new URLSearchParams({ teamId })}` : '';
  return `/tournaments/${encodeURIComponent(tournamentId)}/${resource}${query}`;
}

/** GET /tournaments/:id/leaderboard — cached server-side (batting + bowling). */
export function useTournamentLeaderboard(tournamentId: string | null, teamId: string | null) {
  return useQuery({
    queryKey: tournamentStatsKeys.leaderboard(tournamentId ?? '', teamId),
    queryFn: ({ signal }) =>
      apiFetch<TournamentLeaderboard>(tournamentPath(tournamentId ?? '', 'leaderboard', teamId), { signal }),
    enabled: tournamentId !== null,
    placeholderData: keepPreviousData,
  });
}

/** GET /tournaments/:id/stats — cached aggregates + most sixes / fours. */
export function useTournamentStatsView(tournamentId: string | null, teamId: string | null) {
  return useQuery({
    queryKey: tournamentStatsKeys.stats(tournamentId ?? '', teamId),
    queryFn: ({ signal }) =>
      apiFetch<TournamentStatsView>(tournamentPath(tournamentId ?? '', 'stats', teamId), { signal }),
    enabled: tournamentId !== null,
    placeholderData: keepPreviousData,
  });
}

/** GET /tournaments/:id/standings — points table (per group or combined). */
export function useTournamentStandings(tournamentId: string | null) {
  return useQuery({
    queryKey: tournamentStatsKeys.standings(tournamentId ?? ''),
    queryFn: ({ signal }) => apiFetch<TournamentStandings>(tournamentPath(tournamentId ?? '', 'standings'), { signal }),
    enabled: tournamentId !== null,
  });
}
