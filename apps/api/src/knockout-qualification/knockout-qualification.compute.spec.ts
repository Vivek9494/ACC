import {
  QualificationTieKind,
  QualificationTieResolution,
  QualificationType,
  type TeamStandingRow,
} from '@acc/types';

import {
  computeKnockoutQualification,
  type GroupStandingsInput,
} from './knockout-qualification.compute';

function standingRow(
  teamId: string,
  teamName: string,
  points: number,
  netRunRate: number,
): TeamStandingRow {
  return {
    teamId,
    teamName,
    logoUrl: null,
    matches: 3,
    wins: points / 2,
    losses: 0,
    noResults: 0,
    points,
    netRunRate,
  };
}

function buildSevenGroupFixtures(): GroupStandingsInput[] {
  const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  return groupNames.map((name, groupIndex) => {
    const groupId = `group-${name}`;
    const basePoints = 8 - groupIndex;
    return {
      groupId,
      teams: [
        standingRow(`${groupId}-t1`, `Group ${name} Leader`, basePoints, 1.5 - groupIndex * 0.1),
        standingRow(`${groupId}-t2`, `Group ${name} Second`, basePoints - 2, 0.8),
        standingRow(`${groupId}-t3`, `Group ${name} Third`, basePoints - 4, 0.2),
        standingRow(`${groupId}-t4`, `Group ${name} Fourth`, basePoints - 6, -0.3),
      ],
    };
  });
}

describe('computeKnockoutQualification', () => {
  it('qualifies 7 group toppers plus 5 wildcards when N=12', () => {
    const { qualifiedTeams } = computeKnockoutQualification({
      knockoutTeamCount: 12,
      groups: buildSevenGroupFixtures(),
    });

    expect(qualifiedTeams).toHaveLength(12);

    const toppers = qualifiedTeams.filter(
      (team) => team.qualificationType === QualificationType.GroupTopper,
    );
    const wildcards = qualifiedTeams.filter(
      (team) => team.qualificationType === QualificationType.Wildcard,
    );

    expect(toppers).toHaveLength(7);
    expect(wildcards).toHaveLength(5);
    expect(toppers.every((team) => team.groupRank === 1)).toBe(true);
    expect(new Set(toppers.map((team) => team.groupId)).size).toBe(7);

    const topperIds = new Set(toppers.map((team) => team.teamId));
    expect(wildcards.every((team) => !topperIds.has(team.teamId))).toBe(true);

    expect(qualifiedTeams.slice(0, 7).every((team) => team.qualificationType === QualificationType.GroupTopper)).toBe(true);
    expect(qualifiedTeams.slice(7).every((team) => team.qualificationType === QualificationType.Wildcard)).toBe(true);

    const wildcardPoints = wildcards.map((team) => team.points);
    expect(wildcardPoints).toEqual([...wildcardPoints].sort((a, b) => b - a));
  });

  it('qualifies 7 group toppers plus 9 wildcards when N=16', () => {
    const { qualifiedTeams } = computeKnockoutQualification({
      knockoutTeamCount: 16,
      groups: buildSevenGroupFixtures(),
    });

    expect(qualifiedTeams).toHaveLength(16);
    expect(
      qualifiedTeams.filter((team) => team.qualificationType === QualificationType.GroupTopper),
    ).toHaveLength(7);
    expect(
      qualifiedTeams.filter((team) => team.qualificationType === QualificationType.Wildcard),
    ).toHaveLength(9);
  });

  it('resolves a tied group topper deterministically and flags the tie', () => {
    const groupId = 'group-a';
    const { qualifiedTeams, ties } = computeKnockoutQualification({
      knockoutTeamCount: 4,
      groups: [
        {
          groupId,
          teams: [
            standingRow('a1', 'Alpha', 6, 1.0),
            standingRow('a2', 'Beta', 6, 1.0),
            standingRow('a3', 'Gamma', 4, 0.5),
          ],
        },
        {
          groupId: 'group-b',
          teams: [
            standingRow('b1', 'Bravo', 8, 1.2),
            standingRow('b2', 'Baker', 6, 0.4),
          ],
        },
        {
          groupId: 'group-c',
          teams: [
            standingRow('c1', 'Charlie', 7, 0.9),
            standingRow('c2', 'Cedar', 5, 0.1),
          ],
        },
      ],
    });

    const topper = qualifiedTeams.find(
      (team) => team.groupId === groupId && team.qualificationType === QualificationType.GroupTopper,
    );
    expect(topper?.teamId).toBe('a1');
    expect(ties).toEqual([
      expect.objectContaining({
        kind: QualificationTieKind.GroupTopper,
        groupId,
        tiedTeamIds: ['a1', 'a2'],
        resolvedBy: QualificationTieResolution.TeamName,
      }),
    ]);
  });

  it('uses head-to-head before team name for tied teams', () => {
    const { qualifiedTeams, ties } = computeKnockoutQualification({
      knockoutTeamCount: 2,
      groups: [
        {
          groupId: 'group-a',
          teams: [
            standingRow('a1', 'Zulu', 6, 1.0),
            standingRow('a2', 'Alpha', 6, 1.0),
          ],
        },
      ],
      headToHeadWinner: (teamAId, teamBId) => {
        if (teamAId === 'a1' && teamBId === 'a2') {
          return 'a2';
        }
        if (teamAId === 'a2' && teamBId === 'a1') {
          return 'a2';
        }
        return null;
      },
    });

    expect(qualifiedTeams).toHaveLength(2);
    expect(qualifiedTeams[0]?.teamId).toBe('a2');
    expect(ties[0]).toMatchObject({
      kind: QualificationTieKind.GroupTopper,
      resolvedBy: QualificationTieResolution.HeadToHead,
    });
  });

  it('flags wildcard cutoff ties when the last spot is ambiguous on points and NRR', () => {
    const groups: GroupStandingsInput[] = [
      {
        groupId: 'group-a',
        teams: [standingRow('a1', 'A Leader', 8, 1.0), standingRow('a2', 'A Second', 6, 0.5)],
      },
      {
        groupId: 'group-b',
        teams: [standingRow('b1', 'B Leader', 8, 1.0), standingRow('b2', 'B Second', 6, 0.5)],
      },
      {
        groupId: 'group-c',
        teams: [
          standingRow('c1', 'C Leader', 8, 1.0),
          standingRow('c2', 'C Second', 6, 0.5),
          standingRow('c3', 'C Third', 6, 0.5),
        ],
      },
    ];

    const { qualifiedTeams, ties } = computeKnockoutQualification({
      knockoutTeamCount: 5,
      groups,
    });

    expect(qualifiedTeams).toHaveLength(5);
    expect(
      qualifiedTeams.filter((team) => team.qualificationType === QualificationType.Wildcard),
    ).toHaveLength(2);

    const wildcardIds = qualifiedTeams
      .filter((team) => team.qualificationType === QualificationType.Wildcard)
      .map((team) => team.teamId);

    expect(wildcardIds).toContain('a2');
    expect(wildcardIds).toContain('b2');
    expect(wildcardIds).not.toContain('c3');

    expect(ties).toEqual([
      expect.objectContaining({
        kind: QualificationTieKind.WildcardCutoff,
        tiedTeamIds: expect.arrayContaining(['a2', 'b2', 'c3']),
        resolvedBy: QualificationTieResolution.TeamName,
      }),
    ]);
  });
});
