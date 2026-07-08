import 'reflect-metadata';

import { PrismaService } from '../prisma/prisma.service';
import {
  countGroupBlockingLiveMatches,
  resolveGroupBlockingLiveMatchCounts,
} from './group-match-query';

describe('group-match-query', () => {
  const tournamentId = 'tour-1';
  const divisionE = 'group-e';
  const divisionA = 'group-a';

  it('resolveGroupBlockingLiveMatchCounts ignores orphaned fixtures', async () => {
    const prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            groupId: divisionE,
            homeTeam: { groupId: divisionA },
            awayTeam: { groupId: divisionA },
          },
          {
            groupId: divisionE,
            homeTeam: { groupId: divisionE },
            awayTeam: { groupId: divisionA },
          },
        ]),
      },
    };

    const counts = await resolveGroupBlockingLiveMatchCounts(
      prisma as unknown as PrismaService,
      tournamentId,
      [divisionE],
    );

    expect(counts.get(divisionE)).toBe(1);
  });

  it('countGroupBlockingLiveMatches uses team-in-group filter', async () => {
    const prisma = {
      match: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    await countGroupBlockingLiveMatches(
      prisma as unknown as PrismaService,
      tournamentId,
      divisionE,
    );

    expect(prisma.match.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tournamentId,
        groupId: divisionE,
        isDeleted: false,
        OR: expect.any(Array),
      }),
    });
  });
});
