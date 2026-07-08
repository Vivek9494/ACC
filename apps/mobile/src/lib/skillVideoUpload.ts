import type {
  PlayerSkillVideoCompleteUploadRequest,
  PlayerSkillVideoSummary,
  PlayerSkillVideoUploadSessionRequest,
} from '@acc/types';

import {
  completePlayerSkillVideoUpload,
  createPlayerSkillVideoUploadSession,
} from './api';
import { uploadViaPresignedPut } from './presignedUpload';

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

/** @deprecated Use {@link uploadPlayerSkillVideoFile}. */
export const uploadPlayerVideoFile = uploadPlayerSkillVideoFile;
