import {
  BALLS_PER_OVER,
  BowlerPickerIneligibility,
  formatBowlerOmRw,
} from '@acc/types';

import { isConsecutiveOverViolation } from './engine/validation';
import type { ScoringEvent } from './engine/types';

describe('formatBowlerOmRw', () => {
  it('formats overs-maidens-runs-wickets', () => {
    expect(
      formatBowlerOmRw({
        oversText: '4',
        maidens: 0,
        runsConceded: 24,
        wickets: 2,
      }),
    ).toBe('4-0-24-2');
  });
});

describe('bowler picker eligibility', () => {
  function legalBall(
    overNumber: number,
    ballNumber: number,
    bowlerId: string,
  ): ScoringEvent {
    return {
      type: 'LEGAL',
      sequence: overNumber * 10 + ballNumber,
      overNumber,
      ballNumber,
      strikerId: 'a',
      nonStrikerId: 'b',
      bowlerId,
      runsBat: 0,
      extraRuns: 0,
      noBallByeRuns: 0,
      noBallLegByeRuns: 0,
      isBoundary: false,
      isFreeHit: false,
      dismissalType: null,
      dismissedId: null,
      fielderId: null,
      fielder2Id: null,
      penaltyBeneficiaryTeamId: null,
      eventSortMs: 0,
    };
  }

  it('blocks the previous over bowler at the start of a new over', () => {
    const events: ScoringEvent[] = [];
    for (let ball = 1; ball <= 6; ball += 1) {
      events.push(legalBall(1, ball, 'bowler-a'));
    }
    expect(isConsecutiveOverViolation(events, 'bowler-a')).toBe(true);
    expect(isConsecutiveOverViolation(events, 'bowler-b')).toBe(false);
  });

  it('does not block consecutive rule mid-over', () => {
    const events = [legalBall(2, 3, 'bowler-a')];
    expect(isConsecutiveOverViolation(events, 'bowler-a')).toBe(false);
  });

  it('detects quota reached from legal balls', () => {
    const maxOvers = 4;
    const legalBalls = maxOvers * BALLS_PER_OVER;
    expect(legalBalls >= maxOvers * BALLS_PER_OVER).toBe(true);
    expect(BowlerPickerIneligibility.QuotaReached).toBe('QUOTA_REACHED');
  });
});
