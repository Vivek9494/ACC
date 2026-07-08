import 'reflect-metadata';

import { DeliveryType, DismissalType, InningsCloseReason } from '@acc/types';

import { deriveInnings, resolveLiveParticipants } from './fold';
import { currentOverNumber, editWindowAllows, nextBallPosition, currentEventPosition } from './position';
import { occupiesBallSlot } from './fold';
import { isConsecutiveOverViolation } from './validation';
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
    const pos = slot ? nextBallPosition(events) : currentEventPosition(events);
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
      noBallByeRuns: s.noBallByeRuns ?? 0,
      noBallLegByeRuns: s.noBallLegByeRuns ?? 0,
      penaltyBeneficiaryTeamId: s.penaltyBeneficiaryTeamId ?? null,
      eventSortMs: s.eventSortMs ?? s.sequence ?? 0,
      isBoundary: s.isBoundary ?? false,
      isFreeHit: s.isFreeHit ?? false,
      dismissalType: s.dismissalType ?? null,
      dismissedId: s.dismissedId ?? null,
      fielderId: s.fielderId ?? null,
      fielder2Id: s.fielder2Id ?? null,
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
    expect(a).toMatchObject({ runs: 7, balls: 4, ones: 1, twos: 1, threes: 0, fours: 1, sixes: 0 });
    expect(b).toMatchObject({ runs: 0, balls: 3, ones: 0, twos: 0, threes: 0 });
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

