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
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type CompleteForcedPasswordChangeRequest,
  type CompleteForcedPasswordChangeResponse,
  type AdminOverview,
  type AdminAppSettings,
  type AdminBroadcastView,
  type ActiveBroadcast,
  type BroadcastHistoryEntry,
  type UpdateAdminAppSettingsRequest,
  type UploadLimits,
  type AdminUserDetail,
  type AdminUserPlayerStatsView,
  type AdminUsersPage,
  type BirthdayUserSummary,
  type BirthdayTodayCountResponse,
  type TodayBirthdayUserSummary,
  type BallType,
  type ListAdminUsersParams,
  type CreateAdminUserRequest,
  type CreateAdminUserResponse,
  type UpdateAdminUserRequest,
  type UpdateAdminUserStatusRequest,
  type UpdateAdminUserStatusResponse,
  type CaptainDashboard,
  type CenterSevakDashboard,
  type ClubManagerDashboard,
  type GenerateTemporaryPasswordResponse,
  type GuestDashboard,
  type OwnPlayerMomMatchesView,
  type OwnPlayerStatsView,
  type PlayerDashboard,
  type ProfileDetail,
  type RequestProfileMobileOtpRequest,
  type UpdateProfileRequest,
  type UploadProfilePhotoResponse,
  type UploadTournamentPosterResponse,
  type AddExternalBatsmanRequest,
  type AddExternalBowlerRequest,
  type AssignScorerRequest,
  type AvailabilitySummary,
  type BatsmanPickerResponse,
  type BowlerPickerResponse,
  type FielderPickerResponse,
  BatsmanPickerRole,
  type CenterDetail,
  type CenterSummary,
  type CloneSuggestion,
  type ConfirmScorecardRequest,
  type CreateCenterRequest,
  type CreateMatchRequest,
  type CreateProvinceRequest,
  type CreateGroupRequest,
  type AssignTeamRolesRequest,
  type AssignTeamRolesResponse,
  type CreateTeamRequest,
  type TeamRoleCandidatesView,
  type UpdateTeamRequest,
  type CreateTournamentRequest,
  type CreateLeatherInvitesRequest,
  type CreateLeatherInvitesResponse,
  type LeatherInviteCandidatesResponse,
  type SetTournamentScorersRequest,
  type SetTournamentScorersResponse,
  type EnterScoringSessionResponse,
  type TournamentScorersSelectionView,
  type LeatherTournamentInvitesResponse,
  type ExternalPlayerView,
  type ForgotPasswordRequest,
  type GroupSummary,
  type UpdateGroupMembersRequest,
  type HandoverScorerRequest,
  type SwapMatchScorerRequest,
  type LateRegistrationRequest,
  type LateRegisterCandidatesView,
  type FinalizeBothPlayingXiRequest,
  type LockPlayingXiRequest,
  type LoginRequest,
  type MatchDetail,
  type DelayMatchRequest,
  type MatchSchedulingFormat,
  type MatchState,
  type MatchListItem,
  type MyMatchesResponse,
  type ConfirmPollPlayingXiRequest,
  type DesignatePenaltyServeRequest,
  type LateArrivalPenaltyActionResponse,
  type PlayingXiNoShowRecoveryRequest,
  type PlayingXiSwitchRequest,
  type ParticipationPollCardView,
  type ParticipationPollTallyView,
  type PlayingXiConfirmFromPollView,
  type PollPlayingXiSelectionView,
  type SubmitParticipationPollVoteRequest,
  type AttendanceMonitoringView,
  type AutoAttendancePunchRequest,
  type AutoAttendancePunchResponse,
  type PunchTimeAttendanceView,
  type SetAttendancePunchRequest,
  type PlaceDetails,
  type PlaceSuggestion,
  type ProvinceDetail,
  type ProvinceSummary,
  type CreateTournamentTypeDefinitionRequest,
  type TournamentTypeDefinitionCatalogEntry,
  type TournamentTypeDefinitionDetail,
  type TournamentTypeDefinitionSummary,
  type UpdateTournamentTypeDefinitionRequest,
  type RecordDeliveryRequest,
  type RecordTossRequest,
  type RegisterPushTokenRequest,
  type StartMatchSetupRequest,
  type RefreshRequest,
  type ReverseGeocodeResult,
  type UnregisterPushTokenRequest,
  type ResolvedLocationResult,
  type ManOfMatchEligibilityView,
  type ScorecardConfirmEligibilityView,
  type ScorecardConfirmationView,
  type ScorecardResponse,
  type SelectManOfMatchRequest,
  type SelectMatchSchedulingFormatRequest,
  type SetDlsTargetRequest,
  type SetInningsParticipantsRequest,
  type StartInningsRequest,
  type UndoDeliveryRequest,
  type UpdateMatchRequest,
  type UpdateOversAllottedRequest,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RoundRobinMatchSetupContext,
  type RegistrationSortKey,
  type RegistrationStatus,
  type RegistrationSummary,
  type RegistrationVerificationQueue,
  type ResetPasswordRequest,
  type VerifyResetOtpRequest,
  type VerifyResetOtpResponse,
  type SignupRequest,
  type SquadCandidate,
  type SubmitRegistrationRequest,
  type TeamDetailView,
  type TeamAddPlayersPickerView,
  type AddTeamPlayersRequest,
  type AddTeamPlayersResponse,
  type TournamentPlayerProfileView,
  type TeamSummary,
  type TournamentFeeEntry,
  type TournamentFeesTracker,
  type SetRegistrationFavouriteResponse,
  type TournamentFavouritePlayersView,
  type VerifiedRegisteredPlayersView,
  type LeatherRegisteredPlayersView,
  type ListLeatherRegisteredPlayersQuery,
  type PlayerSkillVideoCompleteUploadRequest,
  type PlayerSkillVideoPlaybackView,
  type PlayerSkillVideoSummary,
  type PlayerSkillVideoUploadSessionRequest,
  type PlayerSkillVideoUploadSessionResponse,
  type KnockoutBracketDeletePreview,
  type KnockoutBracketView,
  type GenerateKnockoutBracketRequest,
  type KnockoutQualificationResponse,
  type TournamentDetail,
  type TournamentLeaderboard,
  type TournamentStatsView,
  type TournamentStandings,
  type TournamentBrowseEntry,
  type TournamentDashboardEntry,
  type TournamentEditFormData,
  type TournamentState,
  type TournamentSummary,
  type UpdateAvailabilityRequest,
  type UpdateCenterRequest,
  type UpdateProvinceRequest,
  type UpdateRatingsRequest,
  type UpdateTournamentRequest,
  type UploadTeamLogoResponse,
} from '@acc/types';

