import {
  MatchSchedulingFormat,
  TournamentType,
  tournamentSupportsGroups,
} from '@acc/types';

describe('tournamentSupportsGroups', () => {
  it('allows APL regardless of matchSchedulingFormat', () => {
    expect(
      tournamentSupportsGroups({
        type: TournamentType.APL,
        matchSchedulingFormat: MatchSchedulingFormat.RoundRobin,
        groupCount: 0,
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