describe('Scoring engine — no-balls (§12.1)', () => {
  it('credits off-the-bat runs to the striker and the penalty to no-ball extras', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, runsBat: 4 }]),
    );
    expect(card.runs).toBe(5);
    expect(card.extras.noBalls).toBe(1);
    expect(card.extras.byes).toBe(0);
    expect(card.extras.legByes).toBe(0);
    expect(card.extras.total).toBe(1);
    expect(card.legalBalls).toBe(0);
    expect(card.freeHitNext).toBe(true);
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 4, balls: 1 });
    expect(card.bowlers[0]).toMatchObject({ runsConceded: 5, legalBalls: 0, noBalls: 1 });
  });

  it('records no-ball + leg-byes without crediting the batsman or leg-bye runs to the bowler', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, noBallLegByeRuns: 4 }]),
    );
    expect(card.runs).toBe(5);
    expect(card.extras.noBalls).toBe(1);
    expect(card.extras.legByes).toBe(4);
    expect(card.extras.total).toBe(5);
    expect(card.freeHitNext).toBe(true);
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 0, balls: 1 });
    expect(card.bowlers[0]).toMatchObject({ runsConceded: 1, legalBalls: 0, noBalls: 1 });
  });

  it('records no-ball + byes without crediting the batsman', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, noBallByeRuns: 2 }]),
    );
    expect(card.runs).toBe(3);
    expect(card.extras.noBalls).toBe(1);
    expect(card.extras.byes).toBe(2);
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 0, balls: 1 });
    expect(card.bowlers[0]).toMatchObject({ runsConceded: 1 });
  });

  it('does not advance the over on a no-ball', () => {
    const card = deriveInnings(
      innings([
        dot(),
        dot(),
        dot(),
        dot(),
        dot(),
        dot(),
        { type: DeliveryType.NoBall, extraRuns: 1 },
      ]),
    );
    expect(card.legalBalls).toBe(6);
    expect(card.bowlers[0]).toMatchObject({ legalBalls: 6, oversText: '1.0' });
  });

  it('rotates strike when off-the-bat or completed extra runs on a no-ball are odd', () => {
    const offBatOdd = deriveInnings(innings([{ type: DeliveryType.NoBall, extraRuns: 1, runsBat: 1 }]));
    expect(offBatOdd.currentStrikerId).toBe('B');

    const legOdd = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, noBallLegByeRuns: 3 }]),
    );
    expect(legOdd.currentStrikerId).toBe('B');
  });

  it('does not rotate strike when off-the-bat or completed extra runs on a no-ball are even', () => {
    const plain = deriveInnings(innings([{ type: DeliveryType.NoBall, extraRuns: 1 }]));
    expect(plain.currentStrikerId).toBe('A');

    const offBatEven = deriveInnings(innings([{ type: DeliveryType.NoBall, extraRuns: 1, runsBat: 4 }]));
    expect(offBatEven.currentStrikerId).toBe('A');

    const legEven = deriveInnings(
      innings([{ type: DeliveryType.NoBall, extraRuns: 1, noBallLegByeRuns: 4 }]),
    );
    expect(legEven.currentStrikerId).toBe('A');
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

  it.each([
    DismissalType.Bowled,
    DismissalType.Lbw,
    DismissalType.HitWicket,
  ])('records %s as a legal ball with no runs off the bat', (mode) => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.Legal, runsBat: 0, dismissalType: mode, dismissedId: 'A' }]),
    );
    expect(card.wickets).toBe(1);
    expect(card.legalBalls).toBe(1);
    expect(card.runs).toBe(0);
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({
      balls: 1,
      runs: 0,
      isOut: true,
      dismissalType: mode,
      bowlerId: 'X',
    });
    expect(card.bowlers[0]).toMatchObject({ wickets: 1, legalBalls: 1 });
    expect(card.currentStrikerId).toBeNull();
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
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({
      isOut: false,
      retiredHurt: true,
    });
    // The retired (striker) slot is vacated until the next batter is named.
    expect(card.currentStrikerId).toBeNull();
  });

  it('preserves retired-hurt batter scores and marks them returnable', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 1 },
        { type: DeliveryType.RetiredHurt, dismissedId: 'A' },
      ]),
    );
    expect(card.wickets).toBe(0);
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({
      runs: 1,
      balls: 1,
      isOut: false,
      retiredHurt: true,
    });
  });

  it('clears retired-hurt when the batter returns to the crease', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.RetiredHurt, dismissedId: 'A' },
        { type: DeliveryType.Legal, runsBat: 0, strikerId: 'A', nonStrikerId: 'B' },
      ]),
    );
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({
      retiredHurt: false,
    });
  });

  it('records a dropped catch as metadata without affecting score, wickets, or legal balls', () => {
    const before = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 1 },
        { type: DeliveryType.Legal, runsBat: 0 },
      ]),
    );
    const after = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 1 },
        { type: DeliveryType.Legal, runsBat: 0 },
        { type: DeliveryType.CatchDrop, fielderId: 'F1', strikerId: 'A', nonStrikerId: 'B', bowlerId: 'X' },
      ]),
    );
    expect(after.runs).toBe(before.runs);
    expect(after.wickets).toBe(before.wickets);
    expect(after.legalBalls).toBe(before.legalBalls);
    expect(after.currentStrikerId).toBe(before.currentStrikerId);
    expect(after.currentNonStrikerId).toBe(before.currentNonStrikerId);
    expect(after.droppedCatches).toEqual([{ playerId: 'F1', count: 1 }]);
    expect(after.droppedCatchEvents).toEqual([
      {
        sequence: 3,
        overNumber: 1,
        ballNumber: 2,
        overBallLabel: '1.2',
        batsmanId: 'A',
        batsmanRuns: 1,
        batsmanBalls: 1,
        bowlerId: 'X',
        fielderId: 'F1',
      },
    ]);
    expect(after.timeline.at(-1)).toMatchObject({
      code: 'Drop',
      description: 'Catch dropped',
      isWicket: false,
      runs: 0,
    });
  });

  it('allows multiple dropped catches for the same fielder', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 0 },
        { type: DeliveryType.CatchDrop, fielderId: 'F1' },
        { type: DeliveryType.CatchDrop, fielderId: 'F1' },
        { type: DeliveryType.CatchDrop, fielderId: 'F2' },
      ]),
    );
    expect(card.droppedCatches).toEqual([
      { playerId: 'F1', count: 2 },
      { playerId: 'F2', count: 1 },
    ]);
    expect(card.legalBalls).toBe(1);
  });

  it('records a Mankad as a non-ball run out without crediting the bowler', () => {
    const card = deriveInnings(
      innings([
        {
          type: DeliveryType.Mankad,
          dismissalType: DismissalType.RunOut,
          dismissedId: 'B',
          fielderId: 'X',
        },
      ]),
    );
    expect(card.wickets).toBe(1);
    expect(card.legalBalls).toBe(0);
    expect(card.currentStrikerId).toBe('A');
    expect(card.currentNonStrikerId).toBeNull();
    expect(card.bowlers[0]).toMatchObject({ wickets: 0, legalBalls: 0 });
    expect(card.batters.find((b) => b.playerId === 'B')).toMatchObject({
      isOut: true,
      isMankad: true,
    });
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

  it('tracks extended bowler figures (dots, extras, boundaries)', () => {
    const events = innings([
      dot(),
      dot(),
      { type: DeliveryType.Wide, extraRuns: 1 },
      { type: DeliveryType.NoBall, extraRuns: 1 },
      { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
      { type: DeliveryType.Legal, runsBat: 6, isBoundary: true },
      {
        type: DeliveryType.Legal,
        dismissalType: DismissalType.Bowled,
        dismissedId: 'A',
      },
    ]);
    const card = deriveInnings(events);
    expect(card.bowlers[0]).toMatchObject({
      legalBalls: 5,
      oversText: '0.5',
      runsConceded: 12,
      wickets: 1,
      dotBalls: 3,
      wides: 1,
      noBalls: 1,
      fours: 1,
      sixes: 1,
      economy: 14.4,
    });
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

describe('Scoring engine — run-out completed runs (§12.1)', () => {
  it('credits completed runs to the dismissed non-striker on a run out', () => {
    const card = deriveInnings(
      innings([
        {
          type: DeliveryType.Legal,
          runsBat: 2,
          dismissalType: DismissalType.RunOut,
          dismissedId: 'B',
          fielderId: 'Y',
        },
      ]),
    );
    expect(card.runs).toBe(2);
    expect(card.batters.find((b) => b.playerId === 'B')).toMatchObject({ runs: 2, balls: 0 });
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 0, balls: 1 });
    expect(card.bowlers[0]).toMatchObject({ wickets: 0, runsConceded: 2 });
  });

  it('records a wide + run out with completed runs on the wide', () => {
    const card = deriveInnings(
      innings([
        {
          type: DeliveryType.Wide,
          extraRuns: 3,
          dismissalType: DismissalType.RunOut,
          dismissedId: 'A',
          fielderId: 'Y',
        },
      ]),
    );
    expect(card.wickets).toBe(1);
    expect(card.extras.wides).toBe(3);
    expect(card.legalBalls).toBe(0);
    expect(card.runs).toBe(3);
    expect(card.bowlers[0]).toMatchObject({ wickets: 0, runsConceded: 3, wides: 1 });
  });

  it('stores relay fielders on the dismissed batter card', () => {
    const card = deriveInnings(
      innings([
        {
          type: DeliveryType.Legal,
          dismissalType: DismissalType.RunOut,
          dismissedId: 'A',
          fielderId: 'Y',
          fielder2Id: 'Z',
        },
      ]),
    );
    expect(card.batters.find((b) => b.playerId === 'A')).toMatchObject({
      fielderId: 'Y',
      fielder2Id: 'Z',
    });
  });
});

describe('Scoring engine — wides (§12.1)', () => {
  it('adds wide runs to team extras and charges the bowler without crediting the batsman', () => {
    const events = innings([
      { type: DeliveryType.Legal, runsBat: 0 },
      { type: DeliveryType.Wide, extraRuns: 5 },
    ]);
    const card = deriveInnings(events);
    expect(card.runs).toBe(5);
    expect(card.extras.wides).toBe(5);
    expect(card.extras.total).toBe(5);
    expect(card.legalBalls).toBe(1);
    expect(card.batters[0]).toMatchObject({ playerId: 'A', runs: 0, balls: 1 });
    expect(card.bowlers[0]).toMatchObject({ playerId: 'X', runsConceded: 5, legalBalls: 1, wides: 1 });
  });

  it('does not advance the over on a wide (re-bowled)', () => {
    const card = deriveInnings(
      innings([
        dot(),
        dot(),
        dot(),
        dot(),
        dot(),
        dot(),
        { type: DeliveryType.Wide, extraRuns: 1 },
      ]),
    );
    expect(card.legalBalls).toBe(6);
    expect(card.bowlers[0]).toMatchObject({ legalBalls: 6, oversText: '1.0' });
  });

  it('rotates strike when the completed runs N on a wide are odd', () => {
    const plain = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 1 }]));
    expect(plain.currentStrikerId).toBe('A');
    expect(plain.currentNonStrikerId).toBe('B');

    const plusOne = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 2 }]));
    expect(plusOne.currentStrikerId).toBe('B');
    expect(plusOne.currentNonStrikerId).toBe('A');

    const plusThree = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 4 }]));
    expect(plusThree.currentStrikerId).toBe('B');
    expect(plusThree.currentNonStrikerId).toBe('A');
  });

  it('does not rotate strike when the completed runs N on a wide are even', () => {
    const plusTwo = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 3 }]));
    expect(plusTwo.currentStrikerId).toBe('A');
    expect(plusTwo.currentNonStrikerId).toBe('B');

    const plusFour = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 5 }]));
    expect(plusFour.currentStrikerId).toBe('A');
    expect(plusFour.currentNonStrikerId).toBe('B');

    const plusSix = deriveInnings(innings([{ type: DeliveryType.Wide, extraRuns: 7 }]));
    expect(plusSix.currentStrikerId).toBe('A');
    expect(plusSix.currentNonStrikerId).toBe('B');
  });
});

