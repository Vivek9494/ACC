import { BallType } from '@acc/types';

import { TournamentTypeDefinitionsService } from './tournament-type-definitions.service';

describe('TournamentTypeDefinitionsService', () => {
  let prisma: {
    tournamentTypeDefinition: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tournamentTypeDefinitionCenter: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    tournament: { findMany: jest.Mock };
    tournamentCenter: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    province: { findUnique: jest.Mock };
    center: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: TournamentTypeDefinitionsService;

  beforeEach(() => {
    prisma = {
      tournamentTypeDefinition: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tournamentTypeDefinitionCenter: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      tournament: { findMany: jest.fn().mockResolvedValue([]) },
      tournamentCenter: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      province: { findUnique: jest.fn() },
      center: { findMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: typeof prisma) => unknown) => cb(prisma)),
    };
    service = new TournamentTypeDefinitionsService(prisma as never);
  });

  it('creates an APL type and resyncs existing APL tournament centers', async () => {
    prisma.province.findUnique.mockResolvedValue({ id: 'prov-1', isActive: true });
    prisma.tournamentTypeDefinition.findFirst.mockResolvedValue(null);
    prisma.center.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    prisma.tournament.findMany.mockResolvedValue([{ id: 'apl-tour-1' }]);
    prisma.tournamentTypeDefinition.create.mockResolvedValue({
      id: 'def-1',
      code: 'APL',
      name: 'APL',
      provinceId: 'prov-1',
      ballType: BallType.Tennis,
      formatConfig: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      province: { name: 'Ontario' },
      centerLinks: [
        { centerId: 'c1', center: { id: 'c1', name: 'North York' } },
        { centerId: 'c2', center: { id: 'c2', name: 'Etobicoke' } },
      ],
      _count: { centerLinks: 2 },
    });

    const result = await service.create({
      name: 'APL',
      provinceId: 'prov-1',
      ballType: BallType.Tennis,
      centerIds: ['c1', 'c2'],
    });

    expect(result.code).toBe('APL');
    expect(result.centerIds).toEqual(['c1', 'c2']);
    expect(prisma.tournamentCenter.deleteMany).toHaveBeenCalledWith({
      where: { tournamentId: 'apl-tour-1' },
    });
    expect(prisma.tournamentCenter.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentId: 'apl-tour-1', centerId: 'c1' },
        { tournamentId: 'apl-tour-1', centerId: 'c2' },
      ],
      skipDuplicates: true,
    });
  });

  it('findActiveAplForProvince returns null when undefined', async () => {
    prisma.tournamentTypeDefinition.findFirst.mockResolvedValue(null);
    await expect(service.findActiveAplForProvince('prov-1')).resolves.toBeNull();
  });

  it('findActiveAplForProvince returns center ids', async () => {
    prisma.tournamentTypeDefinition.findFirst.mockResolvedValue({
      centerLinks: [{ centerId: 'c1' }, { centerId: 'c2' }],
    });
    await expect(service.findActiveAplForProvince('prov-1')).resolves.toEqual({
      centerIds: ['c1', 'c2'],
    });
  });
});
