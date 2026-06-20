import {
  isPlayerSkillVideoMimeType,
  PLAYER_SKILL_VIDEO_MAX_BYTES,
  playerSkillVideoSizeError,
  playerSkillVideoTypeError,
  type PlayerSkillVideoMimeType,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

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

export async function pickVideoFromLibrary(): Promise<PickVideoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, error: 'Photo library access is required to select a video.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return { ok: false, error: 'Selection cancelled.' };
  }

  const asset = result.assets[0];
  const mimeType = resolveMimeType(asset.mimeType ?? null, asset.uri);
  if (!mimeType) {
    return { ok: false, error: playerSkillVideoTypeError() };
  }

  const sizeBytes = await resolveVideoFileSize(asset.uri, asset.fileSize ?? null);
  if (sizeBytes == null) {
    return { ok: false, error: 'Could not read the selected video file size.' };
  }
  if (sizeBytes > PLAYER_SKILL_VIDEO_MAX_BYTES) {
    return { ok: false, error: playerSkillVideoSizeError() };
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
