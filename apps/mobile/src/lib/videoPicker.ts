import {
  DEFAULT_VIDEO_UPLOAD_MAX_MB,
  isPlayerSkillVideoMimeType,
  mbToBytes,
  playerSkillVideoSizeError,
  playerSkillVideoTypeError,
  type PlayerSkillVideoMimeType,
  type UploadLimits,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  ensureMediaLibraryAccess,
  MEDIA_LIBRARY_PERMISSION_MESSAGE,
} from './media-library-permission';

export interface PickedVideoFile {
  uri: string;
  name: string | null;
  mimeType: PlayerSkillVideoMimeType;
  sizeBytes: number;
}

export type PickVideoResult =
  | { ok: true; file: PickedVideoFile }
  | { ok: false; error: string };

function extensionMime(uriOrName: string): PlayerSkillVideoMimeType | null {
  if (/\.mov(\?.*)?$/i.test(uriOrName)) {
    return 'video/quicktime';
  }
  if (/\.mp4(\?.*)?$/i.test(uriOrName)) {
    return 'video/mp4';
  }
  return null;
}

function resolveMimeType(
  mimeType: string | null | undefined,
  uriOrName: string,
): PlayerSkillVideoMimeType | null {
  if (mimeType && isPlayerSkillVideoMimeType(mimeType)) {
    return mimeType;
  }
  return extensionMime(uriOrName);
}

export async function resolveVideoFileSize(
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
    // Caller validates before upload.
  }
  return null;
}

export async function pickVideoFromLibrary(
  limits?: Pick<UploadLimits, 'videoUploadMaxMb'>,
): Promise<PickVideoResult> {
  if (!(await ensureMediaLibraryAccess())) {
    return { ok: false, error: MEDIA_LIBRARY_PERMISSION_MESSAGE };
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[pickVideoFromLibrary] launchImageLibraryAsync failed', error);
    }
    return { ok: false, error: 'Could not open the photo library. Please try again.' };
  }

  if (result.canceled || !result.assets[0]) {
    return { ok: false, error: 'Selection cancelled.' };
  }

  const asset = result.assets[0];
  const mimeType = resolveMimeType(asset.mimeType ?? null, asset.uri);
  if (!mimeType) {
    return { ok: false, error: playerSkillVideoTypeError() };
  }

  const maxMb = limits?.videoUploadMaxMb ?? DEFAULT_VIDEO_UPLOAD_MAX_MB;
  const maxBytes = mbToBytes(maxMb);

  const sizeBytes = await resolveVideoFileSize(asset.uri, asset.fileSize ?? null);
  if (sizeBytes == null) {
    return { ok: false, error: 'Could not read the selected video file size.' };
  }
  if (sizeBytes > maxBytes) {
    return { ok: false, error: playerSkillVideoSizeError(maxMb) };
  }

  return {
    ok: true,
    file: {
      uri: asset.uri,
      name: asset.fileName ?? null,
      mimeType,
      sizeBytes,
    },
  };
}