import { loadTokens, saveTokens } from './session';
import { API_BASE_URL } from './api-base-url';

export { API_BASE_URL } from './api-base-url';

/** Serialize fetch/network errors for logs (Error objects often print as `{}`). */
export function describeApiError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

function warnIfApiBaseUrlLooksMalformed(url: string): void {
  if (!__DEV__) {
    return;
  }
  try {
    const parsed = new URL(url);
    const lastLabel = parsed.hostname.split('.').pop() ?? '';
    if (/^\d{4,5}$/.test(lastLabel) && !parsed.port) {
      console.warn(
        `[ACC] EXPO_PUBLIC_API_URL looks malformed (${url}). Use a colon before the port, e.g. http://192.168.x.x:3001`,
      );
    }
  } catch {
    console.warn(`[ACC] EXPO_PUBLIC_API_URL is not a valid URL: ${url}`);
  }
}

warnIfApiBaseUrlLooksMalformed(API_BASE_URL);

let authToken: string | null = null;

/** Set (or clear) the JWT used for subsequent requests. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getApiAuthToken(): string | null {
  return authToken;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
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
  fields?: Record<string, string>;
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

/**
 * Thrown after a failed refresh / token-version mismatch when the session has
 * been cleared and the app is routing to Login. Callers should not surface this
 * as a user-visible error.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  return err instanceof SessionExpiredError;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface InternalRequestOptions extends RequestOptions {
  /** When true, a 401 does not trigger refresh-and-retry (auth endpoints). */
  skipAuthRetry?: boolean;
  /** When true, omits Authorization even if a token is in memory (public guest reads). */
  skipAuthHeader?: boolean;
  /**
   * Public route that still forwards Bearer when logged in. Hydrates the token from
   * SecureStore when missing, and on a guest-style auth miss (401 / Leather "Sign in"
   * 403) silently refreshes once when a refresh token exists — without treating a
   * true guest (no stored session) as signed-out.
   */
  optionalAuth?: boolean;
  /** Internal guard — each request is retried at most once after refresh. */
  _authRetried?: boolean;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value && 'error' in value;
}

const AUTH_NO_RETRY_PREFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/verify-reset-otp',
  '/auth/reset-password',
  '/auth/change-password',
];

function shouldAttemptAccessTokenRefresh(path: string, status: number, error: ApiError): boolean {
  if (status !== 401) {
    return false;
  }
  if (error.code === AuthErrorCode.TokenVersionMismatch) {
    return false;
  }
  return !AUTH_NO_RETRY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Leather public detail treats a missing/invalid viewer as this 403 — not a real guest. */
function isOptionalAuthViewerMiss(status: number, error: ApiError): boolean {
  if (status === 401) {
    return true;
  }
  if (status !== 403) {
    return false;
  }
  const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
  return message === 'Sign in to view this tournament';
}

function isRefreshTerminalFailure(status: number, error: ApiError): boolean {
  return (
    status === 401 &&
    (error.code === AuthErrorCode.RefreshExpired ||
      error.code === AuthErrorCode.TokenVersionMismatch)
  );
}

let refreshInFlight: Promise<boolean> | null = null;
let hydrateInFlight: Promise<void> | null = null;

/** Load access token from SecureStore into memory when the in-memory copy is empty. */
async function hydrateAuthTokenFromStorage(): Promise<void> {
  if (authToken) {
    return;
  }
  if (!hydrateInFlight) {
    hydrateInFlight = (async () => {
      const stored = await loadTokens();
      if (stored?.accessToken && !authToken) {
        setAuthToken(stored.accessToken);
      }
    })().finally(() => {
      hydrateInFlight = null;
    });
  }
  await hydrateInFlight;
}

async function refreshAccessTokenOnce(): Promise<boolean> {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    return false;
  }

  try {
    const tokens = await apiFetchInternal<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: stored.refreshToken } satisfies RefreshRequest,
      skipAuthRetry: true,
    });
    await saveTokens(tokens);
    setAuthToken(tokens.accessToken);
    return true;
  } catch (err) {
    if (err instanceof ApiRequestError && isRefreshTerminalFailure(err.status, err.error)) {
      return false;
    }
    throw err;
  }
}

async function ensureFreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessTokenOnce().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function forceSessionLogout(): Promise<never> {
  onUnauthorized?.();
  throw new SessionExpiredError();
}

/**
 * Optional-auth miss with a stored session: refresh once and retry.
 * True guests (no refresh token) keep the original error — no logout.
 */
async function retryOptionalAuthAfterViewerMiss<T>(
  path: string,
  options: InternalRequestOptions,
): Promise<T | null> {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    return null;
  }
  try {
    const refreshed = await ensureFreshAccessToken();
    if (!refreshed) {
      return forceSessionLogout();
    }
  } catch (err) {
    // Transient refresh failure — surface as a retryable error, not "sign in".
    if (err instanceof SessionExpiredError) {
      throw err;
    }
    throw new Error(
      err instanceof Error ? err.message : 'Could not refresh session. Please try again.',
    );
  }
  return apiFetchInternal<T>(path, { ...options, _authRetried: true });
}

async function apiFetchInternal<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
  const {
    body,
    headers,
    skipAuthRetry,
    skipAuthHeader,
    optionalAuth,
    _authRetried,
    ...rest
  } = options;

  if (!skipAuthHeader) {
    await hydrateAuthTokenFromStorage();
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (authToken && !skipAuthHeader) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((err: unknown) => {
    throw new Error(
      `Network request failed for ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response from ${path}`);
    }
  }

  if (!response.ok) {
    const error: ApiError = isEnvelope(parsed)
      ? (parsed.error ?? { code: 'UNKNOWN', message: response.statusText })
      : { code: 'UNKNOWN', message: response.statusText };

    if (!_authRetried) {
      if (optionalAuth && isOptionalAuthViewerMiss(response.status, error)) {
        const retried = await retryOptionalAuthAfterViewerMiss<T>(path, options);
        if (retried !== null) {
          return retried;
        }
      } else if (!skipAuthRetry) {
        if (error.code === AuthErrorCode.TokenVersionMismatch) {
          return forceSessionLogout();
        }
        if (shouldAttemptAccessTokenRefresh(path, response.status, error)) {
          const refreshed = await ensureFreshAccessToken();
          if (!refreshed) {
            return forceSessionLogout();
          }
          return apiFetchInternal<T>(path, { ...options, _authRetried: true });
        }
      }
    }

    throw new ApiRequestError(response.status, error);
  }

  if (isEnvelope(parsed)) {
    return parsed.data as T;
  }
  return parsed as T;
}

