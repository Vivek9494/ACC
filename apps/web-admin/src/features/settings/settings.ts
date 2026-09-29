import {
  APP_SETTINGS_VALIDATION_MESSAGES,
  CHANGE_PASSWORD_MESSAGES,
  PASSWORD_POLICY_INVALID_MESSAGE,
  isMaskedAwsKeyValue,
  isPasswordPolicyCompliant,
  isValidAwsSecretAccessKey,
  isValidGoogleMapsApiKey,
  isValidImageUploadMaxMb,
  isValidVideoUploadMaxMb,
  normalizeAwsSecretAccessKey,
  normalizeGoogleMapsApiKey,
  type AdminAppSettings,
  type UpdateAdminAppSettingsRequest,
} from '@acc/types';

export interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordErrors = Partial<Record<keyof ChangePasswordValues, string>>;

export const EMPTY_CHANGE_PASSWORD: ChangePasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export const PASSWORD_CHANGED_NOTICE = 'Password changed. Sign in with your new password.';

/** Same checks as the mobile Change Password screen; the API re-validates. */
export function validateChangePassword(values: ChangePasswordValues): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!values.currentPassword) errors.currentPassword = CHANGE_PASSWORD_MESSAGES.currentRequired;
  if (!values.newPassword) errors.newPassword = 'New password is required';
  else if (!isPasswordPolicyCompliant(values.newPassword))
    errors.newPassword = PASSWORD_POLICY_INVALID_MESSAGE;
  else if (values.newPassword === values.currentPassword)
    errors.newPassword = CHANGE_PASSWORD_MESSAGES.sameAsCurrent;
  if (values.confirmPassword !== values.newPassword)
    errors.confirmPassword = CHANGE_PASSWORD_MESSAGES.confirmMismatch;
  return errors;
}

/** Form strings for the System settings card (mirrors the mobile Settings screen fields). */
export interface SystemSettingsValues {
  videoUploadMaxMb: string;
  imageUploadMaxMb: string;
  googleMapsApiKey: string;
  /** Masked placeholder keeps the stored key; anything else replaces it. */
  awsKey: string;
}

export type SystemSettingsErrors = Partial<Record<keyof SystemSettingsValues, string>>;

export function systemSettingsValues(settings: AdminAppSettings): SystemSettingsValues {
  return {
    videoUploadMaxMb: String(settings.videoUploadMaxMb),
    imageUploadMaxMb: String(settings.imageUploadMaxMb),
    googleMapsApiKey: settings.googleMapsApiKey,
    awsKey: settings.awsKeyMasked ?? '',
  };
}

/** True when the AWS field holds a new secret (not blank, not the masked placeholder). */
export function isAwsKeyChanged(awsKey: string): boolean {
  return awsKey.trim().length > 0 && !isMaskedAwsKeyValue(awsKey);
}

function parseWholeMb(raw: string): number {
  return /^\d+$/.test(raw.trim()) ? Number.parseInt(raw.trim(), 10) : Number.NaN;
}

export function validateSystemSettings(values: SystemSettingsValues): SystemSettingsErrors {
  const errors: SystemSettingsErrors = {};
  const messages = APP_SETTINGS_VALIDATION_MESSAGES;
  if (!values.videoUploadMaxMb.trim()) errors.videoUploadMaxMb = messages.videoUploadMaxMb.required;
  else if (!isValidVideoUploadMaxMb(parseWholeMb(values.videoUploadMaxMb))) {
    errors.videoUploadMaxMb = messages.videoUploadMaxMb.invalid;
  }
  if (!values.imageUploadMaxMb.trim()) errors.imageUploadMaxMb = messages.imageUploadMaxMb.required;
  else if (!isValidImageUploadMaxMb(parseWholeMb(values.imageUploadMaxMb))) {
    errors.imageUploadMaxMb = messages.imageUploadMaxMb.invalid;
  }
  if (!values.googleMapsApiKey.trim()) errors.googleMapsApiKey = messages.googleMapsApiKey.required;
  else if (!isValidGoogleMapsApiKey(values.googleMapsApiKey)) {
    errors.googleMapsApiKey = messages.googleMapsApiKey.invalid;
  }
  if (isAwsKeyChanged(values.awsKey) && !isValidAwsSecretAccessKey(values.awsKey)) {
    errors.awsKey = messages.awsKey.invalid;
  }
  return errors;
}

/** Call only after {@link validateSystemSettings} passes. */
export function toUpdateSettingsRequest(
  values: SystemSettingsValues,
): UpdateAdminAppSettingsRequest {
  return {
    videoUploadMaxMb: parseWholeMb(values.videoUploadMaxMb),
    imageUploadMaxMb: parseWholeMb(values.imageUploadMaxMb),
    googleMapsApiKey: normalizeGoogleMapsApiKey(values.googleMapsApiKey),
    ...(isAwsKeyChanged(values.awsKey)
      ? { awsKey: normalizeAwsSecretAccessKey(values.awsKey) }
      : {}),
  };
}

export function isSystemSettingsDirty(
  values: SystemSettingsValues,
  saved: SystemSettingsValues,
): boolean {
  return (
    values.videoUploadMaxMb.trim() !== saved.videoUploadMaxMb ||
    values.imageUploadMaxMb.trim() !== saved.imageUploadMaxMb ||
    values.googleMapsApiKey.trim() !== saved.googleMapsApiKey ||
    isAwsKeyChanged(values.awsKey)
  );
}
