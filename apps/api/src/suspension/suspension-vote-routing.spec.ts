import {
  enrichPollSuspensionRows,
  isLateArrivalInPenalty,
  isLateArrivalOutPenalty,
  SuspensionStatus,
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
    suspensionStatus: SuspensionStatus.Pending,
    isCarriedForward: false,
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

  it('excludes eligible pending and carried-forward suspensions from Confirmed IN', () => {
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
      {
        userId: 'player-3',
        firstName: 'C',
        lastName: 'Three',
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
          suspensionStatus: SuspensionStatus.Pending,
          isCarriedForward: false,
        },
        {
          ...baseRow,
          userId: 'player-3',
          suspensionId: 'susp-3',
          firstName: 'C',
          lastName: 'Three',
          suspensionStatus: SuspensionStatus.CarriedForward,
          isCarriedForward: true,
        },
      ],
      new Map([
        ['player-1', true],
        ['player-2', true],
        ['player-3', true],
      ]),
    );

    const { confirmedIn, servingSuspensionPenalty } = partitionPollConfirmedInVoters({
      inVoters,
      pendingSuspensions: pending,
      actionedSuspensions: [],
    });

    expect(isServingSuspensionForMatch(pending[0]!)).toBe(true);
    expect(isServingSuspensionForMatch(pending[1]!)).toBe(true);
    expect(confirmedIn.map((row) => row.userId)).toEqual(['player-1']);
    expect(servingSuspensionPenalty.map((row) => row.userId)).toEqual(['player-2', 'player-3']);
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

  it('keeps actioned players in Confirmed IN even when they still owe a late-arrival penalty', () => {
    const { confirmedIn, servingSuspensionPenalty } =
      partitionPollConfirmedInVoters<PollConfirmedInPartitionRow>({
        inVoters: [
          {
            userId: 'player-3',
            firstName: 'C',
            lastName: 'Three',
            profilePhotoUrl: null,
            skillLabel: null,
          },
        ],
        pendingSuspensions: [],
        actionedSuspensions: [
          {
            userId: 'player-3',
            firstName: 'C',
            lastName: 'Three',
            profilePhotoUrl: null,
            badge: SuspensionXiBadge.CarryForward,
          },
        ],
        penaltyOwingInVoterUserIds: new Set(['player-3']),
      });

    expect(confirmedIn.map((row) => row.userId)).toEqual(['player-3']);
    expect(servingSuspensionPenalty).toEqual([]);
  });
});