describe('Scoring engine — byes (§12.1)', () => {
  it('adds byes to team extras without crediting the batsman or bowler', () => {
    const events = innings([
      { type: DeliveryType.Legal, runsBat: 0 },
      { type: DeliveryType.Bye, extraRuns: 2 },
    ]);
    const card = deriveInnings(events);
    expect(card.runs).toBe(2);
    expect(card.extras.byes).toBe(2);
    expect(card.extras.legByes).toBe(0);
    expect(card.extras.total).toBe(2);
    expect(card.legalBalls).toBe(2);
    expect(card.batters[0]).toMatchObject({ playerId: 'A', runs: 0, balls: 2 });
    expect(card.bowlers[0]).toMatchObject({ playerId: 'X', runsConceded: 0, legalBalls: 2 });
  });

  it('rotates strike on an odd bye but not on an even bye', () => {
    const odd = deriveInnings(innings([{ type: DeliveryType.Bye, extraRuns: 1 }]));
    expect(odd.currentStrikerId).toBe('B');
    expect(odd.currentNonStrikerId).toBe('A');

    const even = deriveInnings(innings([{ type: DeliveryType.Bye, extraRuns: 2 }]));
    expect(even.currentStrikerId).toBe('A');
    expect(even.currentNonStrikerId).toBe('B');
  });
});