/**
 * Perform a JSON request against the api and return the parsed body as `T`.
 * On 401, transparently refreshes the access token (single-flight) and retries
 * once. When refresh is impossible, clears the session and throws
 * {@link SessionExpiredError}.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiFetchInternal<T>(path, options);
}

/**
 * Public read-only fetch for guest flows (spec §2). Skips auth header and does not
 * attempt token refresh on 401 — avoids redirect-to-login loops when no session exists.
 */
export async function apiFetchPublic<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiFetchInternal<T>(path, { ...options, skipAuthHeader: true, skipAuthRetry: true });
}

/**
 * Public route that forwards Bearer when logged in so the server can resolve the
 * optional viewer (e.g. canEdit, myTeamId). Hydrates the token from storage when
 * missing; on an expired/missing-viewer response, silently refreshes once when a
 * session exists (true guests are unchanged).
 */
export async function apiFetchOptionalAuth<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiFetchInternal<T>(path, { ...options, optionalAuth: true, skipAuthRetry: true });
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

export function listTournamentTypeDefinitions(): Promise<TournamentTypeDefinitionSummary[]> {
  return apiFetch<TournamentTypeDefinitionSummary[]>('/admin/tournament-types');
}

/** Create Tournament — types for a province (authenticated; not Admin-only). */
export function listTournamentTypeCatalog(
  provinceId: string,
  ballType?: BallType,
): Promise<TournamentTypeDefinitionCatalogEntry[]> {
  const params = new URLSearchParams({ provinceId });
  if (ballType) {
    params.set('ballType', ballType);
  }
  return apiFetch<TournamentTypeDefinitionCatalogEntry[]>(`/tournament-types?${params}`);
}

export function getTournamentTypeDefinition(
  id: string,
): Promise<TournamentTypeDefinitionDetail> {
  return apiFetch<TournamentTypeDefinitionDetail>(`/admin/tournament-types/${id}`);
}

export function createTournamentTypeDefinition(
  body: CreateTournamentTypeDefinitionRequest,
): Promise<TournamentTypeDefinitionDetail> {
  return apiFetch<TournamentTypeDefinitionDetail>('/admin/tournament-types', {
    method: 'POST',
    body,
  });
}

export function updateTournamentTypeDefinition(
  id: string,
  body: UpdateTournamentTypeDefinitionRequest,
): Promise<TournamentTypeDefinitionDetail> {
  return apiFetch<TournamentTypeDefinitionDetail>(`/admin/tournament-types/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteTournamentTypeDefinition(id: string): Promise<void> {
  return apiFetch<void>(`/admin/tournament-types/${id}`, { method: 'DELETE' });
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

export function getAdminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>('/admin/overview');
}

export function getUploadLimits(): Promise<UploadLimits> {
  return apiFetch<UploadLimits>('/settings/upload-limits');
}

export function getAdminSettings(): Promise<AdminAppSettings> {
  return apiFetch<AdminAppSettings>('/admin/settings');
}

export function updateAdminSettings(body: UpdateAdminAppSettingsRequest): Promise<AdminAppSettings> {
  return apiFetch<AdminAppSettings>('/admin/settings', { method: 'PATCH', body });
}

export function getActiveBroadcast(): Promise<ActiveBroadcast | null> {
  return apiFetch<ActiveBroadcast | null>('/broadcast/active');
}

export function getAdminBroadcast(): Promise<AdminBroadcastView | null> {
  return apiFetch<AdminBroadcastView | null>('/admin/broadcast');
}

export function listBroadcastHistory(): Promise<BroadcastHistoryEntry[]> {
  return apiFetch<BroadcastHistoryEntry[]>('/admin/broadcast/history');
}

export function postBroadcast(
  text: string | null,
  imageStorageKey: string | null,
): Promise<ActiveBroadcast> {
  const trimmed = text?.trim() ?? '';
  return apiFetch<ActiveBroadcast>('/admin/broadcast', {
    method: 'POST',
    body: {
      ...(trimmed.length > 0 ? { text: trimmed } : {}),
      ...(imageStorageKey ? { imageStorageKey } : {}),
    },
  });
}

export function removeActiveBroadcast(): Promise<void> {
  return apiFetch<void>('/admin/broadcast/active', { method: 'DELETE' });
}

export function listAdminUsers(params: ListAdminUsersParams = {}): Promise<AdminUsersPage> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) {
    qs.set('q', params.q.trim());
  }
  if (params.provinceId) {
    qs.set('provinceId', params.provinceId);
  }
  if (params.centerId) {
    qs.set('centerId', params.centerId);
  }
  if (params.cursor) {
    qs.set('cursor', params.cursor);
  }
  if (params.limit != null) {
    qs.set('limit', String(params.limit));
  }
  const query = qs.toString();
  return apiFetch<AdminUsersPage>(`/admin/users${query ? `?${query}` : ''}`);
}

export function getBirthdayDirectory(): Promise<BirthdayUserSummary[]> {
  return apiFetch<BirthdayUserSummary[]>('/birthdays');
}

/** Active users with a birthday today (Eastern) — header cake badge. */
export function getBirthdayTodayCount(): Promise<BirthdayTodayCountResponse> {
  return apiFetch<BirthdayTodayCountResponse>('/birthdays/today-count');
}

/** @deprecated Use {@link getBirthdayDirectory}. */
export function getTodayBirthdays(): Promise<BirthdayUserSummary[]> {
  return getBirthdayDirectory();
}

export function getAdminUser(userId: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`);
}

export function getAdminUserStats(
  userId: string,
  ballType: BallType,
): Promise<AdminUserPlayerStatsView> {
  const qs = new URLSearchParams({ ballType });
  return apiFetch<AdminUserPlayerStatsView>(
    `/admin/users/${encodeURIComponent(userId)}/stats?${qs.toString()}`,
  );
}

export function createAdminUser(body: CreateAdminUserRequest): Promise<CreateAdminUserResponse> {
  return apiFetch<CreateAdminUserResponse>('/admin/users', {
    method: 'POST',
    body,
  });
}

export function updateAdminUser(
  userId: string,
  body: UpdateAdminUserRequest,
): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body,
  });
}

