import type {
  MatchListItem,
  RegistrationDetail,
  RegistrationVerificationQueue,
  ScorecardResponse,
  TeamDetailView,
  TeamSummary,
  TournamentDetail,
  UpdateRatingsRequest,
  VerifiedRegisteredPlayersView,
} from '@acc/types';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const tournamentDetailKeys = {
  detail: (tournamentId: string) => ['tournament', tournamentId] as const,
  teams: (tournamentId: string) => ['tournament', tournamentId, 'teams'] as const,
  team: (tournamentId: string, teamId: string) => ['tournament', tournamentId, 'teams', teamId] as const,
  matches: (tournamentId: string) => ['tournament', tournamentId, 'matches'] as const,
  scorecard: (matchId: string) => ['match', matchId, 'scorecard'] as const,
  registrations: (tournamentId: string) => ['tournament', tournamentId, 'registrations'] as const,
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

/**
 * GET /tournaments/:id/registrations/verification-queue — every registrant plus the
 * server's verification phase and `canManage` (window + who-can-verify). Admin.
 */
export function useVerificationQueue(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.registrations(tournamentId), 'queue'],
    queryFn: ({ signal }) =>
      apiFetch<RegistrationVerificationQueue>(tournamentPath(tournamentId, 'registrations/verification-queue'), {
        signal,
      }),
    enabled,
  });
}

/** GET /tournaments/:id/registrations/verified — read-only waitlist / confirmed / declined lists. */
export function useRegisteredPlayers(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.registrations(tournamentId), 'verified'],
    queryFn: ({ signal }) =>
      apiFetch<VerifiedRegisteredPlayersView>(tournamentPath(tournamentId, 'registrations/verified'), { signal }),
    enabled,
  });
}

/** Approve / decline / revert / ratings — the API re-checks the verification window and verifier scope. */
export function useRegistrationActions(tournamentId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.registrations(tournamentId) });
  const registrationPath = (registrationId: string, action: string) =>
    tournamentPath(tournamentId, `registrations/${encodeURIComponent(registrationId)}/${action}`);
  const review = (action: 'approve' | 'decline' | 'revert-waitlist') => (registrationId: string) =>
    apiFetch<RegistrationDetail>(registrationPath(registrationId, action), { method: 'POST' });

  return {
    approve: useMutation({ mutationFn: review('approve'), onSuccess }),
    decline: useMutation({ mutationFn: review('decline'), onSuccess }),
    revert: useMutation({ mutationFn: review('revert-waitlist'), onSuccess }),
    updateRatings: useMutation({
      mutationFn: ({ registrationId, body }: { registrationId: string; body: UpdateRatingsRequest }) =>
        apiFetch<RegistrationDetail>(registrationPath(registrationId, 'ratings'), { method: 'PATCH', body }),
      onSuccess,
    }),
  };
}

/** GET /matches/:matchId/scorecard — innings batting / bowling / extras / totals. */
export function useMatchScorecard(matchId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.scorecard(matchId),
    queryFn: ({ signal }) =>
      apiFetch<ScorecardResponse>(`/matches/${encodeURIComponent(matchId)}/scorecard`, { signal }),
  });
}
