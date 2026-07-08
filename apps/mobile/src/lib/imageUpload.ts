import type {
  MediaUploadCompleteRequest,
  MediaUploadCompleteResponse,
  MediaUploadSessionRequest,
  MediaUploadSessionResponse,
  UploadProfilePhotoResponse,
  UploadTeamLogoResponse,
  UploadTournamentPosterResponse,
} from '@acc/types';
import { IMAGE_UPLOAD_MIME_TYPE } from '@acc/types';

import { apiFetch } from './api';
import { uploadViaPresignedPut } from './presignedUpload';

async function createImageUploadSession(
  path: string,
  sizeBytes: number,
): Promise<MediaUploadSessionResponse> {
  const body: MediaUploadSessionRequest = {
    mimeType: IMAGE_UPLOAD_MIME_TYPE,
    sizeBytes,
  };
  return apiFetch<MediaUploadSessionResponse>(path, { method: 'POST', body });
}

async function uploadImageViaPresignedUrl(args: {
  sessionPath: string;
  completePath: string;
  localUri: string;
  sizeBytes: number;
}): Promise<MediaUploadCompleteResponse> {
  const session = await createImageUploadSession(args.sessionPath, args.sizeBytes);
  await uploadViaPresignedPut(
    session,
    { uri: args.localUri, mimeType: IMAGE_UPLOAD_MIME_TYPE, sizeBytes: args.sizeBytes },
  );
  const payload: MediaUploadCompleteRequest = {
    storageKey: session.storageKey,
    mimeType: IMAGE_UPLOAD_MIME_TYPE,
    sizeBytes: args.sizeBytes,
  };
  return apiFetch<MediaUploadCompleteResponse>(args.completePath, { method: 'POST', body: payload });
}

export async function uploadProfilePhoto(
  localUri: string,
  sizeBytes: number,
): Promise<UploadProfilePhotoResponse> {
  const session = await createImageUploadSession('/profile/photo/upload-session', sizeBytes);
  await uploadViaPresignedPut(
    session,
    { uri: localUri, mimeType: IMAGE_UPLOAD_MIME_TYPE, sizeBytes },
  );
  return apiFetch<UploadProfilePhotoResponse>('/profile/photo/complete', {
    method: 'POST',
    body: {
      storageKey: session.storageKey,
      mimeType: IMAGE_UPLOAD_MIME_TYPE,
      sizeBytes,
    },
  });
}

export async function uploadTournamentPoster(
  localUri: string,
  sizeBytes: number,
): Promise<UploadTournamentPosterResponse> {
  const session = await createImageUploadSession('/tournaments/poster/upload-session', sizeBytes);
  await uploadViaPresignedPut(
    session,
    { uri: localUri, mimeType: IMAGE_UPLOAD_MIME_TYPE, sizeBytes },
  );
  return apiFetch<UploadTournamentPosterResponse>('/tournaments/poster/complete', {
    method: 'POST',
    body: {
      storageKey: session.storageKey,
      mimeType: IMAGE_UPLOAD_MIME_TYPE,
      sizeBytes,
    },
  });
}

export async function uploadTeamLogo(
  localUri: string,
  sizeBytes: number,
): Promise<UploadTeamLogoResponse> {
  const session = await createImageUploadSession('/tournaments/team-logo/upload-session', sizeBytes);
  await uploadViaPresignedPut(
    session,
    { uri: localUri, mimeType: IMAGE_UPLOAD_MIME_TYPE, sizeBytes },
  );
  return apiFetch<UploadTeamLogoResponse>('/tournaments/team-logo/complete', {
    method: 'POST',
    body: {
      storageKey: session.storageKey,
      mimeType: IMAGE_UPLOAD_MIME_TYPE,
      sizeBytes,
    },
  });
}

export async function uploadBroadcastImage(
  localUri: string,
  sizeBytes: number,
): Promise<MediaUploadCompleteResponse> {
  return uploadImageViaPresignedUrl({
    sessionPath: '/admin/broadcast/image/upload-session',
    completePath: '/admin/broadcast/image/complete',
    localUri,
    sizeBytes,
  });
}
