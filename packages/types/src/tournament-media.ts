/** Tournament poster upload limits (Add Tournament form — JPEG/PNG, unlike profile JPG-only). */
export const TOURNAMENT_POSTER_MAX_BYTES = 5 * 1024 * 1024;

const POSTER_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export function isAllowedTournamentPosterMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  return POSTER_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isAllowedTournamentPosterSize(fileSize: number | null | undefined): boolean {
  return (fileSize ?? 0) > 0 && (fileSize ?? 0) <= TOURNAMENT_POSTER_MAX_BYTES;
}

export interface UploadTournamentPosterResponse {
  posterUrl: string;
}
