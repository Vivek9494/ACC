import type { RegistrationSummary } from '@acc/types';
import { createContext, useContext } from 'react';

import type { RatingDraft, RatingKey } from './registrations';

/**
 * Confirmed rows edit ratings in place (Edit → inputs + Update). Provided via context rather than
 * column defs: rebuilding columns on every keystroke would remount the inputs and drop focus.
 */
export interface InlineRatingEdit {
  editingId: string | null;
  draft: RatingDraft;
  invalidField: RatingKey | null;
  saving: boolean;
  onStart: (row: RegistrationSummary) => void;
  onChange: (key: RatingKey, value: string) => void;
  onUpdate: (row: RegistrationSummary) => void;
  onCancel: () => void;
}

export const InlineRatingEditContext = createContext<InlineRatingEdit | null>(null);

export const useInlineRatingEdit = (): InlineRatingEdit | null =>
  useContext(InlineRatingEditContext);
