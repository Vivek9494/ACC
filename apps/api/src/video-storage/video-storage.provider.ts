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

/**
 * Provider-agnostic object storage for player skill videos.
 * Swap implementations (S3, GCS, R2, Supabase, MinIO dev stub) via config only.
 */
export interface VideoStorageProvider {
  /** Issue a presigned PUT URL (or equivalent) for direct client upload. */
  getUploadTarget(params: VideoUploadTargetParams): Promise<VideoUploadTarget>;

  /** Confirm the object exists and matches declared size/type before recording metadata. */
  verifyUploadedObject(params: VideoVerifyParams): Promise<void>;

  /** Resolve a playback URL for the stored object key. */
  getPlaybackUrl(storageKey: string): string;

  /** Remove a stored object (used when replacing an existing skill video). */
  deleteObject(storageKey: string): Promise<void>;
}

export const VIDEO_STORAGE_PROVIDER = Symbol('VIDEO_STORAGE_PROVIDER');
