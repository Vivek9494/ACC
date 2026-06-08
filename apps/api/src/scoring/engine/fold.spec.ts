import 'reflect-metadata';

import { DeliveryType, DismissalType, InningsCloseReason } from '@acc/types';

import { deriveInnings } from './fold';
import { currentOverNumber, editWindowAllows, nextBallPosition } from './position';
import { occupiesBallSlot } from './fold';
import type { ScoringEvent } from './types';

type Spec = Partial<ScoringEvent> & { type: DeliveryType };

/**
 * Builds an event stream the way the scorer would: positions are auto-assigned
 * by appending (exercising nextBallPosition), the opening pair seeds strike, and
 * the engine derives rotation. Pass `strikerId` only to name an incoming batter
 * after a wicket.
 */
function innings(specs: Spec[], openers: [string, string] = ['A', 'B']): ScoringEvent[] {
  const events: ScoringEvent[] = [];
  let seq = 1;
  for (const s of specs) {
    const slot = occupiesBallSlot(s.type);
    const pos = slot ? nextBallPosition(events) : { overNumber: 1, ballNumber: 0 };
    events.push({
      sequence: seq++,
      overNumber: pos.overNumber,
      ballNumber: pos.ballNumber,
      type: s.type,
      strikerId: s.strikerId ?? openers[0],
      nonStrikerId: s.nonStrikerId ?? openers[1],
      bowlerId: s.bowlerId ?? 'X',
      runsBat: s.runsBat ?? 0,
      extraRuns: s.extraRuns ?? 0,
      isBoundary: s.isBoundary ?? false,
      isFreeHit: s.isFreeHit ?? false,
      dismissalType: s.dismissalType ?? null,
      dismissedId: s.dismissedId ?? null,
      fielderId: s.fielderId ?? null,
    });
  }
  return events;
}

const dot = (): Spec => ({ type: DeliveryType.Legal, runsBat: 0 });

describe('Scoring engine — a full over with every extra (§12.1, §32)', () => {
  const events = innings([
    { type: DeliveryType.Legal, runsBat: 1 }, // A scores 1, strike rotates
    { type: DeliveryType.Wide, extraRuns: 1 },
    { type: DeliveryType.NoBall, extraRuns: 1, runsBat: 0 }, // free hit armed
    { type: DeliveryType.Legal, runsBat: 0 }, // free-hit ball, dot
    { type: DeliveryType.Bye, extraRuns: 1 },
    { type: DeliveryType.LegBye, extraRuns: 2 },
    { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
    { type: DeliveryType.Legal, runsBat: 2 }, // 6th legal ball → over ends
  ]);
  const card = deriveInnings(events);

  it('derives total runs by folding (never a stored counter)', () => {
    expect(card.runs).toBe(12);
  });

  it('breaks extras down correctly; byes/leg-byes are not charged to the bowler', () => {
    expect(card.extras).toMatchObject({ wides: 1, noBalls: 1, byes: 1, legByes: 2, penalties: 0, total: 5 });
    expect(card.bowlers[0]).toMatchObject({ playerId: 'X', runsConceded: 9 });
  });

  it('counts exactly six legal balls for the over', () => {
    expect(card.legalBalls).toBe(6);
    expect(card.oversText).toBe('1.0');
    expect(card.bowlers[0]).toMatchObject({ legalBalls: 6 });
  });

  it('credits batter figures to the engine-derived striker', () => {
    const a = card.batters.find((b) => b.playerId === 'A');
    const b = card.batters.find((x) => x.playerId === 'B');
    expect(a).toMatchObject({ runs: 7, balls: 4, fours: 1, sixes: 0 });
    expect(b).toMatchObject({ runs: 0, balls: 3 });
  });

  it('leaves the correct batter on strike after the over swap', () => {
    expect(card.currentStrikerId).toBe('B');
    expect(card.currentNonStrikerId).toBe('A');
    expect(card.freeHitNext).toBe(false);
  });
});

describe('Scoring engine — free hit after a no-ball (§12.1)', () => {
  it('arms a free hit immediately after any no-ball', () => {
    const card = deriveInnings(innings([{ type: DeliveryType.NoBall, extraRuns: 1 }]));
    expect(card.freeHitNext).toBe(true);
  });

  it('keeps the free hit pending through a following wide (re-bowled)', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.NoBall, extraRuns: 1 },
        { type: DeliveryType.Wide, extraRuns: 1 },
      ]),
    );
    expect(card.freeHitNext).toBe(true);
  });

  it('clears the free hit once a legal delivery is bowled', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.NoBall, extraRuns: 1 },
        { type: DeliveryType.Legal, runsBat: 0 },
      ]),
    );
    expect(card.freeHitNext).toBe(false);
  });
});

