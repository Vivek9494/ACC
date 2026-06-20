import type { BatsmanPickerRole } from '@acc/types';

export type IncomingCreaseSlot = 'striker' | 'nonStriker';

export type ScoringPickResult =
  | {
      kind: 'batsman';
      role: BatsmanPickerRole;
      userId: string;
      incomingSlot?: IncomingCreaseSlot;
    }
  | {
      kind: 'bowler';
      userId: string;
    };

let pendingPick: ScoringPickResult | null = null;

/** Stores a batsman or bowler selection before navigating back to the scoring screen. */
export function setScoringPickResult(result: ScoringPickResult): void {
  pendingPick = result;
}

/** Consumes and clears the pending pick (called when score screen regains focus). */
export function consumeScoringPickResult(): ScoringPickResult | null {
  const result = pendingPick;
  pendingPick = null;
  return result;
}
