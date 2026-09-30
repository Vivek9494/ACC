import {
  type AddTeamPlayersRequest,
  type AddTeamPlayersResponse,
  type AssignTeamRolesRequest,
  type AssignTeamRolesResponse,
  type CreateGroupRequest,
  type CreateMatchRequest,
  type CreateTeamRequest,
  type GroupSummary,
  type UpdateGroupRequest,
  type LateRegisterCandidatesView,
  type LateRegistrationRequest,
  type MatchDetail,
  type MatchListItem,
  type MatchSchedulingFormat,
  type RoundRobinMatchSetupContext,
  type SelectMatchSchedulingFormatRequest,
  type UpdateMatchRequest,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RegistrationVerificationQueue,
  type ScorecardResponse,
  TEAM_LOGO_MAX_BYTES,
  type TeamAddPlayersPickerView,
  type TeamDetailView,
  type TeamSummary,
  type TournamentDetail,
  type UpdateRatingsRequest,
  type UpdateTeamRequest,
  type UploadTeamLogoResponse,
  type VerifiedRegisteredPlayersView,
} from '@acc/types';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, apiSend } from '@/lib/api-client';
import { uploadJpegImage } from '@/lib/image-upload';

export const tournamentDetailKeys = {
  detail: (tournamentId: string) => ['tournament', tournamentId] as const,
  teams: (tournamentId: string) => ['tournament', tournamentId, 'teams'] as const,
  groups: (tournamentId: string) => ['tournament', tournamentId, 'groups'] as const,
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

/**
 * Create / rename / delete a team. The API enforces EDIT_TOURNAMENT (Admin always; organizer
 * Club Manager / Center Sevak), the team cap, unique names, and the no-matches delete rule.
 */
export function useTeamMutations(tournamentId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.detail(tournamentId) });
  const teamPath = (teamId: string) => tournamentPath(tournamentId, `teams/${encodeURIComponent(teamId)}`);

  return {
    create: useMutation({
      mutationFn: (body: CreateTeamRequest) =>
        apiFetch<TeamSummary>(tournamentPath(tournamentId, 'teams'), { method: 'POST', body }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ teamId, body }: { teamId: string; body: UpdateTeamRequest }) =>
        apiFetch<TeamSummary>(teamPath(teamId), { method: 'PATCH', body }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (teamId: string) => apiSend(teamPath(teamId), { method: 'DELETE' }),
      onSuccess,
    }),
  };
}

/** GET …/add-player-candidates — confirmed registrants not on any team in the tournament. */
export function useAddPlayerCandidates(tournamentId: string, teamId: string | null) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.team(tournamentId, teamId ?? ''), 'candidates'],
    queryFn: ({ signal }) =>
      apiFetch<TeamAddPlayersPickerView>(
        tournamentPath(tournamentId, `teams/${encodeURIComponent(teamId ?? '')}/add-player-candidates`),
        { signal },
      ),
    enabled: teamId !== null,
    // Any roster change on any team alters who is available, so never render a cached list.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Roster add / remove (cap + single-team rules) and Captain / VC / Manager assignment — the same
 * gated endpoints as mobile (registration-closed window, who-can-assign matrix, auto-roster).
 */
export function useRosterMutations(tournamentId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.teams(tournamentId) });
  const teamPath = (teamId: string, resource: string) =>
    tournamentPath(tournamentId, `teams/${encodeURIComponent(teamId)}/${resource}`);

  return {
    addPlayers: useMutation({
      mutationFn: ({ teamId, body }: { teamId: string; body: AddTeamPlayersRequest }) =>
        apiFetch<AddTeamPlayersResponse>(teamPath(teamId, 'players'), { method: 'POST', body }),
      onSuccess,
    }),
    removePlayer: useMutation({
      mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
        apiSend(teamPath(teamId, `players/${encodeURIComponent(userId)}`), { method: 'DELETE' }),
      onSuccess,
    }),
    assignRoles: useMutation({
      mutationFn: ({ teamId, body }: { teamId: string; body: AssignTeamRolesRequest }) =>
        apiFetch<AssignTeamRolesResponse>(teamPath(teamId, 'roles'), { method: 'PATCH', body }),
      onSuccess,
    }),
  };
}

/** Logo: session → presigned PUT → complete. Persist `storageKey`; show `logoUrl`. */
export function uploadTeamLogo(file: File): Promise<UploadTeamLogoResponse> {
  return uploadJpegImage<UploadTeamLogoResponse>(file, {
    sessionPath: '/tournaments/team-logo/upload-session',
    completePath: '/tournaments/team-logo/complete',
    maxBytes: TEAM_LOGO_MAX_BYTES,
    tooLargeMessage: `Team logo must be ${TEAM_LOGO_MAX_BYTES / (1024 * 1024)} MB or smaller`,
  });
}

/** GET /tournaments/:id/matches — fixtures in schedule order with score lines + results. */
export function useTournamentMatches(tournamentId: string) {
  return useQuery({
    queryKey: tournamentDetailKeys.matches(tournamentId),
    queryFn: ({ signal }) => apiFetch<MatchListItem[]>(tournamentPath(tournamentId, 'matches'), { signal }),
  });
}