describe('Scoring engine — leg-byes (§12.1)', () => {
  it('adds leg-byes to team extras without crediting the batsman or bowler', () => {
    const events = innings([
      { type: DeliveryType.Legal, runsBat: 0 },
      { type: DeliveryType.LegBye, extraRuns: 2 },
    ]);
    const card = deriveInnings(events);
    expect(card.runs).toBe(2);
    expect(card.extras.legByes).toBe(2);
    expect(card.extras.total).toBe(2);
    expect(card.legalBalls).toBe(2);
    expect(card.batters[0]).toMatchObject({ playerId: 'A', runs: 0, balls: 2 });
    expect(card.bowlers[0]).toMatchObject({ playerId: 'X', runsConceded: 0, legalBalls: 2 });
  });

  it('rotates strike on an odd leg-bye but not on an even leg-bye', () => {
    const odd = deriveInnings(innings([{ type: DeliveryType.LegBye, extraRuns: 1 }]));
    expect(odd.currentStrikerId).toBe('B');
    expect(odd.currentNonStrikerId).toBe('A');

    const even = deriveInnings(innings([{ type: DeliveryType.LegBye, extraRuns: 2 }]));
    expect(even.currentStrikerId).toBe('A');
    expect(even.currentNonStrikerId).toBe('B');
  });
});

describe('Scoring engine — manual innings end (§12.2)', () => {
  it('closes an innings when an END_INNINGS event is recorded', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.Legal, runsBat: 4 }, { type: DeliveryType.EndInnings }]),
    );
    expect(card.closed).toBe(true);
    expect(card.closeReason).toBe(InningsCloseReason.ManuallyEnded);
    expect(card.runs).toBe(4);
  });
});

