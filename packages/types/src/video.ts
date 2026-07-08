/** Player skill video constraints (§19 scouting / auction). */
import {
  DEFAULT_VIDEO_UPLOAD_MAX_MB,
  LEGACY_PLAYER_SKILL_VIDEO_MAX_BYTES,
  playerSkillVideoSizeError as skillVideoSizeError,
} from './app-settings';

export const PLAYER_SKILL_VIDEO_MAX_BYTES = LEGACY_PLAYER_SKILL_VIDEO_MAX_BYTES;

/** @deprecated Use settings-backed limits; kept for legacy imports. */
export const PLAYER_VIDEO_MAX_BYTES = DEFAULT_VIDEO_UPLOAD_MAX_MB * 1024 * 1024;

export const PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const;

/** @deprecated Use {@link PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES}. */
export const PLAYER_VIDEO_ACCEPTED_MIME_TYPES = PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES;

export type PlayerSkillVideoMimeType = (typeof PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)[number];

/** @deprecated Use {@link PlayerSkillVideoMimeType}. */
export type PlayerVideoMimeType = PlayerSkillVideoMimeType;

export const PlayerSkillVideoStatus = {
  Ready: 'READY',
} as const;

export type PlayerSkillVideoStatus =
  (typeof PlayerSkillVideoStatus)[keyof typeof PlayerSkillVideoStatus];

export const PLAYER_SKILL_VIDEO_MIME_LABELS: Record<PlayerSkillVideoMimeType, string> = {
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
};

/** @deprecated Use {@link PLAYER_SKILL_VIDEO_MIME_LABELS}. */
export const PLAYER_VIDEO_MIME_LABELS = PLAYER_SKILL_VIDEO_MIME_LABELS;

/** One scouting skill video per player per tournament. */
export interface PlayerSkillVideoSummary {
  id: string;
  tournamentId: string;
  userId: string;
  playbackUrl: string;
  mimeType: string;
  sizeBytes: number;
  status: PlayerSkillVideoStatus;
  uploadedAt: string;
}

/** @deprecated Use {@link PlayerSkillVideoSummary}. */
export type PlayerVideoSummary = PlayerSkillVideoSummary;

/** Direct-to-storage upload target (presigned PUT). */
export interface SkillVideoUploadTarget {
  uploadMethod: 'PUT';
  uploadUrl: string;
  storageKey: string;
  playbackUrl: string;
  headers: Record<string, string>;
}

export interface PlayerSkillVideoUploadSessionRequest {
  mimeType: PlayerSkillVideoMimeType;
  sizeBytes: number;
}

/** @deprecated Use {@link PlayerSkillVideoUploadSessionRequest}. */
export type PlayerVideoUploadSessionRequest = PlayerSkillVideoUploadSessionRequest;

export interface PlayerSkillVideoUploadSessionResponse {
  uploadMethod: 'PUT';
  uploadUrl: string;
  storageKey: string;
  playbackUrl: string;
  headers: Record<string, string>;
}

/** @deprecated Use {@link PlayerSkillVideoUploadSessionResponse}. */
export type PlayerVideoUploadSessionResponse = PlayerSkillVideoUploadSessionResponse;

export interface PlayerSkillVideoCompleteUploadRequest {
  storageKey: string;
  mimeType: PlayerSkillVideoMimeType;
  sizeBytes: number;
}

/** @deprecated Use {@link PlayerSkillVideoCompleteUploadRequest}. */
export type PlayerVideoCompleteUploadRequest = PlayerSkillVideoCompleteUploadRequest;

/** @deprecated Use {@link skillVideoSizeError} from app-settings (`playerSkillVideoSizeError`). */
export function playerVideoSizeError(maxMb?: number): string {
  return skillVideoSizeError(maxMb);
}

export function playerSkillVideoTypeError(): string {
  return 'Video must be MP4 or MOV format';
}

/** @deprecated Use {@link playerSkillVideoTypeError}. */
export const playerVideoTypeError = playerSkillVideoTypeError;

export function isPlayerSkillVideoMimeType(value: string): value is PlayerSkillVideoMimeType {
  return (PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES as readonly string[]).includes(value);
}

/** @deprecated Use {@link isPlayerSkillVideoMimeType}. */
export const isPlayerVideoMimeType = isPlayerSkillVideoMimeType;

export function formatPlayerSkillVideoSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** @deprecated Use {@link formatPlayerSkillVideoSize}. */
export const formatPlayerVideoSize = formatPlayerSkillVideoSize;

/** Scouting playback URL for a player's tournament skill video. */
export interface PlayerSkillVideoPlaybackView {
  skillVideoId: string;
  playbackUrl: string;
  mimeType: string;
  status: PlayerSkillVideoStatus;
}

export function buildPlayerSkillVideoStorageKey(
  tournamentId: string,
  userId: string,
  mimeType: PlayerSkillVideoMimeType,
): string {
  const ext = mimeType === 'video/quicktime' ? 'mov' : 'mp4';
  return `skill-videos/${tournamentId}/${userId}/${Date.now()}.${ext}`;
}
