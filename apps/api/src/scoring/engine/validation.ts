import { DismissalType } from '@acc/types';

import { deriveInnings } from './fold';
import { nextBallPosition } from './position';
import type { ScoringEvent } from './types';

/** On a free hit, only run out is a valid dismissal (§12.1). */
export function isDismissalAllowedOnFreeHit(dismissalType: DismissalType): boolean {
  return dismissalType === DismissalType.RunOut;
}

/** Bowler who delivered the last ball of a completed over, if any. */
export function bowlerOfOver(events: ScoringEvent[], overNumber: number): string | null {
  const inOver = events.filter((e) => e.overNumber === overNumber && e.bowlerId);
  return inOver.at(-1)?.bowlerId ?? null;
}

/**
 * A bowler may not bowl consecutive overs (§9.4 max overs is separate).
 * Enforced when the next delivery starts a new over.
 */
export function isConsecutiveOverViolation(
  events: ScoringEvent[],
  bowlerId: string | null,
): boolean {
  if (!bowlerId) {
    return false;
  }
  const next = nextBallPosition(events);
  if (next.overNumber <= 1 || next.ballNumber !== 1) {
    return false;
  }
  const previousOverBowler = bowlerOfOver(events, next.overNumber - 1);
  return previousOverBowler === bowlerId;
}

/** Fold the live stream and expose whether another ball may be appended. */
export function inningsAcceptsDelivery(events: ScoringEvent[]): boolean {
  return !deriveInnings(events).closed;
}

/** Undo is equivalent to dropping the last event — state re-derives identically. */
export function eventsAfterUndo(events: ScoringEvent[]): ScoringEvent[] {
  if (events.length === 0) {
    return events;
  }
  return events.slice(0, -1);
}