export function updateAdminUserStatus(
  userId: string,
  body: UpdateAdminUserStatusRequest,
): Promise<UpdateAdminUserStatusResponse> {
  return apiFetch<UpdateAdminUserStatusResponse>(
    `/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body,
    },
  );
}

export function deleteAdminUser(userId: string): Promise<void> {
  return apiFetch<void>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export function generateAdminTemporaryPassword(
  userId: string,
): Promise<GenerateTemporaryPasswordResponse> {
  return apiFetch<GenerateTemporaryPasswordResponse>(
    `/admin/users/${encodeURIComponent(userId)}/temporary-password`,
    { method: 'POST' },
  );
}

export function getClubManagerDashboard(): Promise<ClubManagerDashboard> {
  return apiFetch<ClubManagerDashboard>('/club-manager/dashboard');
}

export function getCaptainDashboard(): Promise<CaptainDashboard> {
  return apiFetch<CaptainDashboard>('/captain/dashboard');
}

export function getCenterSevakDashboard(): Promise<CenterSevakDashboard> {
  return apiFetch<CenterSevakDashboard>('/center-sevak/dashboard');
}

export function getPlayerDashboard(): Promise<PlayerDashboard> {
  return apiFetch<PlayerDashboard>('/player/dashboard');
}

/** Matches where the logged-in user is in the Playing XI (or rostered pre-lock). */
export function getMyMatches(): Promise<MyMatchesResponse> {
  return apiFetch<MyMatchesResponse>('/my-matches');
}

export function submitParticipationPollVote(
  pollId: string,
  body: SubmitParticipationPollVoteRequest,
): Promise<ParticipationPollCardView> {
  return apiFetch<ParticipationPollCardView>(`/participation-polls/${pollId}/vote`, {
    method: 'POST',
    body,
  });
}

export function getParticipationPollTally(pollId: string): Promise<ParticipationPollTallyView> {
  return apiFetch<ParticipationPollTallyView>(`/participation-polls/${pollId}/tally`);
}

export function getPlayingXiConfirmFromPoll(
  matchId: string,
  teamId: string,
): Promise<PlayingXiConfirmFromPollView> {
  const params = new URLSearchParams({ matchId, teamId });
  return apiFetch<PlayingXiConfirmFromPollView>(
    `/participation-polls/playing-xi-confirm?${params.toString()}`,
  );
}

export function getPollPlayingXiSelection(pollId: string): Promise<PollPlayingXiSelectionView> {
  return apiFetch<PollPlayingXiSelectionView>(`/participation-polls/${pollId}/playing-xi`);
}

export function confirmPollPlayingXi(
  pollId: string,
  body: ConfirmPollPlayingXiRequest,
): Promise<PollPlayingXiSelectionView> {
  return apiFetch<PollPlayingXiSelectionView>(`/participation-polls/${pollId}/playing-xi`, {
    method: 'POST',
    body,
  });
}

export function designatePenaltyServe(
  teamId: string,
  penaltyId: string,
  body: DesignatePenaltyServeRequest,
): Promise<LateArrivalPenaltyActionResponse> {
  return apiFetch<LateArrivalPenaltyActionResponse>(
    `/teams/${teamId}/late-arrival-penalties/${penaltyId}/designate`,
    { method: 'POST', body },
  );
}

export function undesignatePenaltyServe(
  teamId: string,
  penaltyId: string,
): Promise<LateArrivalPenaltyActionResponse> {
  return apiFetch<LateArrivalPenaltyActionResponse>(
    `/teams/${teamId}/late-arrival-penalties/${penaltyId}/undesignate`,
    { method: 'POST' },
  );
}

export function applyPlayingXiNoShowRecovery(
  pollId: string,
  body: PlayingXiNoShowRecoveryRequest,
): Promise<PollPlayingXiSelectionView> {
  return apiFetch<PollPlayingXiSelectionView>(
    `/participation-polls/${pollId}/playing-xi/no-show-recovery`,
    { method: 'POST', body },
  );
}

export function applyPlayingXiSwitch(
  pollId: string,
  body: PlayingXiSwitchRequest,
): Promise<PollPlayingXiSelectionView> {
  return apiFetch<PollPlayingXiSelectionView>(
    `/participation-polls/${pollId}/playing-xi/switch`,
    { method: 'POST', body },
  );
}

export function carryForwardSuspension(suspensionId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/suspensions/${suspensionId}/carry-forward`, { method: 'POST' });
}

