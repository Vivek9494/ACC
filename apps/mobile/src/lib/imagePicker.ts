import {
  SIGNUP_PROFILE_PHOTO_MAX_BYTES,
  SIGNUP_VALIDATION_MESSAGES,
  TOURNAMENT_FORM_MESSAGES,
  TOURNAMENT_POSTER_MAX_BYTES,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

/** Normalized image picked from the library — single source for preview, validation, and upload. */
export interface PickedImageFile {
  uri: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

/** Picked image plus remote URL after upload or when loaded from the server. */
export interface StoredImageFile extends PickedImageFile {
  remoteUrl: string | null;
}

export type PickImageResult =
  | { ok: true; file: PickedImageFile }
  | { ok: false; error: string };

const JPEG_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/pjpeg'] as const;

export interface PickImageOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  /** MIME types to accept (defaults to JPEG). Extension `.jpg`/`.jpeg` is also checked. */
  allowedMimeTypes?: readonly string[];
  maxSizeBytes?: number;
  typeErrorMessage: string;
  sizeErrorMessage: string;
}

export async function resolveImageFileSize(
  uri: string,
  reportedSize: number | null | undefined,
): Promise<number | null> {
  if (reportedSize != null && reportedSize > 0) {
    return reportedSize;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      return info.size;
    }
  } catch {
    // Fall through — caller or server may validate size on upload.
  }
  return null;
}

function hasJpegExtension(uriOrFileName: string): boolean {
  return /\.jpe?g(\?.*)?$/i.test(uriOrFileName);
}

export function isAllowedImageMime(
  mimeType: string | null | undefined,
  uriOrFileName: string | null | undefined,
  allowedMimeTypes: readonly string[] = JPEG_MIME_TYPES,
): boolean {
  if (mimeType && allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return true;
  }
  if (uriOrFileName && hasJpegExtension(uriOrFileName)) {
    return true;
  }
  return false;
}

/** Copy non-file URIs to cache so multipart upload can read them (Expo Go / iOS). */
export async function ensureUploadableUri(uri: string, destBasename: string): Promise<string> {
  if (uri.startsWith('file://')) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      return uri;
    }
  }

  const dest = `${FileSystem.cacheDirectory ?? ''}${destBasename}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export function isLocalImageUri(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  );
}

export function storedImageFromRemoteUrl(url: string): StoredImageFile {
  return {
    uri: url,
    name: null,
    mimeType: null,
    sizeBytes: null,
    remoteUrl: url,
  };
}

export function pickedToStored(file: PickedImageFile): StoredImageFile {
  return { ...file, remoteUrl: null };
}

function normalizeAsset(asset: ImagePicker.ImagePickerAsset): PickedImageFile | null {
  const uri = asset.uri?.trim();
  if (!uri) {
    return null;
  }
  return {
    uri,
    name: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    sizeBytes: asset.fileSize ?? null,
  };
}

async function validatePickedFile(
  file: PickedImageFile,
  options: PickImageOptions,
): Promise<PickImageResult> {
  const allowedMimeTypes = options.allowedMimeTypes ?? JPEG_MIME_TYPES;
  const maxSizeBytes = options.maxSizeBytes ?? SIGNUP_PROFILE_PHOTO_MAX_BYTES;
  const sizeBytes = await resolveImageFileSize(file.uri, file.sizeBytes);
  const normalized: PickedImageFile = { ...file, sizeBytes };

  if (!isAllowedImageMime(normalized.mimeType, normalized.name ?? normalized.uri, allowedMimeTypes)) {
    return { ok: false, error: options.typeErrorMessage };
  }
  if (sizeBytes != null && sizeBytes > maxSizeBytes) {
    return { ok: false, error: options.sizeErrorMessage };
  }
  return { ok: true, file: normalized };
}

/**
 * Launch the photo library, normalize assets[0], and validate type/size.
 * Returns null when the user cancels or denies permission.
 */
export async function pickImage(options: PickImageOptions): Promise<PickImageResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing ?? true,
    aspect: options.aspect,
    quality: options.quality ?? 0.85,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const file = normalizeAsset(result.assets[0]);
  if (!file) {
    return { ok: false, error: options.typeErrorMessage };
  }

  return validatePickedFile(file, options);
}

/** Tournament poster — JPEG, 16:9 crop, max 5MB. */
export function tournamentPosterPickOptions(): PickImageOptions {
  return {
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.9,
    maxSizeBytes: TOURNAMENT_POSTER_MAX_BYTES,
    typeErrorMessage: TOURNAMENT_FORM_MESSAGES.poster.type,
    sizeErrorMessage: TOURNAMENT_FORM_MESSAGES.poster.size,
  };
}

/** Profile photo — JPEG, square crop, max 5MB. */
export function profilePhotoPickOptions(): PickImageOptions {
  return {
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    maxSizeBytes: SIGNUP_PROFILE_PHOTO_MAX_BYTES,
    typeErrorMessage: SIGNUP_VALIDATION_MESSAGES.profilePhoto.type,
    sizeErrorMessage: SIGNUP_VALIDATION_MESSAGES.profilePhoto.size,
  };
}

/** Team logo — JPEG, square crop, max 5MB. */
export function teamLogoPickOptions(): PickImageOptions {
  return {
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
    maxSizeBytes: TOURNAMENT_POSTER_MAX_BYTES,
    typeErrorMessage: TOURNAMENT_FORM_MESSAGES.poster.type,
    sizeErrorMessage: TOURNAMENT_FORM_MESSAGES.poster.size,
  };
}

export function storedImageDebug(file: StoredImageFile | null): Record<string, unknown> {
  return {
    uri: file?.uri ?? null,
    remoteUrl: file?.remoteUrl ?? null,
    name: file?.name ?? null,
    mimeType: file?.mimeType ?? null,
    sizeBytes: file?.sizeBytes ?? null,
  };
}