describe('Scoring engine — dismissal modes (§12.1; §30.3 exclusions)', () => {
  const bowlerCredited: DismissalType[] = [
    DismissalType.Bowled,
    DismissalType.Caught,
    DismissalType.Lbw,
    DismissalType.Stumped,
    DismissalType.HitWicket,
  ];

  it.each(bowlerCredited)('records %s as a wicket credited to the bowler', (mode) => {
    const card = deriveInnings(innings([{ type: DeliveryType.Legal, dismissalType: mode, dismissedId: 'A' }]));
    expect(card.wickets).toBe(1);
    expect(card.bowlers[0]).toMatchObject({ wickets: 1 });
    const a = card.batters.find((b) => b.playerId === 'A');
    expect(a?.isOut).toBe(true);
    expect(a?.dismissalType).toBe(mode);
  });

  it('records a run out as a wicket NOT credited to the bowler', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.Legal, runsBat: 1, dismissalType: DismissalType.RunOut, dismissedId: 'A' }]),
    );
    expect(card.wickets).toBe(1);
    expect(card.bowlers[0]).toMatchObject({ wickets: 0 });
  });

  it('counts retired out as a wicket', () => {
    const card = deriveInnings(innings([{ type: DeliveryType.RetiredOut, dismissedId: 'A' }]));
    expect(card.wickets).toBe(1);
    expect(card.bowlers[0]?.wickets ?? 0).toBe(0);
  });

  it('does NOT count retired hurt as a wicket and frees the crease', () => {
    const card = deriveInnings(innings([{ type: DeliveryType.RetiredHurt, dismissedId: 'A' }]));
    expect(card.wickets).toBe(0);
    // The retired (striker) slot is vacated until the next batter is named.
    expect(card.currentStrikerId).toBeNull();
  });

  it('handles the wide + stumping combination', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.Wide, extraRuns: 1, dismissalType: DismissalType.Stumped, dismissedId: 'A' }]),
    );
    expect(card.wickets).toBe(1);
    expect(card.extras.wides).toBe(1);
    expect(card.legalBalls).toBe(0); // a wide is not a legal ball
    expect(card.bowlers[0]).toMatchObject({ wickets: 1 }); // stumping is bowler-credited
  });

  it('handles the no-ball + run-out combination with a free hit armed', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, dismissalType: DismissalType.RunOut, dismissedId: 'A' }]),
    );
    expect(card.wickets).toBe(1);
    expect(card.bowlers[0]).toMatchObject({ wickets: 0 }); // run out not credited
    expect(card.extras.noBalls).toBe(1);
    expect(card.freeHitNext).toBe(true);
  });
});

describe('Scoring engine — overthrows as additional runs (§12.1)', () => {
  it('adds overthrow runs to the same delivery and rotates on the odd total', () => {
    const card = deriveInnings(innings([{ type: DeliveryType.Legal, runsBat: 5 }])); // 1 run + 4 overthrows
    const a = card.batters.find((b) => b.playerId === 'A');
    expect(a?.runs).toBe(5);
    expect(card.runs).toBe(5);
    expect(card.currentStrikerId).toBe('B'); // odd total swaps strike
  });
});

describe('Scoring engine — strike rotation (§32)', () => {
  it('swaps on an odd run', () => {
    expect(deriveInnings(innings([{ type: DeliveryType.Legal, runsBat: 1 }])).currentStrikerId).toBe('B');
  });

  it('does not swap on an even run', () => {
    expect(deriveInnings(innings([{ type: DeliveryType.Legal, runsBat: 2 }])).currentStrikerId).toBe('A');
  });

  it('does not swap on a boundary', () => {
    expect(
      deriveInnings(innings([{ type: DeliveryType.Legal, runsBat: 4, isBoundary: true }])).currentStrikerId,
    ).toBe('A');
  });

  it('swaps at the end of an over', () => {
    const card = deriveInnings(innings([dot(), dot(), dot(), dot(), dot(), dot()]));
    expect(card.legalBalls).toBe(6);
    expect(card.currentStrikerId).toBe('B');
  });

  it('returns the striker to the original end on a single off the last ball (double swap)', () => {
    const card = deriveInnings(
      innings([dot(), dot(), dot(), dot(), dot(), { type: DeliveryType.Legal, runsBat: 1 }]),
    );
    expect(card.currentStrikerId).toBe('A');
  });

  it('credits a maiden over (byes do not break it; wides/no-balls do)', () => {
    const maiden = deriveInnings(innings([dot(), dot(), { type: DeliveryType.Bye, extraRuns: 1 }, dot(), dot(), dot()]));
    expect(maiden.bowlers[0]).toMatchObject({ maidens: 1 });
    const notMaiden = deriveInnings(
      innings([dot(), dot(), { type: DeliveryType.Wide, extraRuns: 1 }, dot(), dot(), dot(), dot()]),
    );
    expect(notMaiden.bowlers[0]).toMatchObject({ maidens: 0 });
  });
});

