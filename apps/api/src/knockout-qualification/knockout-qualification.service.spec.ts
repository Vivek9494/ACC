import {
  QualificationReadinessStatus,
  TournamentType,
} from '@acc/types';

import { KnockoutQualificationService } from './knockout-qualification.service';

describe('KnockoutQualificationService', () => {
  const prisma = {
    tournament: { findUnique: jest.fn() },
    match: { count: jest.fn() },
  };
  const standings = { getStandings: jest.fn() };

  const service = new KnockoutQualificationService(
    prisma as never,
    standings as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns NOT_APPLICABLE for non-APL tournaments', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      isDeleted: false,
      type: TournamentType.Center,
      knockoutTeamCount: 12,
      _count: { groups: 4 },
    });

    await expect(service.getQualification('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotApplicable,
    });
  });

  it('returns NOT_CONFIGURED when knockout team count is unset', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      isDeleted: false,
      type: TournamentType.APL,
      knockoutTeamCount: null,
      _count: { groups: 7 },
    });

    await expect(service.getQualification('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotConfigured,
    });
  });

  it('returns NOT_READY with match counts when group fixtures are incomplete', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      isDeleted: false,
      type: TournamentType.APL,
      knockoutTeamCount: 12,
      _count: { groups: 7 },
    });
    prisma.match.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(3);

    await expect(service.getQualification('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotReady,
      scheduledGroupMatchCount: 42,
      incompleteGroupMatchCount: 3,
    });
    expect(standings.getStandings).not.toHaveBeenCalled();
  });

  it('returns NOT_READY when no group-stage matches are scheduled', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      isDeleted: false,
      type: TournamentType.APL,
      knockoutTeamCount: 12,
      _count: { groups: 7 },
    });
    prisma.match.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    await expect(service.getQualification('t1')).resolves.toEqual({
      status: QualificationReadinessStatus.NotReady,
      scheduledGroupMatchCount: 0,
      incompleteGroupMatchCount: 0,
    });
  });
});