export function cancelSuspension(suspensionId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/suspensions/${suspensionId}/cancel`, { method: 'POST' });
}

export function getAttendanceMonitoring(): Promise<AttendanceMonitoringView> {
  return apiFetch<AttendanceMonitoringView>('/attendance/monitoring');
}

export function autoAttendancePunch(
  matchId: string,
  body: AutoAttendancePunchRequest,
): Promise<AutoAttendancePunchResponse> {
  return apiFetch<AutoAttendancePunchResponse>(`/matches/${matchId}/attendance/auto-punch`, {
    method: 'POST',
    body,
  });
}

export function getPunchTimeAttendance(
  matchId: string,
  teamId: string,
): Promise<PunchTimeAttendanceView> {
  return apiFetch<PunchTimeAttendanceView>(
    `/matches/${matchId}/punch-time?teamId=${encodeURIComponent(teamId)}`,
  );
}

export function setAttendancePunch(
  matchId: string,
  userId: string,
  teamId: string,
  body: SetAttendancePunchRequest,
): Promise<PunchTimeAttendanceView> {
  return apiFetch<PunchTimeAttendanceView>(
    `/matches/${matchId}/attendance/${userId}/punch?teamId=${encodeURIComponent(teamId)}`,
    { method: 'PUT', body },
  );
}

export function revokeAttendancePunch(
  matchId: string,
  userId: string,
  teamId: string,
): Promise<PunchTimeAttendanceView> {
  return apiFetch<PunchTimeAttendanceView>(
    `/matches/${matchId}/attendance/${userId}/punch?teamId=${encodeURIComponent(teamId)}`,
    { method: 'DELETE' },
  );
}

export function verifyLateAttendancePunch(
  matchId: string,
  userId: string,
  teamId: string,
): Promise<PunchTimeAttendanceView> {
  return apiFetch<PunchTimeAttendanceView>(
    `/matches/${matchId}/attendance/${userId}/verify?teamId=${encodeURIComponent(teamId)}`,
    { method: 'POST' },
  );
}

export function unverifyLateAttendancePunch(
  matchId: string,
  userId: string,
  teamId: string,
): Promise<PunchTimeAttendanceView> {
  return apiFetch<PunchTimeAttendanceView>(
    `/matches/${matchId}/attendance/${userId}/verify?teamId=${encodeURIComponent(teamId)}`,
    { method: 'DELETE' },
  );
}

export function getGuestDashboard(): Promise<GuestDashboard> {
  return apiFetchPublic<GuestDashboard>('/guest/dashboard');
}

export function signup(body: SignupRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body });
}

export function login(body: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body });
}

export function logout(): Promise<void> {
  return apiFetchInternal<void>('/auth/logout', { method: 'POST', skipAuthRetry: true });
}

/** Register/refresh this device's FCM push token for the logged-in user (§17). */
export function registerPushToken(body: RegisterPushTokenRequest): Promise<void> {
  return apiFetch<void>('/notifications/device-tokens', { method: 'POST', body });
}

/** Unregister this device's push token on logout (best-effort). */
export function unregisterPushToken(body: UnregisterPushTokenRequest): Promise<void> {
  return apiFetchInternal<void>('/notifications/device-tokens', {
    method: 'DELETE',
    body,
    skipAuthRetry: true,
  });
}

export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const body: RefreshRequest = { refreshToken };
  return apiFetchInternal<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/forgot-password', { method: 'POST', body });
}

export function verifyResetOtp(body: VerifyResetOtpRequest): Promise<VerifyResetOtpResponse> {
  return apiFetch<VerifyResetOtpResponse>('/auth/verify-reset-otp', { method: 'POST', body });
}

export function resetPassword(body: ResetPasswordRequest): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/reset-password', { method: 'POST', body });
}

export function changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  return apiFetchInternal<ChangePasswordResponse>('/auth/change-password', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
}

export function completeForcedPasswordChange(
  body: CompleteForcedPasswordChangeRequest,
): Promise<CompleteForcedPasswordChangeResponse> {
  return apiFetchInternal<CompleteForcedPasswordChangeResponse>(
    '/auth/complete-forced-password-change',
    {
      method: 'POST',
      body,
      skipAuthRetry: true,
    },
  );
}

export function getProfile(): Promise<ProfileDetail> {
  return apiFetch<ProfileDetail>('/profile');
}

export function getOwnPlayerStats(ballType: BallType): Promise<OwnPlayerStatsView> {
  const qs = new URLSearchParams({ ballType });
  return apiFetch<OwnPlayerStatsView>(`/profile/stats?${qs.toString()}`);
}

/** Logged-in player's Man of the Match awards for one ball type (newest first). */
export function getOwnPlayerMomMatches(ballType: BallType): Promise<OwnPlayerMomMatchesView> {
  const qs = new URLSearchParams({ ballType });
  return apiFetch<OwnPlayerMomMatchesView>(`/profile/stats/man-of-the-match?${qs.toString()}`);
}

export function updateProfile(body: UpdateProfileRequest): Promise<ProfileDetail> {
  return apiFetch<ProfileDetail>('/profile', { method: 'PATCH', body });
}

export function requestProfileMobileOtp(body: RequestProfileMobileOtpRequest): Promise<void> {
  return apiFetch<void>('/profile/mobile/request-otp', { method: 'POST', body });
}

// --- Google Places proxy (server-side key) ---------------------------------

export function placesAutocomplete(
  q: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ q, sessionToken });
  return apiFetch<PlaceSuggestion[]>(`/places/autocomplete?${params.toString()}`);
}

export function placesDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const params = new URLSearchParams({ placeId, sessionToken });
  return apiFetch<PlaceDetails>(`/places/details?${params.toString()}`);
}

export function placesReverse(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  return apiFetch<ReverseGeocodeResult>(`/places/reverse?${params.toString()}`);
}

export function placesResolveMapsLink(url: string): Promise<ResolvedLocationResult> {
  const params = new URLSearchParams({ url });
  return apiFetch<ResolvedLocationResult>(`/places/resolve-maps-link?${params.toString()}`);
}

// --- Tournaments (§6, §24) -------------------------------------------------

export function listTournaments(): Promise<TournamentSummary[]> {
  return apiFetch<TournamentSummary[]>('/tournaments');
}

export function listPublicTournaments(): Promise<TournamentSummary[]> {
  return apiFetchPublic<TournamentSummary[]>('/tournaments');
}

export function listTournamentDashboardEntries(): Promise<TournamentDashboardEntry[]> {
  return apiFetch<TournamentDashboardEntry[]>('/tournaments/dashboard-entries');
}

export function listTournamentBrowseEntries(): Promise<TournamentBrowseEntry[]> {
  return apiFetch<TournamentBrowseEntry[]>('/tournaments/browse');
}

export function getTournament(id: string): Promise<TournamentDetail> {
  return apiFetchOptionalAuth<TournamentDetail>(`/tournaments/${id}`);
}

export function getKnockoutBracket(tournamentId: string): Promise<KnockoutBracketView> {
  return apiFetchOptionalAuth<KnockoutBracketView>(
    `/tournaments/${tournamentId}/knockout-bracket`,
  );
}

export function getKnockoutQualification(
  tournamentId: string,
): Promise<KnockoutQualificationResponse> {
  return apiFetch<KnockoutQualificationResponse>(
    `/tournaments/${tournamentId}/knockout-qualification`,
  );
}

export function generateKnockoutBracket(
  tournamentId: string,
  body?: GenerateKnockoutBracketRequest,
): Promise<KnockoutBracketView> {
  return apiFetch<KnockoutBracketView>(
    `/tournaments/${tournamentId}/knockout-bracket/generate`,
    { method: 'POST', body: body ?? {} },
  );
}

export function getKnockoutBracketDeletePreview(
  tournamentId: string,
): Promise<KnockoutBracketDeletePreview> {
  return apiFetchOptionalAuth<KnockoutBracketDeletePreview>(
    `/tournaments/${tournamentId}/knockout-bracket/delete-preview`,
  );
}

export function deleteKnockoutBracket(tournamentId: string): Promise<void> {
  return apiFetch<void>(`/tournaments/${tournamentId}/knockout-bracket`, {
    method: 'DELETE',
  });
}

export function listLeatherInviteCandidates(
  tournamentId: string,
  search?: string,
): Promise<LeatherInviteCandidatesResponse> {
  const params = search ? `?q=${encodeURIComponent(search)}` : '';
  return apiFetch<LeatherInviteCandidatesResponse>(
    `/tournaments/${tournamentId}/leather-invites/candidates${params}`,
  );
}

export function listLeatherInvites(
  tournamentId: string,
): Promise<LeatherTournamentInvitesResponse> {
  return apiFetch<LeatherTournamentInvitesResponse>(
    `/tournaments/${tournamentId}/leather-invites`,
  );
}

export function createLeatherInvites(
  tournamentId: string,
  body: CreateLeatherInvitesRequest,
): Promise<CreateLeatherInvitesResponse> {
  return apiFetch<CreateLeatherInvitesResponse>(
    `/tournaments/${tournamentId}/leather-invites`,
    { method: 'POST', body },
  );
}

export function revokeLeatherInvite(tournamentId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/tournaments/${tournamentId}/leather-invites/${userId}`, {
    method: 'DELETE',
  });
}