describe('Scoring engine — penalty beneficiary (§12.2)', () => {
  it('credits penalty runs only to the nominated batting team', () => {
    expect(
      deriveInnings(
        innings([{ type: DeliveryType.PenaltyRuns, extraRuns: 5, penaltyBeneficiaryTeamId: 'TEAM_A' }]),
        { battingTeamId: 'TEAM_A' },
      ).runs,
    ).toBe(5);
    expect(
      deriveInnings(
        innings([{ type: DeliveryType.PenaltyRuns, extraRuns: 5, penaltyBeneficiaryTeamId: 'TEAM_B' }]),
        { battingTeamId: 'TEAM_A' },
      ).runs,
    ).toBe(0);
  });

  it('does not advance the over or credit batsman/bowler for a penalty', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.PenaltyRuns, extraRuns: 5 }]),
      { battingTeamId: 'TEAM_A' },
    );
    expect(card.legalBalls).toBe(0);
    expect(card.extras.penalties).toBe(5);
    expect(card.batters[0]).toMatchObject({ runs: 0, balls: 0 });
    expect(card.bowlers[0]).toMatchObject({ runsConceded: 0, legalBalls: 0 });
  });
});

describe('Scoring engine — penalty runs (§12.1)', () => {
  it('adds penalty runs to the team total without charging the bowler', () => {
    const card = deriveInnings(
      innings([{ type: DeliveryType.PenaltyRuns, extraRuns: 5 }]),
    );
    expect(card.runs).toBe(5);
    expect(card.extras.penalties).toBe(5);
    expect(card.bowlers[0]?.runsConceded ?? 0).toBe(0);
    expect(card.legalBalls).toBe(0);
    expect(card.batters[0]?.runs ?? 0).toBe(0);
  });

  it('subtracts negative bonus from the team total without affecting ball count or figures', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 4 },
        { type: DeliveryType.PenaltyRuns, extraRuns: -2 },
      ]),
    );
    expect(card.runs).toBe(2);
    expect(card.extras.penalties).toBe(-2);
    expect(card.legalBalls).toBe(1);
    expect(card.batters[0]?.runs).toBe(4);
    expect(card.bowlers[0]?.runsConceded).toBe(4);
  });

  it('floors the team total at zero when a negative bonus would go below zero', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 2 },
        { type: DeliveryType.PenaltyRuns, extraRuns: -5 },
      ]),
    );
    expect(card.runs).toBe(0);
    expect(card.extras.penalties).toBe(-5);
  });

  it('restores prior state when a bonus event is undone', () => {
    const events = innings([
      { type: DeliveryType.Legal, runsBat: 1 },
      { type: DeliveryType.PenaltyRuns, extraRuns: 3 },
    ]);
    const before = deriveInnings(events);
    const after = deriveInnings(events.slice(0, -1));
    expect(before.runs).toBe(4);
    expect(after.runs).toBe(1);
    expect(after.legalBalls).toBe(1);
  });
});

describe('Scoring engine — undo via event removal', () => {
  it('restores the exact prior derived state when the last delivery is removed', () => {
    const events = innings([
      { type: DeliveryType.Legal, runsBat: 4, isBoundary: true },
      { type: DeliveryType.Wide, extraRuns: 1 },
    ]);
    const before = deriveInnings(events);
    const after = deriveInnings(events.slice(0, -1));
    expect(before.runs).toBe(5);
    expect(after.runs).toBe(4);
    expect(after.extras.wides).toBe(0);
    expect(after.legalBalls).toBe(1);
  });
});

describe('Scoring engine — consecutive over rule', () => {
  it('flags the same bowler at the start of the next over', () => {
    const sixDots = Array.from({ length: 6 }, () => dot());
    const events = innings(sixDots);
    expect(isConsecutiveOverViolation(events, 'X')).toBe(true);
    expect(isConsecutiveOverViolation(events, 'Y')).toBe(false);
  });
});

