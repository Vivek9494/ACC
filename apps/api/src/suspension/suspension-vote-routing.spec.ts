import {
  enrichPollSuspensionRows,
  isLateArrivalInPenalty,
  isLateArrivalOutPenalty,
  isPenaltyUnavailableToServe,
  SuspensionPollVoteSide,
} from '@acc/types';

describe('suspension vote routing', () => {
  const baseRow = {
    suspensionId: 'susp-1',
    userId: 'player-1',
    firstName: 'A',
    lastName: 'B',
    profilePhotoUrl: null,
    triggeredByMatchId: 'match-1',
  };

  it('routes voted-IN penalty players to IN-side late arrival with actions', () => {
    const rows = enrichPollSuspensionRows([baseRow], new Map([['player-1', true]]));
    expect(rows[0]?.pollVoteSide).toBe(SuspensionPollVoteSide.In);
    expect(rows[0]?.actionsEnabled).toBe(true);
    expect(isLateArrivalInPenalty(rows[0]!)).toBe(true);
  });

  it('treats OUT vote and no vote identically for serve eligibility', () => {
    expect(isPenaltyUnavailableToServe(SuspensionPollVoteSide.Out)).toBe(true);
    expect(isPenaltyUnavailableToServe(SuspensionPollVoteSide.Pending)).toBe(true);
    expect(isPenaltyUnavailableToServe(SuspensionPollVoteSide.In)).toBe(false);

    const out = enrichPollSuspensionRows([baseRow], new Map([['player-1', false]]));
    const pending = enrichPollSuspensionRows([baseRow], new Map());
    expect(isLateArrivalOutPenalty(out[0]!)).toBe(true);
    expect(isLateArrivalOutPenalty(pending[0]!)).toBe(true);
    expect(out[0]?.actionsEnabled).toBe(pending[0]?.actionsEnabled);
  });
});
