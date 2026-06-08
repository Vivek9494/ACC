/**
 * Minimal typed API client for the ACC backend.
 *
 * - Base URL comes from the EXPO_PUBLIC_API_URL env var.
 * - `setAuthToken` is where the JWT will be attached once auth is built; every
 *   request sends `Authorization: Bearer <token>` when a token is set.
 * - Errors from the api's standard envelope are surfaced as `ApiRequestError`.
 */

import {
  AuthErrorCode,
  type AuthResponse,
  type AuthTokens,
  type AuthUser,
  type AssignScorerRequest,
  type AvailabilitySummary,
  type CenterDetail,
  type CenterSummary,
  type CloneSuggestion,
  type ConfirmScorecardRequest,
  type CreateCenterRequest,
  type CreateMatchRequest,
  type CreateProvinceRequest,
  type CreateTournamentRequest,
  type ForgotPasswordRequest,
  type HandoverScorerRequest,
  type LateRegistrationRequest,
  type LockPlayingXiRequest,
  type LoginRequest,
  type MatchDetail,
  type MatchState,
  type MatchSummary,
  type ProvinceDetail,
  type ProvinceSummary,
  type RecordDeliveryRequest,
  type RecordTossRequest,
  type RefreshRequest,
  type ScorecardConfirmationView,
  type ScorecardResponse,
  type SelectManOfMatchRequest,
  type SetDlsTargetRequest,
  type StartInningsRequest,
  type UpdateOversAllottedRequest,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RegistrationSortKey,
  type RegistrationStatus,
  type RegistrationSummary,
  type ResetPasswordRequest,
  type SignupRequest,
  type SquadCandidate,
  type SubmitRegistrationRequest,
  type TournamentDetail,
  type TournamentState,
  type TournamentSummary,
  type UpdateAvailabilityRequest,
  type UpdateCenterRequest,
  type UpdateProvinceRequest,
  type UpdateRatingsRequest,
  type UpdateTournamentRequest,
} from '@acc/types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

let authToken: string | null = null;

/** Set (or clear) the JWT used for subsequent requests. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Register a callback invoked when the api rejects a request because the
 * access token's version no longer matches the server (single-device logout,
 * §3.2). The app uses this to clear tokens and route back to Login.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export interface ApiError {
  code: string;
  message: string | string[];
  requestId?: string;
}

/** Uniform response envelope returned by the api: `{ data, error }`. */
export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly error: ApiError;

  constructor(status: number, error: ApiError) {
    super(Array.isArray(error.message) ? error.message.join(', ') : error.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.error = error;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value && 'error' in value;
}

/**
 * Perform a JSON request against the api and return the parsed body as `T`.
 * Throws `ApiRequestError` on non-2xx responses.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const error: ApiError = isEnvelope(parsed)
      ? (parsed.error ?? { code: 'UNKNOWN', message: response.statusText })
      : { code: 'UNKNOWN', message: response.statusText };

    // A token-version mismatch means another device logged in; drop the
    // session and let the app route back to Login.
    if (response.status === 401 && error.code === AuthErrorCode.TokenVersionMismatch) {
      onUnauthorized?.();
    }

    throw new ApiRequestError(response.status, error);
  }

  // The api returns either a raw payload or an `{ data }` envelope.
  if (isEnvelope(parsed)) {
    return parsed.data as T;
  }
  return parsed as T;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

/** Example call used by the Welcome screen to prove connectivity. */
export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}

export function getCenters(provinceId?: string): Promise<CenterSummary[]> {
  const qs = provinceId ? `?provinceId=${encodeURIComponent(provinceId)}` : '';
  return apiFetch<CenterSummary[]>(`/centers${qs}`);
}

export function getProvinces(): Promise<ProvinceSummary[]> {
  return apiFetch<ProvinceSummary[]>('/provinces');
}

export function listProvincesAdmin(): Promise<ProvinceDetail[]> {
  return apiFetch<ProvinceDetail[]>('/provinces/admin');
}

export function createProvince(body: CreateProvinceRequest): Promise<ProvinceDetail> {
  return apiFetch<ProvinceDetail>('/provinces', { method: 'POST', body });
}

export function updateProvince(
  id: string,
  body: UpdateProvinceRequest,
): Promise<ProvinceDetail> {
  return apiFetch<ProvinceDetail>(`/provinces/${id}`, { method: 'PATCH', body });
}

export function deleteProvince(id: string): Promise<void> {
  return apiFetch<void>(`/provinces/${id}`, { method: 'DELETE' });
}

export function listCentersAdmin(provinceId?: string): Promise<CenterDetail[]> {
  const qs = provinceId ? `?provinceId=${encodeURIComponent(provinceId)}` : '';
  return apiFetch<CenterDetail[]>(`/centers/admin${qs}`);
}

export function createCenter(body: CreateCenterRequest): Promise<CenterDetail> {
  return apiFetch<CenterDetail>('/centers', { method: 'POST', body });
}

