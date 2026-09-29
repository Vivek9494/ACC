import type { MatchListItem, ScorecardResponse, TeamDetailView, TeamSummary, TournamentDetail } from '@acc/types';
import { useQueries, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const tournamentDetailKeys = {
  detail: (tournamentId: string) => ['tournament', tournamentId] as const,
  teams: (tournamentId: string) => ['tournament', tournamentId, 'teams'] as const,
  team: (tournamentId: string, teamId: string) => ['tournament', tournamentId, 'teams', teamId] as const,
  matches: (tournamentId: string) => ['tournament', tournamentId, 'matches'] as const,
  scorecard: (matchId: string) => ['match', matchId, 'scorecard'] as const,
};

const tournamentPath = (tournamentId: string, resource = ''): string =>
  `/tournaments/${encodeURIComponent(tournamentId)}${resource ? `/${resource}` : ''}`;

/** GET /tournaments/:id — header facts (type, ball, dates, teams). */
export function useTournamentDetail(tournamentId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.detail(tournamentId),
    queryFn: ({ signal }) => apiFetch<TournamentDetail>(tournamentPath(tournamentId), { signal }),
  });
}

/** GET /tournaments/:id/teams — team names + signed logos (no rosters). */
export function useTournamentTeams(tournamentId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.teams(tournamentId),
    queryFn: ({ signal }) => apiFetch<TeamSummary[]>(tournamentPath(tournamentId, 'teams'), { signal }),
  });
}

/** GET /tournaments/:id/teams/:teamId for every team, in parallel — rosters with signed photos. */
export function useTeamRosters(tournamentId: string, teams: readonly TeamSummary[]) {
  return useQueries({
    queries: teams.map((team) => ({
      queryKey: tournamentDetailKeys.team(tournamentId, team.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiFetch<TeamDetailView>(tournamentPath(tournamentId, `teams/${encodeURIComponent(team.id)}`), { signal }),
    })),
  });
}

/** GET /tournaments/:id/matches — fixtures in schedule order with score lines + results. */
export function useTournamentMatches(tournamentId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.matches(tournamentId),
    queryFn: ({ signal }) => apiFetch<MatchListItem[]>(tournamentPath(tournamentId, 'matches'), { signal }),
  });
}

/** GET /matches/:matchId/scorecard — innings batting / bowling / extras / totals. */
export function useMatchScorecard(matchId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.scorecard(matchId),
    queryFn: ({ signal }) =>
      apiFetch<ScorecardResponse>(`/matches/${encodeURIComponent(matchId)}/scorecard`, { signal }),
  });
}