/** GET /matches/:id — full fixture for Edit Match Setup. */
export function useMatchDetail(matchId: string | null) {
  return useQuery({
    queryKey: ['match', matchId ?? ''],
    queryFn: ({ signal }) => apiFetch<MatchDetail>(`/matches/${encodeURIComponent(matchId ?? '')}`, { signal }),
    enabled: matchId !== null,
    staleTime: 0,
  });
}

/** GET …/matches/round-robin-setup — next match number, standings, pairings already scheduled. */
export function useRoundRobinSetup(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.matches(tournamentId), 'round-robin-setup'],
    queryFn: ({ signal }) =>
      apiFetch<RoundRobinMatchSetupContext>(tournamentPath(tournamentId, 'matches/round-robin-setup'), { signal }),
    enabled,
    staleTime: 0,
  });
}

/** GET /tournaments/:id/groups — groups with their teams and per-group lock. */
export function useTournamentGroups(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: tournamentDetailKeys.groups(tournamentId),
    queryFn: ({ signal }) => apiFetch<GroupSummary[]>(tournamentPath(tournamentId, 'groups'), { signal }),
    enabled,
  });
}

/**
 * Create / edit / delete a group. The API enforces CREATE_MATCH (Admin; organizer Club Manager /
 * Center Sevak), unique names, the per-group lock once matches exist, and finalizes (or, when the
 * last group goes, un-finalizes) Group Stage + Knockout.
 */
export function useGroupMutations(tournamentId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.detail(tournamentId) });
  const groupPath = (groupId: string) => tournamentPath(tournamentId, `groups/${encodeURIComponent(groupId)}`);

  return {
    create: useMutation({
      mutationFn: (body: CreateGroupRequest) =>
        apiFetch<GroupSummary>(tournamentPath(tournamentId, 'groups'), { method: 'POST', body }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ groupId, body }: { groupId: string; body: UpdateGroupRequest }) =>
        apiFetch<GroupSummary>(groupPath(groupId), { method: 'PATCH', body }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (groupId: string) => apiSend(groupPath(groupId), { method: 'DELETE' }),
      onSuccess,
    }),
  };
}

/**
 * Schedule / edit / delete fixtures and pick the scheduling format. The API enforces CREATE_MATCH,
 * EDIT_MATCH / DELETE_MATCH (upcoming fixtures only) and the fixture rules.
 */
export function useMatchMutations(tournamentId: string) {
  const queryClient = useQueryClient();
  const onSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.matches(tournamentId) }),
      queryClient.invalidateQueries({ queryKey: tournamentDetailKeys.detail(tournamentId), exact: true }),
    ]);
  };
  const matchPath = (matchId: string) => `/matches/${encodeURIComponent(matchId)}`;

  return {
    selectFormat: useMutation({
      mutationFn: (schedulingFormat: MatchSchedulingFormat) =>
        apiFetch<TournamentDetail>(tournamentPath(tournamentId, 'match-scheduling-format'), {
          method: 'POST',
          body: { schedulingFormat } satisfies SelectMatchSchedulingFormatRequest,
        }),
      onSuccess: (updated) => queryClient.setQueryData(tournamentDetailKeys.detail(tournamentId), updated),
    }),
    create: useMutation({
      mutationFn: (body: CreateMatchRequest) =>
        apiFetch<MatchDetail>(tournamentPath(tournamentId, 'matches'), { method: 'POST', body }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ matchId, body }: { matchId: string; body: UpdateMatchRequest }) =>
        apiFetch<MatchDetail>(matchPath(matchId), { method: 'PATCH', body }),
      onSuccess: async (_saved, { matchId }) => {
        queryClient.removeQueries({ queryKey: ['match', matchId] });
        await onSuccess();
      },
    }),
    remove: useMutation({
      mutationFn: (matchId: string) => apiSend(matchPath(matchId), { method: 'DELETE' }),
      onSuccess,
    }),
  };
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
    /** §7.6: the server confirms immediately (no approval step) and re-checks permission + center. */
    lateRegister: useMutation({
      mutationFn: (body: LateRegistrationRequest) =>
        apiFetch<RegistrationDetail>(tournamentPath(tournamentId, 'registrations/late'), { method: 'POST', body }),
      onSuccess,
    }),
  };
}

/** GET …/registrations/late-candidates — active Players from participating centers with no registration yet. */
export function useLateRegisterCandidates(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.registrations(tournamentId), 'late-candidates'],
    queryFn: ({ signal }) =>
      apiFetch<LateRegisterCandidatesView>(tournamentPath(tournamentId, 'registrations/late-candidates'), {
        signal,
      }),
    enabled,
    // Every registration changes who is eligible, so never render a cached list.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/** GET …/registrations/form-fields — the tournament's custom registration questions (often none). */
export function useRegistrationFormFields(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentDetailKeys.registrations(tournamentId), 'form-fields'],
    queryFn: ({ signal }) =>
      apiFetch<RegistrationFieldDefinition[]>(tournamentPath(tournamentId, 'registrations/form-fields'), {
        signal,
      }),
    enabled,
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
