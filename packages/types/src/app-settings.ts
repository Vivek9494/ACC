/** Stable keys for rows in the app settings store. */
export const AppSettingKey = {
  VideoUploadMaxMb: 'VIDEO_UPLOAD_MAX_MB',
  ImageUploadMaxMb: 'IMAGE_UPLOAD_MAX_MB',
  GoogleMapsApiKey: 'GOOGLE_MAPS_API_KEY',
  AwsSecretAccessKey: 'AWS_SECRET_ACCESS_KEY',
} as const;

export type AppSettingKey = (typeof AppSettingKey)[keyof typeof AppSettingKey];

/** Fallback when a setting row is unset — matches prior hardcoded limits. */
export const DEFAULT_VIDEO_UPLOAD_MAX_MB = 100;
export const DEFAULT_IMAGE_UPLOAD_MAX_MB = 5;

export const VIDEO_UPLOAD_MAX_MB_MIN = 1;
export const VIDEO_UPLOAD_MAX_MB_MAX = 500;
export const IMAGE_UPLOAD_MAX_MB_MIN = 1;
export const IMAGE_UPLOAD_MAX_MB_MAX = 50;

/** @deprecated Use {@link DEFAULT_VIDEO_UPLOAD_MAX_MB} via settings at runtime. */
export const LEGACY_PLAYER_SKILL_VIDEO_MAX_BYTES = DEFAULT_VIDEO_UPLOAD_MAX_MB * 1024 * 1024;

/** @deprecated Use {@link DEFAULT_IMAGE_UPLOAD_MAX_MB} via settings at runtime. */
export const LEGACY_SIGNUP_PROFILE_PHOTO_MAX_BYTES = DEFAULT_IMAGE_UPLOAD_MAX_MB * 1024 * 1024;

/** Public upload limits (GET /settings/upload-limits). */
export interface UploadLimits {
  videoUploadMaxMb: number;
  imageUploadMaxMb: number;
}

/** Admin settings view (GET /admin/settings). */
export interface AdminAppSettings extends UploadLimits {
  /** Effective server-side key (database value, or env fallback when unset). */
  googleMapsApiKey: string;
  /** True when an effective AWS secret access key exists (database or env). */
  awsKeyConfigured: boolean;
  /** Masked AWS secret access key for admin display — never the full value. */
  awsKeyMasked: string | null;
}

/** Admin settings update (PATCH /admin/settings). */
export interface UpdateAdminAppSettingsRequest extends UploadLimits {
  googleMapsApiKey: string;
  /** Empty or masked placeholder keeps the stored key; a new value replaces it. */
  awsKey?: string;
}

export const APP_SETTINGS_VALIDATION_MESSAGES = {
  videoUploadMaxMb: {
    required: 'Video upload size is required',
    invalid: `Enter a whole number between ${VIDEO_UPLOAD_MAX_MB_MIN} and ${VIDEO_UPLOAD_MAX_MB_MAX} MB`,
  },
  imageUploadMaxMb: {
    required: 'Image upload size is required',
    invalid: `Enter a whole number between ${IMAGE_UPLOAD_MAX_MB_MIN} and ${IMAGE_UPLOAD_MAX_MB_MAX} MB`,
  },
  googleMapsApiKey: {
    required: 'Google Maps API key is required',
    invalid: 'Enter a valid Google Maps API key',
  },
  awsKey: {
    invalid: 'Enter a valid AWS secret access key',
  },
} as const;

/** Mask prefix shown when an AWS secret is configured (last four chars appended). */
export const AWS_KEY_MASK_PREFIX = '••••••••';

export const AWS_SECRET_ACCESS_KEY_MIN_LENGTH = 8;

export function normalizeAwsSecretAccessKey(raw: string): string {
  return raw.trim();
}

export function isValidAwsSecretAccessKey(raw: string): boolean {
  const key = normalizeAwsSecretAccessKey(raw);
  return key.length >= AWS_SECRET_ACCESS_KEY_MIN_LENGTH;
}

export function maskAwsSecretAccessKey(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) {
    return `${AWS_KEY_MASK_PREFIX}••••`;
  }
  return `${AWS_KEY_MASK_PREFIX}${trimmed.slice(-4)}`;
}

/** True when the admin UI is still showing the masked placeholder (unchanged). */
export function isMaskedAwsKeyValue(raw: string): boolean {
  return raw.trim().startsWith(AWS_KEY_MASK_PREFIX);
}

/** Trim and fix common copy/paste typo (extra leading character before AIzaSy). */
export function normalizeGoogleMapsApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('yAIzaSy')) {
    return trimmed.slice(1);
  }
  return trimmed;
}

export function isValidGoogleMapsApiKey(raw: string): boolean {
  const key = normalizeGoogleMapsApiKey(raw);
  return key.length > 0;
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function isValidVideoUploadMaxMb(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= VIDEO_UPLOAD_MAX_MB_MIN &&
    value <= VIDEO_UPLOAD_MAX_MB_MAX
  );
}

export function isValidImageUploadMaxMb(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= IMAGE_UPLOAD_MAX_MB_MIN &&
    value <= IMAGE_UPLOAD_MAX_MB_MAX
  );
}

export function playerSkillVideoSizeError(maxMb: number = DEFAULT_VIDEO_UPLOAD_MAX_MB): string {
  return `Video must be no larger than ${maxMb}MB`;
}

export function profilePhotoSizeError(maxMb: number = DEFAULT_IMAGE_UPLOAD_MAX_MB): string {
  return `Profile photo must be no larger than ${maxMb}MB`;
}

export function defaultUploadLimits(): UploadLimits {
  return {
    videoUploadMaxMb: DEFAULT_VIDEO_UPLOAD_MAX_MB,
    imageUploadMaxMb: DEFAULT_IMAGE_UPLOAD_MAX_MB,
  };
}
