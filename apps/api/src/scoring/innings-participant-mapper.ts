import type { Innings } from '@prisma/client';

import type { InningsContext } from './engine/types';

type InningsParticipantRow = Pick<
  Innings,
  | 'selectedStrikerUserId'
  | 'selectedStrikerExternalId'
  | 'selectedNonStrikerUserId'
  | 'selectedNonStrikerExternalId'
  | 'selectedBowlerUserId'
  | 'selectedBowlerExternalId'
>;

/** Collapses persisted innings participant columns into opaque ids for the engine fold. */
export function selectedParticipantContext(
  inn: InningsParticipantRow,
): Pick<InningsContext, 'selectedStrikerId' | 'selectedNonStrikerId' | 'selectedBowlerId'> {
  return {
    selectedStrikerId: inn.selectedStrikerUserId ?? inn.selectedStrikerExternalId ?? null,
    selectedNonStrikerId: inn.selectedNonStrikerUserId ?? inn.selectedNonStrikerExternalId ?? null,
    selectedBowlerId: inn.selectedBowlerUserId ?? inn.selectedBowlerExternalId ?? null,
  };
}
