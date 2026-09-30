import {
  BallType,
  MatchSchedulingFormat,
  shouldShowGroupsTab,
  TournamentType,
  tournamentSupportsGroups,
} from '@acc/types';

describe('tournamentSupportsGroups', () => {
  it('rejects APL finalized as Round Robin with no groups', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.APL,
        matchSchedulingFormat: MatchSchedulingFormat.RoundRobin,
        groupCount: 0,
      }),
    ).toBe(false);
  });

  it('keeps APL tournaments that already have groups', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.APL,
        matchSchedulingFormat: MatchSchedulingFormat.RoundRobin,
        groupCount: 1,
      }),
    ).toBe(true);
  });

  it('allows Group Stage + Knockout scheduling for Center', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.Center,
        matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
        groupCount: 0,
      }),
    ).toBe(true);
  });

  it('allows existing groups when format is not GSK', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.Center,
        matchSchedulingFormat: MatchSchedulingFormat.Manual,
        groupCount: 2,
      }),
    ).toBe(true);
  });

  it('rejects Center manual with no groups', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.Center,
        matchSchedulingFormat: MatchSchedulingFormat.Manual,
        groupCount: 0,
      }),
    ).toBe(false);
  });

  it('rejects ACC without existing groups', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.ACC,
        matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
        groupCount: 0,
      }),
    ).toBe(false);
  });
});

describe('shouldShowGroupsTab', () => {
  const tennis = { type: TournamentType.Center, ballType: BallType.Tennis, groupCount: 0 };

  it('shows for tennis with no finalized format so the first group can be created', () => {
    expect(shouldShowGroupsTab({ ...tennis, matchSchedulingFormat: null })).toBe(true);
  });

  it('shows for Group Stage + Knockout', () => {
    expect(
      shouldShowGroupsTab({
        ...tennis,
        matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
        groupCount: 2,
      }),
    ).toBe(true);
  });

  it.each([MatchSchedulingFormat.RoundRobin, MatchSchedulingFormat.Manual])(
    'hides for tennis finalized as %s',
    (format) => {
      expect(shouldShowGroupsTab({ ...tennis, matchSchedulingFormat: format })).toBe(false);
    },
  );

  it('never shows for Leather', () => {
    expect(
      shouldShowGroupsTab({
        type: TournamentType.ACC,
        ballType: BallType.Leather,
        matchSchedulingFormat: MatchSchedulingFormat.Manual,
        groupCount: 1,
      }),
    ).toBe(false);
  });
});
