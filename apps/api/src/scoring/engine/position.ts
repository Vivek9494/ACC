import { BALLS_PER_OVER } from '@acc/types';

import { isLegalBall, occupiesBallSlot } from './fold';
import type { ScoringEvent } from './types';

export interface BallPosition {
  overNumber: number;
  ballNumber: number;
}

function orderedBalls(events: ScoringEvent[]): ScoringEvent[] {
  return events
    .filter((e) => occupiesBallSlot(e.type))
    .sort((a, b) => {
      const ao = a.overNumber ?? 0;
      const bo = b.overNumber ?? 0;
      if (ao !== bo) return ao - bo;
      const ab = a.ballNumber ?? 0;
      const bb = b.ballNumber ?? 0;
      if (ab !== bb) return ab - bb;
      return a.sequence - b.sequence;
    });
}

/**
 * The (over, ball) slot the next appended delivery should occupy. Overs are
 * 1-indexed; ballNumber counts every delivery in the over (legal + illegal) so
 * wides/no-balls keep a stable position (§12.1). A new over begins once six
 * legal balls have been bowled (§32).
 */
export function nextBallPosition(events: ScoringEvent[]): BallPosition {
  let overNumber = 1;
  let ballInOver = 0;
  let legalThisOver = 0;

  for (const e of orderedBalls(events)) {
    ballInOver += 1;
    if (isLegalBall(e.type)) legalThisOver += 1;
    if (legalThisOver === BALLS_PER_OVER) {
      overNumber += 1;
      ballInOver = 0;
      legalThisOver = 0;
    }
  }
  return { overNumber, ballNumber: ballInOver + 1 };
}

/**
 * Position for a non-ball event (penalty runs, retirement, Impact Player in):
 * it attaches to the current over right after the last delivery bowled so the
 * fold orders it correctly.
 */
export function currentEventPosition(events: ScoringEvent[]): BallPosition {
  const next = nextBallPosition(events);
  return { overNumber: next.overNumber, ballNumber: Math.max(0, next.ballNumber - 1) };
}

/** The over currently in progress (the over the next delivery belongs to). */
export function currentOverNumber(events: ScoringEvent[]): number {
  return nextBallPosition(events).overNumber;
}

/**
 * Scorer edit window (§12.2): the current over may be edited freely and the
 * immediately previous over may be edited; anything older is rejected.
 */
export function editWindowAllows(targetOverNumber: number, currentOver: number): boolean {
  return targetOverNumber === currentOver || targetOverNumber === currentOver - 1;
}