export function getTournamentScorersSelection(
  tournamentId: string,
): Promise<TournamentScorersSelectionView> {
  return apiFetch<TournamentScorersSelectionView>(`/tournaments/${tournamentId}/scorers`);
}

export function setTournamentScorers(
  tournamentId: string,
  body: SetTournamentScorersRequest,
): Promise<SetTournamentScorersResponse> {
  return apiFetch<SetTournamentScorersResponse>(`/tournaments/${tournamentId}/scorers`, {
    method: 'PUT',
    body,
  });
}

export function getTournamentEditForm(id: string): Promise<TournamentEditFormData> {
  return apiFetch<TournamentEditFormData>(`/tournaments/${id}/edit-form`);
}

export function listTeams(tournamentId: string): Promise<TeamSummary[]> {
  return apiFetchPublic<TeamSummary[]>(`/tournaments/${tournamentId}/teams`);
}

export function getTeamDetail(tournamentId: string, teamId: string): Promise<TeamDetailView> {
  return apiFetch<TeamDetailView>(`/tournaments/${tournamentId}/teams/${teamId}`);
}

export function listTeamAddPlayerCandidates(
  tournamentId: string,
  teamId: string,
): Promise<TeamAddPlayersPickerView> {
  return apiFetch<TeamAddPlayersPickerView>(
    `/tournaments/${tournamentId}/teams/${teamId}/add-player-candidates`,
  );
}

export function addPlayersToTeam(
  tournamentId: string,
  teamId: string,
  body: AddTeamPlayersRequest,
): Promise<AddTeamPlayersResponse> {
  return apiFetch<AddTeamPlayersResponse>(`/tournaments/${tournamentId}/teams/${teamId}/players`, {
    method: 'POST',
    body,
  });
}

export function removePlayerFromTeam(
  tournamentId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  return apiFetch<void>(`/tournaments/${tournamentId}/teams/${teamId}/players/${userId}`, {
    method: 'DELETE',
  });
}

/** Admin or Club Manager assigns Captain, Vice-Captain, and Manager for a team. */
export function assignTeamRoles(
  tournamentId: string,
  teamId: string,
  body: AssignTeamRolesRequest,
): Promise<AssignTeamRolesResponse> {
  return apiFetch<AssignTeamRolesResponse>(`/tournaments/${tournamentId}/teams/${teamId}/roles`, {
    method: 'PATCH',
    body,
  });
}

/** Captain / Club Manager tournament player profile (Team Detail → View Profile). */
export function getTournamentPlayerProfile(
  tournamentId: string,
  userId: string,
): Promise<TournamentPlayerProfileView> {
  return apiFetch<TournamentPlayerProfileView>(`/tournaments/${tournamentId}/players/${userId}`);
}

export function createTeam(tournamentId: string, body: CreateTeamRequest): Promise<TeamSummary> {
  return apiFetch<TeamSummary>(`/tournaments/${tournamentId}/teams`, { method: 'POST', body });
}

/** Confirmed registrants not yet on a team — for Captain / VC / Manager at team create. */
export function listTeamRoleCandidates(tournamentId: string): Promise<TeamRoleCandidatesView> {
  return apiFetch<TeamRoleCandidatesView>(
    `/tournaments/${tournamentId}/teams/role-candidates`,
  );
}

