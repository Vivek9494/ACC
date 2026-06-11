/** Redis keys for profile mobile-number change OTP (separate from password reset). */
export const profileMobileOtpCodeKey = (userId: string): string =>
  `otp:profile-mobile:code:${userId}`;

export const profileMobileOtpPendingKey = (userId: string): string =>
  `otp:profile-mobile:pending:${userId}`;

export const profileMobileOtpRequestKey = (userId: string): string =>
  `otp:profile-mobile:requests:${userId}`;

export const profileMobileOtpFailedKey = (userId: string): string =>
  `otp:profile-mobile:failed:${userId}`;