describe('Scoring engine — innings end conditions (§32)', () => {
  it('closes when ten wickets fall (all out)', () => {
    const specs: Spec[] = Array.from({ length: 10 }, () => ({
      type: DeliveryType.Legal,
      dismissalType: DismissalType.Bowled,
    }));
    const card = deriveInnings(innings(specs));
    expect(card.wickets).toBe(10);
    expect(card.closed).toBe(true);
    expect(card.closeReason).toBe(InningsCloseReason.AllOut);
  });

  it('closes when the full quota of overs is bowled', () => {
    const events = innings([dot(), dot(), dot(), dot(), dot(), dot()]);
    const card = deriveInnings(events, { oversAllotted: 1 });
    expect(card.legalBalls).toBe(6);
    expect(card.closed).toBe(true);
    expect(card.closeReason).toBe(InningsCloseReason.OversComplete);
  });

  it('does not close before the quota when overs remain', () => {
    const events = innings([dot(), dot(), dot()]);
    const card = deriveInnings(events, { oversAllotted: 5 });
    expect(card.closed).toBe(false);
    expect(card.closeReason).toBeNull();
  });

  it('closes the chase the moment the target is reached', () => {
    const events = innings([{ type: DeliveryType.Legal, runsBat: 6, isBoundary: true }]);
    const card = deriveInnings(events, { oversAllotted: 20, target: 5 });
    expect(card.runs).toBe(6);
    expect(card.closed).toBe(true);
    expect(card.closeReason).toBe(InningsCloseReason.TargetReached);
  });
});

describe('Scoring engine — live display derivations (§28)', () => {
  it('builds a ball-by-ball timeline with codes and descriptions', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
        { type: DeliveryType.Wide, extraRuns: 1 },
        { type: DeliveryType.Legal, dismissalType: DismissalType.Bowled, dismissedId: 'A' },
      ]),
    );
    expect(card.timeline.map((t) => t.code)).toEqual(['4', 'Wd', 'W']);
    expect(card.timeline[0]!.description).toBe('FOUR');
    expect(card.timeline[2]!).toMatchObject({ isWicket: true, description: 'WICKET — Bowled' });
  });

  it('groups deliveries into a recent-overs strip', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 1 },
        { type: DeliveryType.Legal, runsBat: 0 },
        { type: DeliveryType.Wide, extraRuns: 1 },
        { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
      ]),
    );
    expect(card.recentOvers).toHaveLength(1);
    expect(card.recentOvers[0]).toMatchObject({ overNumber: 1, runs: 6 });
    expect(card.recentOvers[0]!.balls).toEqual(['1', '·', 'Wd', '4']);
  });

  it('tracks the current partnership and resets it after a wicket', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 2 },
        { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
        { type: DeliveryType.Legal, dismissalType: DismissalType.Bowled, dismissedId: 'A' },
        // new batter 'C' comes in and scores
        { type: DeliveryType.Legal, runsBat: 1, strikerId: 'C' },
      ]),
    );
    // Only the single run since the wicket counts toward the live partnership.
    expect(card.partnership).toMatchObject({ runs: 1, balls: 1 });
  });
});

describe('Scoring engine — scorer edit window (§12.2)', () => {
  const threeOvers = innings([
    ...Array.from({ length: 6 }, () => dot()),
    ...Array.from({ length: 6 }, () => dot()),
    dot(),
    dot(),
  ]);

  it('identifies the current over from the event stream', () => {
    expect(currentOverNumber(threeOvers)).toBe(3);
  });

  it('allows edits to the current and immediately previous over only', () => {
    const current = currentOverNumber(threeOvers);
    expect(editWindowAllows(current, current)).toBe(true); // current
    expect(editWindowAllows(current - 1, current)).toBe(true); // previous
    expect(editWindowAllows(current - 2, current)).toBe(false); // too old
  });
});
