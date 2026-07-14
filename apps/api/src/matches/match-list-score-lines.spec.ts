import {
  InningsType,
  MATCH_LIST_YET_TO_BAT_LABEL,
  formatMatchListTeamScoreLine,
  resolveMatchListTeamScoreLines,
} from '@acc/types';

describe('resolveMatchListTeamScoreLines', () => {
  const homeId = 'team-home';
  const awayId = 'team-away';

  it('shows batting score and Yet to Bat in innings 1', () => {
    const result = resolveMatchListTeamScoreLines({
      teamAId: homeId,
      teamBId: awayId,
      awayIsExternal: false,
      showYetToBat: true,
      innings: [
        {
          inningsType: InningsType.Normal,
          battingTeamId: homeId,
          runs: 12,
          wickets: 0,
          oversText: '2.0',
          closed: false,
        },
      ],
    });

    expect(result.teamAScoreLine).toBe('12/0 (2.0)');
    expect(result.teamBScoreLine).toBe(MATCH_LIST_YET_TO_BAT_LABEL);
  });

  it('shows both scores in innings 2 via battingTeamId', () => {
    const result = resolveMatchListTeamScoreLines({
      teamAId: homeId,
      teamBId: awayId,
      awayIsExternal: false,
      showYetToBat: true,
      innings: [
        {
          inningsType: InningsType.Normal,
          battingTeamId: awayId,
          runs: 150,
          wickets: 7,
          oversText: '20.0',
          closed: true,
        },
        {
          inningsType: InningsType.Normal,
          battingTeamId: homeId,
          runs: 40,
          wickets: 2,
          oversText: '5.3',
          closed: false,
        },
      ],
    });

    expect(result.teamAScoreLine).toBe('40/2 (5.3)');
    expect(result.teamBScoreLine).toBe('150/7 (20.0)');
  });

  it('ignores Super Over innings for under-name scores', () => {
    const result = resolveMatchListTeamScoreLines({
      teamAId: homeId,
      teamBId: awayId,
      awayIsExternal: false,
      showYetToBat: false,
      innings: [
        {
          inningsType: InningsType.Normal,
          battingTeamId: homeId,
          runs: 100,
          wickets: 5,
          oversText: '20.0',
          closed: true,
        },
        {
          inningsType: InningsType.Normal,
          battingTeamId: awayId,
          runs: 100,
          wickets: 6,
          oversText: '20.0',
          closed: true,
        },
        {
          inningsType: InningsType.SuperOver,
          battingTeamId: homeId,
          runs: 12,
          wickets: 1,
          oversText: '1.0',
          closed: true,
        },
      ],
    });

    expect(result.teamAScoreLine).toBe('100/5 (20.0)');
    expect(result.teamBScoreLine).toBe('100/6 (20.0)');
  });

  it('attributes external null battingTeamId to away only', () => {
    const result = resolveMatchListTeamScoreLines({
      teamAId: homeId,
      teamBId: null,
      awayIsExternal: true,
      showYetToBat: true,
      innings: [
        {
          inningsType: InningsType.Normal,
          battingTeamId: null,
          runs: 88,
          wickets: 3,
          oversText: '15.2',
          closed: false,
        },
      ],
    });

    expect(result.teamAScoreLine).toBe(MATCH_LIST_YET_TO_BAT_LABEL);
    expect(result.teamBScoreLine).toBe('88/3 (15.2)');
  });

  it('returns null score lines when no innings (scheduled)', () => {
    const result = resolveMatchListTeamScoreLines({
      teamAId: homeId,
      teamBId: awayId,
      awayIsExternal: false,
      showYetToBat: false,
      innings: [],
    });

    expect(result.teamAScoreLine).toBeNull();
    expect(result.teamBScoreLine).toBeNull();
  });
});

describe('formatMatchListTeamScoreLine', () => {
  it('omits wickets for closed all-out innings', () => {
    expect(
      formatMatchListTeamScoreLine([
        { runs: 142, wickets: 10, oversText: '19.4', closed: true },
      ]),
    ).toBe('142 (19.4)');
  });
});