export function updateTeam(
  tournamentId: string,
  teamId: string,
  body: UpdateTeamRequest,
): Promise<TeamSummary> {
  return apiFetch<TeamSummary>(`/tournaments/${tournamentId}/teams/${teamId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteTeam(tournamentId: string, teamId: string): Promise<void> {
  return apiFetch<void>(`/tournaments/${tournamentId}/teams/${teamId}`, { method: 'DELETE' });
}

export function listGroups(tournamentId: string): Promise<GroupSummary[]> {
  return apiFetchPublic<GroupSummary[]>(`/tournaments/${tournamentId}/groups`);
}

export function getTournamentStandings(tournamentId: string): Promise<TournamentStandings> {
  return apiFetchPublic<TournamentStandings>(`/tournaments/${tournamentId}/standings`);
}

/**
 * Tournament player leaderboard (§15.5). Optional `teamId` filters to one team's players.
 */
export function getTournamentLeaderboard(
  tournamentId: string,
  teamId?: string | null,
): Promise<TournamentLeaderboard> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetchPublic<TournamentLeaderboard>(`/tournaments/${tournamentId}/leaderboard${query}`);
}

export function getTournamentStats(
  tournamentId: string,
  teamId?: string | null,
): Promise<TournamentStatsView> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetchPublic<TournamentStatsView>(`/tournaments/${tournamentId}/stats${query}`);
}

export function createGroup(tournamentId: string, body: CreateGroupRequest): Promise<GroupSummary> {
  return apiFetch<GroupSummary>(`/tournaments/${tournamentId}/groups`, { method: 'POST', body });
}

export function updateGroupMembers(
  tournamentId: string,
  groupId: string,
  body: UpdateGroupMembersRequest,
): Promise<GroupSummary> {
  return apiFetch<GroupSummary>(`/tournaments/${tournamentId}/groups/${groupId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteGroup(tournamentId: string, groupId: string): Promise<void> {
  return apiFetch<void>(`/tournaments/${tournamentId}/groups/${groupId}`, { method: 'DELETE' });
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

export function selectMatchSchedulingFormat(
  tournamentId: string,
  schedulingFormat: MatchSchedulingFormat,
): Promise<TournamentDetail> {
  const body: SelectMatchSchedulingFormatRequest = { schedulingFormat };
  return apiFetch<TournamentDetail>(`/tournaments/${tournamentId}/match-scheduling-format`, {
    method: 'POST',
    body,
  });
}

export function deleteTournament(id: string): Promise<void> {
  return apiFetch<void>(`/tournaments/${id}`, { method: 'DELETE' });
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

/** §7.3/§7.4: Center Sevak own-center verification queue + pending count. */
export function getRegistrationVerificationQueue(
  tournamentId: string,
): Promise<RegistrationVerificationQueue> {
  return apiFetch<RegistrationVerificationQueue>(
    `/tournaments/${tournamentId}/registrations/verification-queue`,
  );
}

/** §20: Center Sevak fees tracker (paid / remaining), own-center scope. */
export function getTournamentFeesTracker(tournamentId: string): Promise<TournamentFeesTracker> {
  return apiFetch<TournamentFeesTracker>(`/tournaments/${tournamentId}/fees/tracker`);
}

/** §20: manually record offline fee payment received. */
export function markTournamentFeePaid(
  tournamentId: string,
  feeId: string,
): Promise<TournamentFeeEntry> {
  return apiFetch<TournamentFeeEntry>(`/tournaments/${tournamentId}/fees/${feeId}/pay`, {
    method: 'POST',
  });
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

/** Verified registrants (all centers) — Captain / VC / Club Manager after verification (tennis). */
export function listVerifiedRegisteredPlayers(
  tournamentId: string,
  query: ListRegistrationsQuery = {},
): Promise<VerifiedRegisteredPlayersView> {
  const params = new URLSearchParams();
  if (query.sort) params.set('sort', query.sort);
  const qs = params.toString();
  return apiFetch<VerifiedRegisteredPlayersView>(
    `/tournaments/${tournamentId}/registrations/verified${qs ? `?${qs}` : ''}`,
  );
}

/** Leather ACC registrants — Admin / Club Manager squad-building list. */
export function listLeatherRegisteredPlayers(
  tournamentId: string,
  query: ListLeatherRegisteredPlayersQuery = {},
): Promise<LeatherRegisteredPlayersView> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.page != null) params.set('page', String(query.page));
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiFetch<LeatherRegisteredPlayersView>(
    `/tournaments/${tournamentId}/registrations/leather${qs ? `?${qs}` : ''}`,
  );
}

/** Toggle a verified registrant on the team's shared favourites shortlist. */
export function setRegistrationFavourite(
  tournamentId: string,
  userId: string,
  favourited: boolean,
): Promise<SetRegistrationFavouriteResponse> {
  return apiFetch<SetRegistrationFavouriteResponse>(
    `/tournaments/${tournamentId}/favourite-players/${userId}`,
    { method: 'PUT', body: { favourited } },
  );
}

/** Per-team favourites shortlist (Captain + Vice-Captain). */
export function getTournamentFavouritePlayers(
  tournamentId: string,
): Promise<TournamentFavouritePlayersView> {
  return apiFetch<TournamentFavouritePlayersView>(
    `/tournaments/${tournamentId}/favourite-players`,
  );
}

/** §19: the logged-in player's skill video for a tournament. */
export function getMyPlayerSkillVideo(
  tournamentId: string,
): Promise<PlayerSkillVideoSummary | null> {
  return apiFetch<PlayerSkillVideoSummary | null>(`/tournaments/${tournamentId}/skill-videos/me`);
}

/** @deprecated Use {@link getMyPlayerSkillVideo}. */
export const getMyPlayerVideo = getMyPlayerSkillVideo;

/** Scouting playback URL for a player's tournament skill video (Captain / VC / Club Manager). */
export function getPlayerSkillVideoPlayback(
  tournamentId: string,
  userId: string,
): Promise<PlayerSkillVideoPlaybackView> {
  return apiFetch<PlayerSkillVideoPlaybackView>(
    `/tournaments/${tournamentId}/skill-videos/${userId}/playback`,
  );
}

export function createPlayerSkillVideoUploadSession(
  tournamentId: string,
  body: PlayerSkillVideoUploadSessionRequest,
): Promise<PlayerSkillVideoUploadSessionResponse> {
  return apiFetch<PlayerSkillVideoUploadSessionResponse>(
    `/tournaments/${tournamentId}/skill-videos/upload-session`,
    { method: 'POST', body },
  );
}

/** @deprecated Use {@link createPlayerSkillVideoUploadSession}. */
export const createPlayerVideoUploadSession = createPlayerSkillVideoUploadSession;

export function completePlayerSkillVideoUpload(
  tournamentId: string,
  body: PlayerSkillVideoCompleteUploadRequest,
): Promise<PlayerSkillVideoSummary> {
  return apiFetch<PlayerSkillVideoSummary>(`/tournaments/${tournamentId}/skill-videos/complete`, {
    method: 'POST',
    body,
  });
}

/** @deprecated Use {@link completePlayerSkillVideoUpload}. */
export const completePlayerVideoUpload = completePlayerSkillVideoUpload;

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

/** §7.6: players eligible for late registration (picker). */
export function listLateRegisterCandidates(
  tournamentId: string,
): Promise<LateRegisterCandidatesView> {
  return apiFetch<LateRegisterCandidatesView>(
    `/tournaments/${tournamentId}/registrations/late-candidates`,
  );
}

/** §7.6: late-register a missed player (Admin / Club Manager / Center Sevak). */
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

export function listMatches(
  tournamentId: string,
  teamId?: string | null,
): Promise<MatchListItem[]> {
  const query =
    teamId != null && teamId !== ''
      ? `?teamId=${encodeURIComponent(teamId)}`
      : '';
  return apiFetch<MatchListItem[]>(`/tournaments/${tournamentId}/matches${query}`);
}

export function getRoundRobinMatchSetupContext(
  tournamentId: string,
): Promise<RoundRobinMatchSetupContext> {
  return apiFetch<RoundRobinMatchSetupContext>(
    `/tournaments/${tournamentId}/matches/round-robin-setup`,
  );
}

export function getMatch(matchId: string): Promise<MatchDetail> {
  return apiFetchOptionalAuth<MatchDetail>(`/matches/${matchId}`);
}

export function createMatch(
  tournamentId: string,
  body: CreateMatchRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/tournaments/${tournamentId}/matches`, { method: 'POST', body });
}

export function updateMatch(matchId: string, body: UpdateMatchRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}`, { method: 'PATCH', body });
}

export function deleteMatch(matchId: string): Promise<void> {
  return apiFetch<void>(`/matches/${matchId}`, { method: 'DELETE' });
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

/** Scorer / organizer: confirm Playing 11 for both teams in one step (§11). */
export function finalizeBothPlayingXi(
  matchId: string,
  body: FinalizeBothPlayingXiRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/playing-xi/finalize-both`, {
    method: 'POST',
    body,
  });
}

/** Pre-match external opponent roster — add a name-only player (§9.5). */
export function addOpponentPlayer(
  matchId: string,
  name: string,
): Promise<ExternalPlayerView> {
  return apiFetch<ExternalPlayerView>(`/matches/${matchId}/opponent-players`, {
    method: 'POST',
    body: { name },
  });
}

/** Pre-match external opponent roster — remove a name-only player (§9.5). */
export function removeOpponentPlayer(matchId: string, playerId: string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/opponent-players/${playerId}`, {
    method: 'DELETE',
  });
}

/** §11.2: record toss data (winner + bat/bowl decision). */
export function recordToss(matchId: string, body: RecordTossRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/toss`, { method: 'POST', body });
}

/** §11.2: scorer Match Setup — toss capture, derive sides, go Live, open innings 1. */
export function startScoring(matchId: string, body: RecordTossRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/start-scoring`, { method: 'POST', body });
}

/** §11: toss + opening players, transition to Live, and open the first innings. */
export function startMatchSetup(
  matchId: string,
  body: StartMatchSetupRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/start-setup`, { method: 'POST', body });
}

/** §5.2: drive the match state machine (start, complete, delay, cancel, …). */
export function setMatchState(matchId: string, state: MatchState): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/status`, { method: 'POST', body: { state } });
}

/** §5.2: apply a cumulative pre-live delay (Admin / Club Manager). */
export function delayMatch(
  matchId: string,
  body: DelayMatchRequest,
): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/delay`, { method: 'POST', body });
}

/** §11.1: assign a per-match Scorer. */
export function assignScorer(matchId: string, body: AssignScorerRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/scorer`, { method: 'POST', body });
}