export function updateCenter(id: string, body: UpdateCenterRequest): Promise<CenterDetail> {
  return apiFetch<CenterDetail>(`/centers/${id}`, { method: 'PATCH', body });
}

export function deleteCenter(id: string): Promise<void> {
  return apiFetch<void>(`/centers/${id}`, { method: 'DELETE' });
}

export function signup(body: SignupRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body });
}

export function login(body: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body });
}

export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const body: RefreshRequest = { refreshToken };
  return apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body });
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/forgot-password', { method: 'POST', body });
}

export function resetPassword(body: ResetPasswordRequest): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/reset-password', { method: 'POST', body });
}

// --- Tournaments (§6, §24) -------------------------------------------------

export function listTournaments(): Promise<TournamentSummary[]> {
  return apiFetch<TournamentSummary[]>('/tournaments');
}

export function getTournament(id: string): Promise<TournamentDetail> {
  return apiFetch<TournamentDetail>(`/tournaments/${id}`);
}

export function createTournament(body: CreateTournamentRequest): Promise<TournamentDetail> {
  return apiFetch<TournamentDetail>('/tournaments', { method: 'POST', body });
}

export function updateTournament(
  id: string,
  body: UpdateTournamentRequest,
): Promise<TournamentDetail> {
  return apiFetch<TournamentDetail>(`/tournaments/${id}`, { method: 'PATCH', body });
}

export function transitionTournamentState(
  id: string,
  state: TournamentState,
): Promise<TournamentDetail> {
  return apiFetch<TournamentDetail>(`/tournaments/${id}/state`, {
    method: 'POST',
    body: { state },
  });
}

/** Suggests cloning team names from a past tournament with the same name (§6.2). */
export function getCloneSuggestion(name: string): Promise<CloneSuggestion | null> {
  return apiFetch<CloneSuggestion | null>(
    `/tournaments/clone-suggestion?name=${encodeURIComponent(name)}`,
  );
}

// --- Registration (§7) -----------------------------------------------------

export interface ListRegistrationsQuery {
  status?: RegistrationStatus;
  centerId?: string;
  sort?: RegistrationSortKey;
}

/** §7.1/§7.3: submit (or re-submit) the current player's registration. */
export function submitRegistration(
  tournamentId: string,
  body: SubmitRegistrationRequest,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(`/tournaments/${tournamentId}/registrations`, {
    method: 'POST',
    body,
  });
}

/** §7.3: the current player's registration status, or null if not registered. */
export function getMyRegistration(tournamentId: string): Promise<RegistrationDetail | null> {
  return apiFetch<RegistrationDetail | null>(`/tournaments/${tournamentId}/registrations/me`);
}

/** §7.4: Center-scoped registration list with optional filters/sort. */
export function listRegistrations(
  tournamentId: string,
  query: ListRegistrationsQuery = {},
): Promise<RegistrationSummary[]> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.centerId) params.set('centerId', query.centerId);
  if (query.sort) params.set('sort', query.sort);
  const qs = params.toString();
  return apiFetch<RegistrationSummary[]>(
    `/tournaments/${tournamentId}/registrations${qs ? `?${qs}` : ''}`,
  );
}

export function approveRegistration(
  tournamentId: string,
  registrationId: string,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(
    `/tournaments/${tournamentId}/registrations/${registrationId}/approve`,
    { method: 'POST' },
  );
}

export function declineRegistration(
  tournamentId: string,
  registrationId: string,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(
    `/tournaments/${tournamentId}/registrations/${registrationId}/decline`,
    { method: 'POST' },
  );
}

/** §7.5: update an own-Center player's ratings (APL). */
export function updateRegistrationRatings(
  tournamentId: string,
  registrationId: string,
  body: UpdateRatingsRequest,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(
    `/tournaments/${tournamentId}/registrations/${registrationId}/ratings`,
    { method: 'PATCH', body },
  );
}

/** §7.5: record an own-Center player's availability (APL). */
export function updateRegistrationAvailability(
  tournamentId: string,
  registrationId: string,
  body: UpdateAvailabilityRequest,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(
    `/tournaments/${tournamentId}/registrations/${registrationId}/availability`,
    { method: 'PATCH', body },
  );
}

/** §7.5: availability bar-chart aggregate (APL). */
export function getAvailabilitySummary(tournamentId: string): Promise<AvailabilitySummary> {
  return apiFetch<AvailabilitySummary>(`/tournaments/${tournamentId}/registrations/availability`);
}

/** §7.6: late-register a missed player (Organizer / Center Sevak). */
export function lateRegisterPlayer(
  tournamentId: string,
  body: LateRegistrationRequest,
): Promise<RegistrationDetail> {
  return apiFetch<RegistrationDetail>(`/tournaments/${tournamentId}/registrations/late`, {
    method: 'POST',
    body,
  });
}

/** §7.2: the tournament's custom registration fields. */
export function listRegistrationFields(
  tournamentId: string,
): Promise<RegistrationFieldDefinition[]> {
  return apiFetch<RegistrationFieldDefinition[]>(
    `/tournaments/${tournamentId}/registrations/form-fields`,
  );
}

