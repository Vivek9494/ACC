/**
 * Authentication contracts shared between the api and mobile apps (spec §3).
 *
 * These are the single source of truth for the signup/login request and
 * response shapes, plus the policy constants the backend enforces and the
 * mobile app surfaces in its UI/validation.
 */

/** Password policy — security mitigation override of the 6-char default (§31). */
export const PASSWORD_MIN_LENGTH = 8;

/** Minimum age to register, derived from `dateOfBirth` (§3.1). */
export const MIN_SIGNUP_AGE = 18;

/** A refresh token unused for this many days is treated as expired (§3.2). */
export const REFRESH_IDLE_DAYS = 10;

/** Forgot-password OTP policy (§3.3, §3.4). */
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
/** Max OTP send requests per phone per day. */
export const OTP_MAX_REQUESTS_PER_DAY = 5;
/** Failed OTP entries before the account is locked from password reset. */
export const OTP_MAX_FAILED_ATTEMPTS = 5;

/** Per-mobile-number login rate limit (§31 #6). */
export const LOGIN_RATE_LIMIT = {
  /** Max failed attempts allowed inside the window before lockout. */
  maxAttempts: 5,
  /** Sliding window length, in seconds. */
  windowSeconds: 15 * 60,
} as const;

/**
 * Stable, machine-readable error codes returned in the api error envelope so
 * the mobile client can branch on them without string-matching messages.
 */
export const AuthErrorCode = {
  MobileNumberExists: 'MOBILE_NUMBER_EXISTS',
  Underage: 'UNDERAGE',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  TooManyAttempts: 'TOO_MANY_LOGIN_ATTEMPTS',
  /** Access/refresh token's embedded tokenVersion no longer matches the DB. */
  TokenVersionMismatch: 'TOKEN_VERSION_MISMATCH',
  RefreshExpired: 'REFRESH_TOKEN_EXPIRED',
  InvalidCenter: 'INVALID_CENTER',
  /** Too many OTP send requests within the daily window. */
  OtpRequestLimit: 'OTP_REQUEST_LIMIT',
  /** Submitted OTP is wrong or no OTP exists/has expired. */
  OtpInvalid: 'OTP_INVALID',
  /** Account is locked from password reset after too many failed OTP entries. */
  PasswordResetLocked: 'PASSWORD_RESET_LOCKED',
  /** Caller lacks the role required for this action. */
  Forbidden: 'FORBIDDEN',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/**
 * First-class platform roles (spec §2). Scorer is a per-match grant and Guest
 * is unauthenticated, so neither is a stored role here.
 */
export const UserRole = {
  Admin: 'ADMIN',
  ClubManager: 'CLUB_MANAGER',
  CenterSevak: 'CENTER_SEVAK',
  Captain: 'CAPTAIN',
  ViceCaptain: 'VICE_CAPTAIN',
  Manager: 'MANAGER',
  Player: 'PLAYER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Exact message required by the spec for a duplicate mobile number (§3.1). */
export const MOBILE_NUMBER_EXISTS_MESSAGE = 'Mobile number already exists';

/** Signup payload — all §3.1 fields (`profilePhotoUrl` is optional). */
export interface SignupRequest {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  /** ISO 8601 date (YYYY-MM-DD). Stored in UTC. */
  dateOfBirth: string;
  centerId: string;
  /** Optional at signup; defaults to 0 when omitted. */
  jerseyNumber?: number;
  profilePhotoUrl?: string | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  password: string;
}

export interface LoginRequest {
  mobileNumber: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  mobileNumber: string;
}

export interface ResetPasswordRequest {
  mobileNumber: string;
  otp: string;
  newPassword: string;
}

export interface UnlockAccountRequest {
  userId: string;
}

/** Pair of tokens issued on signup/login and rotated on refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Public, non-sensitive projection of a user (never includes passwordHash). */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  centerId: string;
  jerseyNumber: number;
  profilePhotoUrl: string | null;
  role: UserRole;
  isActive: boolean;
}

/** Response body for signup and login. */
export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
