import { DeliveryType, DismissalType } from '@acc/types';

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

/**
 * True once the scorer has officially ended the innings (END_INNINGS event).
 * Natural close conditions (overs complete / all out / target) leave the innings
 * editable until that confirmation — Cancel on the End Innings dialog must not
 * lock scoring.
 */
export function inningsOfficiallyEnded(events: ScoringEvent[]): boolean {
  return events.some((e) => e.type === DeliveryType.EndInnings);
}

/**
 * Whether another ball may be appended to this innings' delivery log.
 * Natural end conditions alone do not block scoring; only an official END_INNINGS
 * event does. Callers must also ensure this innings is still the match's active
 * (latest) innings after a chase / completion transition.
 */
export function inningsAcceptsDelivery(events: ScoringEvent[]): boolean {
  return !inningsOfficiallyEnded(events);
}

/** Undo is equivalent to dropping the last event — state re-derives identically. */
export function eventsAfterUndo(events: ScoringEvent[]): ScoringEvent[] {
  if (events.length === 0) {
    return events;
  }
  return events.slice(0, -1);
}
