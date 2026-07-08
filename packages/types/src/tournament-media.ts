import { TOURNAMENT_FORM_MESSAGES } from './tournament-validation';

/** Tournament poster upload limits (Add Tournament — JPG only, max 5MB). */
export const TOURNAMENT_POSTER_MAX_BYTES = 5 * 1024 * 1024;

const JPEG_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg']);

function hasJpegExtension(uriOrFileName: string): boolean {
  return /\.jpe?g(\?.*)?$/i.test(uriOrFileName);
}

export function isAllowedTournamentPosterMime(
  mimeType: string | null | undefined,
  uriOrFileName?: string | null,
): boolean {
  if (mimeType && JPEG_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }
  if (uriOrFileName && hasJpegExtension(uriOrFileName)) {
    return true;
  }
  return false;
}

export function isAllowedTournamentPosterSize(fileSize: number | null | undefined): boolean {
  if (fileSize == null) {
    return true;
  }
  return fileSize > 0 && fileSize <= TOURNAMENT_POSTER_MAX_BYTES;
}

/** Client pick validation — JPG/JPEG only; size when known (server re-checks on upload). */
export function validateTournamentPosterPick(
  mimeType: string | null | undefined,
  fileSize: number | null | undefined,
  uriOrFileName?: string | null,
): string | null {
  if (!isAllowedTournamentPosterMime(mimeType, uriOrFileName)) {
    return TOURNAMENT_FORM_MESSAGES.poster.type;
  }
  if (fileSize != null && fileSize > TOURNAMENT_POSTER_MAX_BYTES) {
    return TOURNAMENT_FORM_MESSAGES.poster.size;
  }
  return null;
}

export function tournamentPosterTypeError(): string {
  return TOURNAMENT_FORM_MESSAGES.poster.type;
}

export function tournamentPosterSizeError(): string {
  return TOURNAMENT_FORM_MESSAGES.poster.size;
}

export interface UploadTournamentPosterResponse {
  storageKey: string;
  /** Presigned read URL for immediate display. Persist storageKey as posterUrl. */
  posterUrl: string;
}
