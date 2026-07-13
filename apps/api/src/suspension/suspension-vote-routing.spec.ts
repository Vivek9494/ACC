import {
  enrichPollSuspensionRows,
  isLateArrivalInPenalty,
  isLateArrivalOutPenalty,
  isPenaltyUnavailableToServe,
  isServingSuspensionForMatch,
  partitionPollConfirmedInVoters,
  type PollConfirmedInPartitionRow,
  SuspensionPollVoteSide,
  SuspensionXiBadge,
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

  it('partitions IN voters so serving suspensions are mutually exclusive with Confirmed IN', () => {
    const inVoters = [
      {
        userId: 'player-1',
        firstName: 'A',
        lastName: 'One',
        profilePhotoUrl: null,
        skillLabel: null,
      },
      {
        userId: 'player-2',
        firstName: 'B',
        lastName: 'Two',
        profilePhotoUrl: null,
        skillLabel: null,
      },
    ];
    const pending = enrichPollSuspensionRows(
      [
        {
          ...baseRow,
          userId: 'player-2',
          suspensionId: 'susp-2',
        },
      ],
      new Map([
        ['player-1', true],
        ['player-2', true],
      ]),
    );

    const { confirmedIn, servingSuspensionPenalty } = partitionPollConfirmedInVoters({
      inVoters,
      pendingSuspensions: pending,
      actionedSuspensions: [],
    });

    expect(isServingSuspensionForMatch(pending[0]!)).toBe(true);
    expect(confirmedIn.map((row) => row.userId)).toEqual(['player-1']);
    expect(servingSuspensionPenalty.map((row) => row.userId)).toEqual(['player-2']);
  });

  it('merges actioned suspensions into Confirmed IN after cancel or carry-forward', () => {
    const { confirmedIn, servingSuspensionPenalty } =
      partitionPollConfirmedInVoters<PollConfirmedInPartitionRow>({
        inVoters: [],
        pendingSuspensions: [],
        actionedSuspensions: [
          {
            userId: 'player-3',
            firstName: 'C',
            lastName: 'Three',
            profilePhotoUrl: null,
            badge: SuspensionXiBadge.Cancelled,
          },
        ],
      });

    expect(confirmedIn.map((row) => row.userId)).toEqual(['player-3']);
    expect(servingSuspensionPenalty).toEqual([]);
  });
});
