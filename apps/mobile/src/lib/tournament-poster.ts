import { TOURNAMENT_POSTER_MAX_BYTES } from '@acc/types';

import {
  ensureUploadableUri,
  type PickedImageFile,
  pickedToStored,
  storedImageDebug,
  type StoredImageFile,
} from './imagePicker';

/** Tournament poster — preview, validation, and upload share this object. */
export type TournamentPosterSelection = StoredImageFile;

export function hasTournamentPoster(
  poster: TournamentPosterSelection | null,
): poster is TournamentPosterSelection {
  return Boolean(poster?.uri);
}

export function posterFromPickedFile(file: PickedImageFile): TournamentPosterSelection {
  return pickedToStored(file);
}

export async function ensureUploadablePosterUri(uri: string): Promise<string> {
  return ensureUploadableUri(uri, 'tournament-poster');
}

export function posterSelectionDebug(poster: TournamentPosterSelection | null): Record<string, unknown> {
  return {
    ...storedImageDebug(poster),
    maxBytes: TOURNAMENT_POSTER_MAX_BYTES,
  };
}
