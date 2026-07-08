import {
  QualificationReadinessStatus,
  QualificationType,
} from '@acc/types';

import { KnockoutSeedingService } from './knockout-seeding.service';

describe('KnockoutSeedingService', () => {
  const qualification = { getQualification: jest.fn() };
  const service = new KnockoutSeedingService(qualification as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('propagates NOT_READY from qualification', async () => {
    qualification.getQualification.mockResolvedValue({
      status: QualificationReadinessStatus.NotReady,
      incompleteGroupMatchCount: 2,
      scheduledGroupMatchCount: 20,
    });

    await expect(service.getSeeding('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotReady,
      incompleteGroupMatchCount: 2,
      scheduledGroupMatchCount: 20,
    });
  });

  it('returns seeding when qualification is READY', async () => {
    qualification.getQualification.mockResolvedValue({
      status: QualificationReadinessStatus.Ready,
      knockoutTeamCount: 4,
      groupCount: 2,
      qualifiedTeams: [
        {
          teamId: 't1',
          teamName: 'One',
          qualificationType: QualificationType.GroupTopper,
          groupId: 'g1',
          groupRank: 1,
          points: 6,
          netRunRate: 1,
        },
        {
          teamId: 't2',
          teamName: 'Two',
          qualificationType: QualificationType.GroupTopper,
          groupId: 'g2',
          groupRank: 1,
          points: 5,
          netRunRate: 0.8,
        },
        {
          teamId: 'w1',
          teamName: 'Wild A',
          qualificationType: QualificationType.Wildcard,
          groupId: 'g3',
          groupRank: 2,
          points: 4,
          netRunRate: 0.5,
        },
        {
          teamId: 'w2',
          teamName: 'Wild B',
          qualificationType: QualificationType.Wildcard,
          groupId: 'g4',
          groupRank: 2,
          points: 3,
          netRunRate: 0.2,
        },
      ],
      ties: [],
    });

    const response = await service.getSeeding('t1');
    expect(response.status).toBe('READY');
    if (response.status !== 'READY') {
      throw new Error('Expected READY seeding response');
    }
    expect(response.seeding.knockoutTeamCount).toBe(4);
    expect(response.seeding.bracketSize).toBe(4);
    expect(response.seeding.byeCount).toBe(0);
    expect(response.seeding.round1Matches).toHaveLength(2);
  });

  it('propagates NOT_APPLICABLE for non-APL tournaments', async () => {
    qualification.getQualification.mockResolvedValue({
      status: QualificationReadinessStatus.NotApplicable,
    });

    await expect(service.getSeeding('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotApplicable,
    });
  });

  it('reorders teams when manual seed ids are provided', async () => {
    qualification.getQualification.mockResolvedValue({
      status: QualificationReadinessStatus.Ready,
      knockoutTeamCount: 4,
      groupCount: 2,
      qualifiedTeams: [
        {
          teamId: 't1',
          teamName: 'One',
          qualificationType: QualificationType.GroupTopper,
          groupId: 'g1',
          groupRank: 1,
          points: 6,
          netRunRate: 1,
        },
        {
          teamId: 't2',
          teamName: 'Two',
          qualificationType: QualificationType.GroupTopper,
          groupId: 'g2',
          groupRank: 1,
          points: 5,
          netRunRate: 0.8,
        },
        {
          teamId: 'w1',
          teamName: 'Wild A',
          qualificationType: QualificationType.Wildcard,
          groupId: 'g3',
          groupRank: 2,
          points: 4,
          netRunRate: 0.5,
        },
        {
          teamId: 'w2',
          teamName: 'Wild B',
          qualificationType: QualificationType.Wildcard,
          groupId: 'g4',
          groupRank: 2,
          points: 3,
          netRunRate: 0.2,
        },
      ],
      ties: [],
    });

    const response = await service.computeForGeneration('t1', ['w2', 'w1', 't2', 't1']);
    expect(response.status).toBe('READY');
    if (response.status !== 'READY') {
      throw new Error('Expected READY seeding response');
    }
    expect(response.seeding.seeds[0]?.teamId).toBe('w2');
    expect(response.seeding.seeds[3]?.teamId).toBe('t1');
  });
});
