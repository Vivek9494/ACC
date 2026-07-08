import type { PlayerSkillVideoMimeType } from '@acc/types';

/** Presigned direct-upload target — client PUTs the binary; API never proxies the body. */
export interface VideoUploadTarget {
  uploadMethod: 'PUT';
  uploadUrl: string;
  storageKey: string;
  playbackUrl: string;
  headers: Record<string, string>;
}

export interface VideoUploadTargetParams {
  storageKey: string;
  mimeType: PlayerSkillVideoMimeType;
  sizeBytes: number;
}

export interface VideoVerifyParams {
  storageKey: string;
  mimeType: PlayerSkillVideoMimeType;
  sizeBytes: number;
}

export interface VideoStorageProvider {
  getUploadTarget(params: VideoUploadTargetParams): Promise<VideoUploadTarget>;
  verifyUploadedObject(params: VideoVerifyParams): Promise<void>;
  getPlaybackUrl(storageKey: string): Promise<string>;
  deleteObject(storageKey: string): Promise<void>;
}

export const VIDEO_STORAGE_PROVIDER = Symbol('VIDEO_STORAGE_PROVIDER');
