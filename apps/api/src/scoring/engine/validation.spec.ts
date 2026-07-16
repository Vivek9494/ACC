import { DeliveryType } from '@acc/types';

import { inningsAcceptsDelivery, inningsOfficiallyEnded } from './validation';
import type { ScoringEvent } from './types';

function event(partial: Partial<ScoringEvent> & Pick<ScoringEvent, 'type'>): ScoringEvent {
  return {
    sequence: partial.sequence ?? 1,
    overNumber: partial.overNumber ?? 1,
    ballNumber: partial.ballNumber ?? 1,
    type: partial.type,
    strikerId: partial.strikerId ?? 'A',
    nonStrikerId: partial.nonStrikerId ?? 'B',
    bowlerId: partial.bowlerId ?? 'C',
    runsBat: partial.runsBat ?? 0,
    extraRuns: partial.extraRuns ?? 0,
    noBallByeRuns: partial.noBallByeRuns ?? 0,
    noBallLegByeRuns: partial.noBallLegByeRuns ?? 0,
    penaltyBeneficiaryTeamId: partial.penaltyBeneficiaryTeamId ?? null,
    eventSortMs: partial.eventSortMs ?? 0,
    isBoundary: partial.isBoundary ?? false,
    isFreeHit: partial.isFreeHit ?? false,
    dismissalType: partial.dismissalType ?? null,
    dismissedId: partial.dismissedId ?? null,
    fielderId: partial.fielderId ?? null,
    fielder2Id: partial.fielder2Id ?? null,
  };
}

describe('inningsAcceptsDelivery (end-innings confirm gate)', () => {
  it('still accepts deliveries when only natural close conditions apply (no END_INNINGS)', () => {
    // Six legal balls with oversAllotted=1 would close via OversComplete in deriveInnings,
    // but without END_INNINGS the scorer may still correct after Cancel.
    const events = [1, 2, 3, 4, 5, 6].map((ballNumber) =>
      event({ type: DeliveryType.Legal, sequence: ballNumber, overNumber: 1, ballNumber }),
    );
    expect(inningsOfficiallyEnded(events)).toBe(false);
    expect(inningsAcceptsDelivery(events)).toBe(true);
  });

  it('rejects further deliveries after an official END_INNINGS event', () => {
    const events = [
      event({ type: DeliveryType.Legal, sequence: 1 }),
      event({
        type: DeliveryType.EndInnings,
        sequence: 2,
        overNumber: null,
        ballNumber: null,
        strikerId: null,
        nonStrikerId: null,
        bowlerId: null,
      }),
    ];
    expect(inningsOfficiallyEnded(events)).toBe(true);
    expect(inningsAcceptsDelivery(events)).toBe(false);
  });
});
