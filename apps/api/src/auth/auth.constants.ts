/** bcrypt cost factor for password hashing. */
export const BCRYPT_SALT_ROUNDS = 12;

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Embedded tokenVersion; must match the DB for the token to be valid. */
  tokenVersion: number;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  /** Unique token id; the active one is tracked in Redis for idle expiry. */
  jti: string;
  type: 'refresh';
}

/** Redis key for the failed-login counter of a given mobile number. */
export const loginAttemptsKey = (mobileNumber: string): string =>
  `login:attempts:${mobileNumber}`;

/** Redis key holding the active refresh token id for a user (single device). */
export const refreshKey = (userId: string): string => `refresh:${userId}`;

/** Redis key holding the current password-reset OTP for a mobile number. */
export const otpCodeKey = (mobileNumber: string): string => `otp:code:${mobileNumber}`;

/** Redis key counting OTP send requests within the daily window. */
export const otpRequestCountKey = (mobileNumber: string): string => `otp:requests:${mobileNumber}`;

/** Redis key counting failed OTP entries (drives the reset lockout). */
export const otpFailedCountKey = (mobileNumber: string): string => `otp:failed:${mobileNumber}`;