describe('Scoring engine — persisted participant selections', () => {
  it('uses scorer selections before the first ball', () => {
    const card = deriveInnings([], {
      selectedStrikerId: 'A',
      selectedNonStrikerId: 'B',
      selectedBowlerId: 'X',
    });
    expect(card.currentStrikerId).toBe('A');
    expect(card.currentNonStrikerId).toBe('B');
    expect(card.currentBowlerId).toBe('X');
  });

  it('hides the previous over bowler at an over boundary until a new bowler is selected', () => {
    const events = innings(Array.from({ length: 6 }, () => dot()));
    const card = deriveInnings(events, { selectedBowlerId: null });
    expect(card.legalBalls).toBe(6);
    expect(card.currentBowlerId).toBeNull();
  });

  it('shows the incoming batter from a persisted selection after a wicket', () => {
    const events = innings([
      {
        type: DeliveryType.Legal,
        dismissalType: DismissalType.Bowled,
        dismissedId: 'A',
      },
    ]);
    const card = deriveInnings(events, { selectedStrikerId: 'C' });
    expect(card.currentStrikerId).toBe('C');
    expect(card.currentNonStrikerId).toBe('B');
  });

  it('resolveLiveParticipants merges folded crease gaps with persisted selections', () => {
    expect(
      resolveLiveParticipants(
        { striker: null, nonStriker: 'B', currentBowlerId: 'X', legalBalls: 1 },
        { selectedStrikerId: 'C' },
      ),
    ).toMatchObject({
      currentStrikerId: 'C',
      currentNonStrikerId: 'B',
      currentBowlerId: 'X',
    });
  });
});

describe('Scoring engine — partnerships (§28)', () => {
  it('records completed stands at each wicket and tracks the current partnership', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 50, isBoundary: true, strikerId: 'A', nonStrikerId: 'B' },
        ...Array.from({ length: 5 }, () => dot()),
        {
          type: DeliveryType.Legal,
          runsBat: 0,
          dismissalType: DismissalType.Caught,
          dismissedId: 'A',
          fielderId: 'F',
        },
        { type: DeliveryType.Legal, runsBat: 20, strikerId: 'B', nonStrikerId: 'C' },
      ]),
    );

    expect(card.partnerships).toHaveLength(1);
    expect(card.partnerships[0]?.runs).toBe(50);
    expect(card.partnerships[0]?.balls).toBe(7);
    expect(card.partnerships[0]?.batterIds).toEqual(['A', 'B']);
    expect(card.partnerships[0]?.batterRuns).toEqual(
      expect.arrayContaining([
        { playerId: 'A', runs: 50 },
        { playerId: 'B', runs: 0 },
      ]),
    );
    expect(card.partnership).toMatchObject({
      batterIds: ['B', 'C'],
      runs: 20,
      balls: 1,
      batterRuns: expect.arrayContaining([
        { playerId: 'B', runs: 20 },
        { playerId: 'C', runs: 0 },
      ]),
    });
  });

  it('tracks in-stand batter runs when a batter spans multiple partnerships', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 5, strikerId: 'A', nonStrikerId: 'B' },
        { type: DeliveryType.Legal, runsBat: 10, strikerId: 'B', nonStrikerId: 'A' },
        {
          type: DeliveryType.Legal,
          runsBat: 0,
          dismissalType: DismissalType.Caught,
          dismissedId: 'A',
          fielderId: 'F',
        },
        { type: DeliveryType.Legal, runsBat: 20, strikerId: 'B', nonStrikerId: 'C' },
      ]),
    );

    expect(card.partnerships[0]?.batterRuns).toEqual(
      expect.arrayContaining([
        { playerId: 'A', runs: 5 },
        { playerId: 'B', runs: 10 },
      ]),
    );
    expect(card.partnership).toMatchObject({
      runs: 20,
      balls: 1,
      batterRuns: expect.arrayContaining([
        { playerId: 'B', runs: 20 },
        { playerId: 'C', runs: 0 },
      ]),
    });
  });

  it('orders partnership batters as continuing (left) then incoming (right)', () => {
    const card = deriveInnings(
      innings([
        { type: DeliveryType.Legal, runsBat: 10, strikerId: 'A', nonStrikerId: 'B' },
        {
          type: DeliveryType.Legal,
          runsBat: 0,
          dismissalType: DismissalType.Caught,
          dismissedId: 'A',
          fielderId: 'F',
        },
        { type: DeliveryType.Legal, runsBat: 5, strikerId: 'B', nonStrikerId: 'C' },
        {
          type: DeliveryType.Legal,
          runsBat: 0,
          dismissalType: DismissalType.Caught,
          dismissedId: 'B',
          fielderId: 'F',
        },
      ]),
    );

    expect(card.partnerships[0]?.batterIds).toEqual(['A', 'B']);
    expect(card.partnerships[1]?.batterIds).toEqual(['B', 'C']);
  });
});
