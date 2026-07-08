/**
 * Authentication contracts shared between the api and mobile apps (spec §3).
 *
 * These are the single source of truth for the signup/login request and
 * response shapes, plus the policy constants the backend enforces and the
 * mobile app surfaces in its UI/validation.
 */

/** Password policy — security mitigation override of the 6-char default (§31). */
export { PASSWORD_MIN_LENGTH } from './password-policy';

/** Minimum age to register, derived from `dateOfBirth` (§3.1). */
export const MIN_SIGNUP_AGE = 18;

/** A refresh token unused for this many days is treated as expired (§3.2). */
export const REFRESH_IDLE_DAYS = 10;

/** Forgot-password OTP policy (§3.3, §3.4). */
export const OTP_LENGTH = 4;
export const OTP_TTL_SECONDS = 5 * 60;
/** Minimum wait between OTP resend requests for the same number. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Short-lived token issued after OTP verification; authorizes set-new-password. */
export const RESET_TOKEN_TTL_SECONDS = 10 * 60;
/** Max OTP send requests per phone per day. */
export const OTP_MAX_REQUESTS_PER_DAY = 5;
/** Failed OTP entries before the active code is invalidated (user must resend). */
export const OTP_MAX_FAILED_ATTEMPTS = 5;

/** Rate limits for forgot-password send + verify (per client IP). */
export const OTP_IP_RATE_LIMIT = {
  maxAttempts: 30,
  windowSeconds: 15 * 60,
} as const;

/** Default lifetime of an admin-generated temporary password (hours). */
export const TEMP_PASSWORD_TTL_HOURS = 72;

/** Shown when a user tries to log in with an expired temporary password. */
export const TEMP_PASSWORD_EXPIRED_MESSAGE =
  'This temporary password has expired. Ask your admin for a new one.';

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
  EmailExists: 'EMAIL_EXISTS',
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
  /** Too many wrong OTP attempts — the code was invalidated; request a new one. */
  OtpAttemptsExceeded: 'OTP_ATTEMPTS_EXCEEDED',
  /** Resend cooldown has not elapsed yet. */
  OtpResendCooldown: 'OTP_RESEND_COOLDOWN',
  /** Reset token is invalid or expired. */
  ResetTokenInvalid: 'RESET_TOKEN_INVALID',
  /** Account is locked from password reset after too many failed OTP entries. */
  PasswordResetLocked: 'PASSWORD_RESET_LOCKED',
  /** Caller lacks the role required for this action. */
  Forbidden: 'FORBIDDEN',
  /** Authenticated change-password: current password did not match. */
  CurrentPasswordIncorrect: 'CURRENT_PASSWORD_INCORRECT',
  /** New password equals the current password. */
  SamePassword: 'SAME_PASSWORD',
  /** Profile mobile change requires OTP verification of the new number. */
  MobileChangeOtpRequired: 'MOBILE_CHANGE_OTP_REQUIRED',
  /** Admin-issued temporary password has passed its expiry window. */
  TempPasswordExpired: 'TEMP_PASSWORD_EXPIRED',
  /** Account must complete a forced password change before other access. */
  MustChangePassword: 'MUST_CHANGE_PASSWORD',
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
export const EMAIL_EXISTS_MESSAGE = 'Email address already exists';

/** Signup payload — all §3.1 fields (`profilePhotoUrl` is optional). */
export interface SignupRequest {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  /** Optional; omitted or empty when not provided. */
  email?: string;
  /** ISO 8601 date (YYYY-MM-DD). Stored in UTC. */
  dateOfBirth: string;
  /** Optional street address (product extension; not in spec §3.1). */
  address?: string;
  /** Optional Canadian postal code (A1A 1A1). Normalized on save. */
  postalCode?: string;
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

export interface VerifyResetOtpRequest {
  mobileNumber: string;
  otp: string;
}

export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: true;
}

/** Set a new password after logging in with an admin temporary password. */
export interface CompleteForcedPasswordChangeRequest {
  newPassword: string;
}

export interface CompleteForcedPasswordChangeResponse {
  success: true;
}

export interface UnlockAccountRequest {
  userId: string;
}

/** Pair of tokens issued on signup/login and rotated on refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Scoped Captain / Vice-Captain / Manager team leadership (from RoleAssignment). */
export interface TeamLeadAssignment {
  role: typeof UserRole.Captain | typeof UserRole.ViceCaptain | typeof UserRole.Manager;
  tournamentId: string;
  teamId: string;
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
  /** Present on login/me responses; empty when the user leads no team. */
  teamLeadAssignments?: TeamLeadAssignment[];
  /** Center ids where the user holds a scoped Center Sevak assignment. */
  centerSevakCenterIds?: string[];
  /** Present and true when the user must set a new password before other access. */
  mustChangePassword?: boolean;
}

/** Response body for signup and login. */
export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