/** Admin/Club Manager: swap the per-match scorer mid-match (tennis). */
export function swapMatchScorer(matchId: string, body: SwapMatchScorerRequest): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}/scorer/swap`, { method: 'POST', body });
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
  return apiFetchPublic<ScorecardResponse>(`/matches/${matchId}/scorecard`);
}

/** Tennis Phase 2: one-time auth when opening the live scoring screen. Leather: no-op. */
export function enterScoringSession(matchId: string): Promise<EnterScoringSessionResponse> {
  return apiFetch<EnterScoringSessionResponse>(`/matches/${matchId}/scoring-session`, {
    method: 'POST',
    body: {},
  });
}

export interface GetBatsmanPickerOptions {
  role: BatsmanPickerRole;
  otherSlotUserId?: string | null;
}

/** State-aware Select Batsman picker (derived innings + squad profiles). */
export function getBatsmanPicker(
  matchId: string,
  inningsId: string,
  options: GetBatsmanPickerOptions,
): Promise<BatsmanPickerResponse> {
  const params = new URLSearchParams({ role: options.role });
  if (options.otherSlotUserId) {
    params.set('otherSlotUserId', options.otherSlotUserId);
  }
  return apiFetch<BatsmanPickerResponse>(
    `/matches/${matchId}/innings/${inningsId}/batsman-picker?${params.toString()}`,
  );
}

/** §9.5: add a name-only batter for the external opponent during live scoring. */
export function addExternalBatsman(
  matchId: string,
  inningsId: string,
  body: AddExternalBatsmanRequest,
): Promise<ExternalPlayerView> {
  return apiFetch<ExternalPlayerView>(
    `/matches/${matchId}/innings/${inningsId}/external-batsmen`,
    { method: 'POST', body },
  );
}

/** State-aware Select Bowler picker (derived innings + squad profiles). */
export function getBowlerPicker(
  matchId: string,
  inningsId: string,
): Promise<BowlerPickerResponse> {
  return apiFetch<BowlerPickerResponse>(
    `/matches/${matchId}/innings/${inningsId}/bowler-picker`,
  );
}

/** Bowling squad list for caught / run-out / stumped fielder selection. */
export function getFielderPicker(
  matchId: string,
  inningsId: string,
  options: { excludeBowler?: boolean } = {},
): Promise<FielderPickerResponse> {
  const params = new URLSearchParams();
  if (options.excludeBowler) {
    params.set('excludeBowler', 'true');
  }
  const qs = params.toString();
  return apiFetch<FielderPickerResponse>(
    `/matches/${matchId}/innings/${inningsId}/fielder-picker${qs ? `?${qs}` : ''}`,
  );
}

/** §9.5: add a name-only bowler for the external opponent during live scoring. */
export function addExternalBowler(
  matchId: string,
  inningsId: string,
  body: AddExternalBowlerRequest,
): Promise<ExternalPlayerView> {
  return apiFetch<ExternalPlayerView>(
    `/matches/${matchId}/innings/${inningsId}/external-bowlers`,
    { method: 'POST', body },
  );
}

/** §9.5: rename a name-only external opponent player during live scoring. */
export function renameExternalPlayer(
  matchId: string,
  playerId: string,
  name: string,
): Promise<ExternalPlayerView> {
  return apiFetch<ExternalPlayerView>(`/matches/${matchId}/external-players/${playerId}`, {
    method: 'PATCH',
    body: { name },
  });
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

/** Undo the most recently appended delivery (re-derive all state). */
export function undoLastDelivery(
  matchId: string,
  inningsId: string,
  body: UndoDeliveryRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(
    `/matches/${matchId}/innings/${inningsId}/deliveries/undo`,
    { method: 'POST', body },
  );
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

/** Manually end the current innings and run the innings-transition flow (§12.2). */
export function endInnings(
  matchId: string,
  inningsId: string,
  body: import('@acc/types').EndInningsRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/innings/${inningsId}/end`, {
    method: 'POST',
    body,
  });
}

/** Persist or clear per-ball shot placement on an existing delivery. */
export function setDeliveryShotPlacement(
  matchId: string,
  inningsId: string,
  body: import('@acc/types').SetDeliveryShotPlacementRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(
    `/matches/${matchId}/innings/${inningsId}/deliveries/shot-placement`,
    { method: 'PATCH', body },
  );
}

/** Persist at-crease batters and/or the current-over bowler before the next delivery. */
export function setInningsParticipants(
  matchId: string,
  inningsId: string,
  body: SetInningsParticipantsRequest,
): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/matches/${matchId}/innings/${inningsId}/participants`, {
    method: 'PATCH',
    body,
  });
}

// --- Scorecard confirmation & post-match (§13, §16) ------------------------

/** §13.1: confirmation status (also triggers the lazy auto-confirm safety-net). */
export function getScorecardConfirmation(matchId: string): Promise<ScorecardConfirmationView> {
  return apiFetchPublic<ScorecardConfirmationView>(`/matches/${matchId}/confirmation`);
}

/** Whether the current user may confirm this scorecard (§13.1). */
export function getScorecardConfirmEligibility(
  matchId: string,
): Promise<ScorecardConfirmEligibilityView> {
  return apiFetch<ScorecardConfirmEligibilityView>(
    `/matches/${matchId}/confirm-scorecard/eligibility`,
  );
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

/** Whether the current user may award Man of the Match on a completed match (§13.3). */
export function getManOfMatchEligibility(matchId: string): Promise<ManOfMatchEligibilityView> {
  return apiFetch<ManOfMatchEligibilityView>(`/matches/${matchId}/man-of-the-match/eligibility`);
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
