/** Login screen copy — client validation and auth error messages (spec §3.2). */
export const LOGIN_MESSAGES = {
  mobileRequired: 'Mobile number is required',
  mobileInvalid: 'Enter a valid 10-digit mobile number',
  passwordRequired: 'Password is required',
  invalidCredentials: 'Invalid mobile number or password',
  tooManyAttempts: 'Too many attempts. Please try again in a few minutes.',
  genericError: 'Something went wrong. Please try again.',
} as const;

/** Returns an error message, or undefined when the value is valid. */
export function validateLoginMobile(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return LOGIN_MESSAGES.mobileRequired;
  }
  if (!/^\d{10}$/.test(trimmed)) {
    return LOGIN_MESSAGES.mobileInvalid;
  }
  return undefined;
}

/** Returns an error message, or undefined when the value is valid. */
export function validateLoginPassword(value: string): string | undefined {
  if (!value) {
    return LOGIN_MESSAGES.passwordRequired;
  }
  return undefined;
}

/** Normalize a validated 10-digit local number for the api (+1 prefix). */
export function loginMobileForApi(tenDigits: string): string {
  return `+1${tenDigits.trim()}`;
}
