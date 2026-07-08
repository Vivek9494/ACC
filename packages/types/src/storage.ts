/** Shared media upload contracts (presigned S3 PUT). */

export const IMAGE_UPLOAD_MIME_TYPE = 'image/jpeg' as const;
export type ImageUploadMimeType = typeof IMAGE_UPLOAD_MIME_TYPE;

export const MediaUploadPurpose = {
  ProfilePhoto: 'profile-photo',
  TournamentPoster: 'tournament-poster',
  TeamLogo: 'team-logo',
  BroadcastImage: 'broadcast-image',
} as const;

export type MediaUploadPurpose =
  (typeof MediaUploadPurpose)[keyof typeof MediaUploadPurpose];

export interface MediaUploadSessionRequest {
  mimeType: ImageUploadMimeType;
  sizeBytes: number;
}

export interface MediaUploadSessionResponse {
  uploadMethod: 'PUT';
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
}

export interface MediaUploadCompleteRequest {
  storageKey: string;
  mimeType: ImageUploadMimeType;
  sizeBytes: number;
}

/** storageKey is persisted on the record; displayUrl is a short-lived presigned read URL. */
export interface MediaUploadCompleteResponse {
  storageKey: string;
  displayUrl: string;
}

export function buildProfilePhotoStorageKey(userId: string): string {
  return `profile-photos/${userId}/${Date.now()}.jpg`;
}

export function buildTournamentPosterStorageKey(userId: string): string {
  return `posters/${userId}/${Date.now()}.jpg`;
}

export function buildTeamLogoStorageKey(userId: string): string {
  return `team-logos/${userId}/${Date.now()}.jpg`;
}

export function buildBroadcastImageStorageKey(userId: string): string {
  return `broadcasts/${userId}/${Date.now()}.jpg`;
}

export function isImageUploadMimeType(value: string): value is ImageUploadMimeType {
  return value === IMAGE_UPLOAD_MIME_TYPE;
}

const MEDIA_STORAGE_KEY_PREFIXES = [
  'profile-photos/',
  'posters/',
  'team-logos/',
  'broadcasts/',
  'skill-videos/',
] as const;

/** True when the value is an S3 object key (not a URL). */
export function isMediaStorageKey(value: string): boolean {
  const trimmed = value.trim();
  return MEDIA_STORAGE_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}
