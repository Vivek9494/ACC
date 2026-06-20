import { AuthErrorCode } from '@acc/types';

import { ApiRequestError } from './api';

export const PASSWORD_RESET_MESSAGES = {
  mobileRequired: 'Mobile number is required',
  mobileInvalid: 'Enter a valid 10-digit mobile number',
  otpRequired: 'Enter the 4-digit code',
  otpInvalid: 'Invalid or expired code',
  otpAttemptsExceeded: 'Too many incorrect attempts. Please request a new code.',
  resendCooldown: 'Please wait before requesting another code.',
  resendFailed: 'Could not resend the code. Please try again.',
  verifyFailed: 'Could not verify the code. Please try again.',
  resetTokenMissing: 'Missing verification details. Please restart the reset flow.',
  genericError: 'Something went wrong. Please try again.',
  locked: 'Account is locked from password reset. Contact an administrator.',
} as const;

export function mapPasswordResetApiError(err: unknown): string {
  if (!(err instanceof ApiRequestError)) {
    return PASSWORD_RESET_MESSAGES.genericError;
  }
  switch (err.error.code) {
    case AuthErrorCode.OtpInvalid:
      return PASSWORD_RESET_MESSAGES.otpInvalid;
    case AuthErrorCode.OtpAttemptsExceeded:
      return PASSWORD_RESET_MESSAGES.otpAttemptsExceeded;
    case AuthErrorCode.OtpResendCooldown:
      return PASSWORD_RESET_MESSAGES.resendCooldown;
    case AuthErrorCode.OtpRequestLimit:
      return err.message;
    case AuthErrorCode.PasswordResetLocked:
      return PASSWORD_RESET_MESSAGES.locked;
    case AuthErrorCode.ResetTokenInvalid:
      return err.message;
    default:
      return err.message || PASSWORD_RESET_MESSAGES.genericError;
  }
}
