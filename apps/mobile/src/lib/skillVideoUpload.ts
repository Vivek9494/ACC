import type {
  PlayerSkillVideoCompleteUploadRequest,
  PlayerSkillVideoSummary,
  PlayerSkillVideoUploadSessionRequest,
  PlayerSkillVideoUploadSessionResponse,
} from '@acc/types';
import * as FileSystem from 'expo-file-system/legacy';

import {
  completePlayerSkillVideoUpload,
  createPlayerSkillVideoUploadSession,
} from './api';

export interface SkillVideoUploadProgress {
  sent: number;
  total: number;
  fraction: number;
}

export async function uploadPlayerSkillVideoFile(
  tournamentId: string,
  file: { uri: string; mimeType: PlayerSkillVideoUploadSessionRequest['mimeType']; sizeBytes: number },
  onProgress?: (progress: SkillVideoUploadProgress) => void,
): Promise<PlayerSkillVideoSummary> {
  const session = await createPlayerSkillVideoUploadSession(tournamentId, {
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });

  await uploadViaPresignedPut(session, file, onProgress);

  return completePlayerSkillVideoUpload(tournamentId, {
    storageKey: session.storageKey,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  } satisfies PlayerSkillVideoCompleteUploadRequest);
}

async function uploadViaPresignedPut(
  session: PlayerSkillVideoUploadSessionResponse,
  file: { uri: string; mimeType: string; sizeBytes: number },
  onProgress?: (progress: SkillVideoUploadProgress) => void,
): Promise<void> {
  const progressCallback = onProgress
    ? (data: FileSystem.UploadProgressData) => {
        const total = data.totalBytesExpectedToSend || file.sizeBytes;
        onProgress({
          sent: data.totalBytesSent,
          total,
          fraction: total > 0 ? data.totalBytesSent / total : 0,
        });
      }
    : undefined;

  const task = FileSystem.createUploadTask(
    session.uploadUrl,
    file.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': file.mimeType,
        ...session.headers,
      },
    },
    progressCallback,
  );

  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) {
    throw new Error('Video upload failed. Please try again.');
  }
}

/** @deprecated Use {@link uploadPlayerSkillVideoFile}. */
export const uploadPlayerVideoFile = uploadPlayerSkillVideoFile;