// --- Match setup (§5.2, §11) -----------------------------------------------

export function listMatches(tournamentId: string): Promise<MatchSummary[]> {
  return apiFetch<MatchSummary[]>(`/tournaments/${tournamentId}/matches`);
}

export function getMatch(matchId: string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}`);
}

export function createMatch(
  tournamentId: string,
  body: CreateMatchRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/tournaments/${tournamentId}/matches`, { method: 'POST', body });
}

/** §9.7: selectable players for a team's Playing-11 screen (with suspended badge). */
export function getSquadCandidates(
  matchId: string,
  teamId: string,
): Promise<SquadCandidate[]> {
  return apiFetch<SquadCandidate[]>(
    `/matches/${matchId}/squad-candidates?teamId=${encodeURIComponent(teamId)}`,
  );
}

/** §9.7/§8: lock a team's Playing 11 + substitutes (+ impact candidates). */
export function lockPlayingXi(
  matchId: string,
  body: LockPlayingXiRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/playing-xi`, { method: 'POST', body });
}

/** §11.2: record toss data (winner + bat/bowl decision). */
export function recordToss(matchId: string, body: RecordTossRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/toss`, { method: 'POST', body });
}

/** §5.2: drive the match state machine (start, complete, delay, cancel, …). */
export function setMatchState(matchId: string, state: MatchState): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/status`, { method: 'POST', body: { state } });
}

/** §11.1: assign a per-match Scorer. */
export function assignScorer(matchId: string, body: AssignScorerRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/scorer`, { method: 'POST', body });
}

/** §11.1: mid-match Scorer handover. */
export function handoverScorer(
  matchId: string,
  body: HandoverScorerRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/scorer/handover`, { method: 'POST', body });
}

/** §11.1: revoke a player's per-match Scorer grant. */
export function revokeScorer(matchId: string, userId: string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/scorer/${userId}`, { method: 'DELETE' });
}

// --- Scoring (§12, §14, §28) -----------------------------------------------

/** §2/§28: public, guest-readable live scorecard snapshot. */
export function getScorecard(matchId: string): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/scorecard`);
}

/** §14: open a new innings (normal or Super Over). */
export function startInnings(
  matchId: string,
  body: StartInningsRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/innings`, { method: 'POST', body });
}

/** §12.1: append a scoring event to an innings. */
export function recordDelivery(
  matchId: string,
  inningsId: string,
  body: RecordDeliveryRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/innings/${inningsId}/deliveries`, {
    method: 'POST',
    body,
  });
}

/** §12.2: edit a ball within the scorer edit window. */
export function editDelivery(
  matchId: string,
  body: import('@acc/types').EditDeliveryRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/deliveries`, { method: 'PUT', body });
}

/** §12.1: enter the DLS-revised target. */
export function setDlsTarget(
  matchId: string,
  body: SetDlsTargetRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/dls-target`, { method: 'PUT', body });
}

/** §12.2: revise overs allotted after a rain interruption. */
export function setOversAllotted(
  matchId: string,
  body: UpdateOversAllottedRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/overs-allotted`, {
    method: 'PATCH',
    body,
  });
}

// --- Scorecard confirmation & post-match (§13, §16) ------------------------

/** §13.1: confirmation status (also triggers the lazy auto-confirm safety-net). */
export function getScorecardConfirmation(matchId: string): Promise<ScorecardConfirmationView> {
  return apiFetch<ScorecardConfirmationView>(`/matches/${matchId}/confirmation`);
}

/** §13.1: Captain / VC confirms the scorecard, locking the match. */
export function confirmScorecard(
  matchId: string,
  body: ConfirmScorecardRequest = {},
): Promise<ScorecardConfirmationView> {
  return apiFetch<ScorecardConfirmationView>(`/matches/${matchId}/confirm-scorecard`, {
    method: 'POST',
    body,
  });
}

/** §13.3: Captain selects the Man of the Match. */
export function selectManOfMatch(
  matchId: string,
  body: SelectManOfMatchRequest,
): Promise<ScorecardConfirmationView> {
  return apiFetch<ScorecardConfirmationView>(`/matches/${matchId}/man-of-the-match`, {
    method: 'PUT',
    body,
  });
}

/** §13.2: post-confirmation correction — append a delivery (Admin / ACC Club Manager). */
export function recordPostConfirmDelivery(
  matchId: string,
  inningsId: string,
  body: RecordDeliveryRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(
    `/matches/${matchId}/post-confirm/innings/${inningsId}/deliveries`,
    { method: 'POST', body },
  );
}

/** §13.2: post-confirmation correction — edit a delivery (Admin / ACC Club Manager). */
export function editPostConfirmDelivery(
  matchId: string,
  body: import('@acc/types').EditDeliveryRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/post-confirm/deliveries`, {
    method: 'PUT',
    body,
  });
}

/** §16: absolute URL to the guest-accessible scorecard PDF export. */
export function scorecardPdfUrl(matchId: string): string {
  return `${API_BASE_URL}/matches/${matchId}/scorecard.pdf`;
}
