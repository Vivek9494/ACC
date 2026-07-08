import 'reflect-metadata';

import {
  type AuthUser,
  BallType,
  FeeStatus,
  RegistrationPlayerType,
  TournamentFeesTrackerLayout,
  UserRole,
} from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeesService } from './fees.service';

const tennisTournament = {
  id: 'tour-tennis',
  isDeleted: false,
  ballType: BallType.Tennis,
  type: 'APL',
  provinceId: 'prov-1',
  defaultPlayerFeeCents: BigInt(5000),
  feeFullTime: { toNumber: () => 250 },
  feePartTime: null,
};

const centerLevelTennisTournament = {
  ...tennisTournament,
  id: 'tour-center',
  type: 'CENTER',
};

const leatherTournament = {
  id: 'tour-acc',
  isDeleted: false,
  ballType: BallType.Leather,
  type: 'ACC',
  provinceId: 'prov-1',
  defaultPlayerFeeCents: BigInt(5000),
  feeFullTime: { toNumber: () => 300 },
  feePartTime: { toNumber: () => 150 },
};

const sevak: AuthUser = {
  id: 'sevak-1',
  firstName: 'Center',
  lastName: 'Sevak',
  mobileNumber: '+15555550002',
  email: 'sevak@acc.local',
  centerId: 'center-A',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
};

const admin: AuthUser = {
  id: 'admin-1',
  firstName: 'Admin',
  lastName: 'User',
  mobileNumber: '+15555550001',
  email: 'admin@acc.local',
  centerId: 'center-A',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.Admin,
  isActive: true,
};

const captain: AuthUser = {
  id: 'captain-1',
  firstName: 'Team',
  lastName: 'Captain',
  mobileNumber: '+15555550003',
  email: 'captain@acc.local',
  centerId: 'center-A',
  jerseyNumber: 1,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
};

const clubManager: AuthUser = {
  ...captain,
  id: 'cm-1',
  role: UserRole.ClubManager,
};

describe('FeesService', () => {
  let service: FeesService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    roleAssignment: { findMany: jest.Mock };
    registration: { findUnique: jest.Mock; findMany: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    tournamentCenter: { findMany: jest.Mock };
    province: { findUnique: jest.Mock };
    fee: { findMany: jest.Mock; upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: { findUnique: jest.fn() },
      roleAssignment: { findMany: jest.fn() },
      registration: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'reg-1', userId: 'player-1', feeAmountCents: BigInt(5000) },
          { id: 'reg-2', userId: 'player-2', feeAmountCents: BigInt(12000) },
        ]),
      },
      teamMembership: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'player-1', teamId: 'team-1' },
          { userId: 'player-2', teamId: 'team-2' },
        ]),
      },
      tournamentCenter: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      province: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Ontario' }),
      },
      fee: {
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new FeesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  it('returns a flat list for Center Sevak on a tennis tournament with display fee', async () => {
    prisma.tournament.findUnique.mockResolvedValue(tennisTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
    prisma.fee.findMany.mockResolvedValue([
      feeRow('fee-paid', 'player-1', 'team-1', 'ACC 3', 'PAID', 'center-A', 5000, 'tour-tennis'),
      feeRow('fee-unpaid', 'player-2', 'team-2', 'ACC 6', 'PENDING', 'center-A', 12000, 'tour-tennis'),
    ]);

    const result = await service.getTracker(sevak, 'tour-tennis');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.Flat);
    expect(result.ballType).toBe(BallType.Tennis);
    expect(result.paid).toHaveLength(1);
    expect(result.paid[0]?.entries).toHaveLength(1);
    expect(result.unpaid[0]?.entries[0]?.amountCents).toBe(25000);
    expect(result.unpaid[0]?.entries[0]?.cardSubtitle).toBe('Barrie Center');
  });

  it('returns grouped-by-center lists for Admin on tennis', async () => {
    prisma.tournament.findUnique.mockResolvedValue(tennisTournament);
    prisma.fee.findMany.mockResolvedValue([
      feeRow('fee-paid', 'player-1', 'team-1', 'Team A', 'PAID', 'center-A', 5000, 'tour-tennis'),
      feeRow('fee-unpaid', 'player-2', 'team-2', 'Team B', 'PENDING', 'center-B', 12000, 'tour-tennis'),
    ]);

    const result = await service.getTracker(admin, 'tour-tennis');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.GroupedByCenter);
    expect(result.unpaid).toHaveLength(1);
    expect(result.unpaid[0]?.teamName).toBe('Mississauga Center');
    expect(result.unpaid[0]?.entries[0]?.amountCents).toBe(25000);
  });

  it('rejects Center Sevak on a leather ACC tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValue(leatherTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);

    await expect(service.getTracker(sevak, 'tour-acc')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns grouped-by-center lists for Club Manager on all-centers tennis (APL)', async () => {
    prisma.tournament.findUnique.mockResolvedValue(tennisTournament);
    prisma.fee.findMany.mockResolvedValue([
      feeRow('fee-paid', 'player-1', 'team-1', 'Team A', 'PAID', 'center-A', 5000, 'tour-tennis'),
      feeRow('fee-unpaid', 'player-2', 'team-2', 'Team B', 'PENDING', 'center-B', 12000, 'tour-tennis'),
    ]);

    const result = await service.getTracker(clubManager, 'tour-tennis');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.GroupedByCenter);
    expect(result.unpaid).toHaveLength(1);
    expect(result.unpaid[0]?.teamName).toBe('Mississauga Center');
  });

  it('forbids Club Manager on a center-level tennis tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValue(centerLevelTennisTournament);
    prisma.tournamentCenter.findMany.mockResolvedValue([
      {
        center: { name: 'Barrie Center', province: { name: 'Ontario' } },
      },
    ]);

    await expect(service.getTracker(clubManager, 'tour-center')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns leather full-time and part-time display fees for grouped teams', async () => {
    prisma.tournament.findUnique.mockResolvedValue(leatherTournament);
    prisma.fee.findMany.mockResolvedValue([
      feeRow(
        'fee-unpaid-ft',
        'player-1',
        'team-1',
        'ACC 3',
        'PENDING',
        'center-A',
        5000,
        'tour-acc',
        RegistrationPlayerType.FullTime,
      ),
      feeRow(
        'fee-unpaid-pt',
        'player-2',
        'team-2',
        'ACC 6',
        'PENDING',
        'center-A',
        12000,
        'tour-acc',
        RegistrationPlayerType.PartTime,
      ),
    ]);

    const result = await service.getTracker(clubManager, 'tour-acc');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.GroupedByTeam);
    const unpaid = result.unpaid.flatMap((group) => group.entries);
    expect(unpaid.find((entry) => entry.userId === 'player-1')?.amountCents).toBe(30000);
    expect(unpaid.find((entry) => entry.userId === 'player-2')?.amountCents).toBe(15000);
    expect(unpaid.find((entry) => entry.userId === 'player-1')?.cardSubtitle).toBe(
      'ACC 3 · Full-time Player',
    );
  });

  it('returns a flat own-team list for Captain on leather', async () => {
    prisma.tournament.findUnique.mockResolvedValue(leatherTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    prisma.fee.findMany.mockResolvedValue([
      feeRow(
        'fee-unpaid',
        'player-1',
        'team-1',
        'ACC 3',
        'PENDING',
        'center-A',
        5000,
        'tour-acc',
        RegistrationPlayerType.FullTime,
      ),
    ]);

    const result = await service.getTracker(captain, 'tour-acc');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.Flat);
    expect(result.unpaidCount).toBe(1);
    expect(result.unpaid[0]?.entries[0]?.cardSubtitle).toBe('ACC 3 · Full-time Player');
  });

  it('returns grouped-by-team lists for Club Manager on leather', async () => {
    prisma.tournament.findUnique.mockResolvedValue(leatherTournament);
    prisma.fee.findMany.mockResolvedValue([
      feeRow('fee-paid', 'player-1', 'team-1', 'ACC 3', 'PAID', 'center-A', 5000, 'tour-acc'),
      feeRow('fee-unpaid', 'player-2', 'team-2', 'ACC 6', 'PENDING', 'center-A', 12000, 'tour-acc'),
    ]);

    const result = await service.getTracker(clubManager, 'tour-acc');

    expect(result.layout).toBe(TournamentFeesTrackerLayout.GroupedByTeam);
    expect(result.paid).toHaveLength(1);
    expect(result.unpaid).toHaveLength(1);
    expect(result.paid[0]?.teamName).toBe('ACC 3');
  });

  it('marks a pending fee as paid and audit-logs the change', async () => {
    prisma.tournament.findUnique.mockResolvedValue(tennisTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
    prisma.fee.findUnique.mockResolvedValue(
      feeRow('fee-unpaid', 'player-2', 'team-2', 'ACC 6', 'PENDING', 'center-A', 12000, 'tour-tennis'),
    );
    prisma.fee.update.mockResolvedValue(
      feeRow('fee-unpaid', 'player-2', 'team-2', 'ACC 6', 'PAID', 'center-A', 12000, 'tour-tennis'),
    );

    const result = await service.markPaid(sevak, 'tour-tennis', 'fee-unpaid');

    expect(result.status).toBe(FeeStatus.Paid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FEE_PAYMENT_RECORDED' }),
    );
  });

  it('forbids Captain from marking a fee outside their team', async () => {
    prisma.tournament.findUnique.mockResolvedValue(leatherTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    prisma.fee.findUnique.mockResolvedValue(
      feeRow('fee-unpaid', 'player-2', 'team-2', 'ACC 6', 'PENDING', 'center-A', 5000, 'tour-acc'),
    );

    await expect(service.markPaid(captain, 'tour-acc', 'fee-unpaid')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects marking an already paid fee', async () => {
    prisma.tournament.findUnique.mockResolvedValue(tennisTournament);
    prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
    prisma.fee.findUnique.mockResolvedValue(
      feeRow('fee-paid', 'player-1', 'team-1', 'ACC 3', 'PAID', 'center-A', 5000, 'tour-tennis'),
    );

    await expect(service.markPaid(sevak, 'tour-tennis', 'fee-paid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function feeRow(
  id: string,
  userId: string,
  teamId: string,
  teamName: string,
  status: 'PAID' | 'PENDING',
  centerId: string,
  amountCents = 5000,
  tournamentId = 'tour-1',
  playerType: RegistrationPlayerType | null = null,
): Record<string, unknown> {
  const centerNames: Record<string, string> = {
    'center-A': 'Barrie Center',
    'center-B': 'Mississauga Center',
  };

  return {
    id,
    tournamentId,
    userId,
    registrationId: `reg-${userId}`,
    teamId,
    amountCents: BigInt(amountCents),
    status,
    paidAt: status === 'PAID' ? new Date('2026-06-01T00:00:00.000Z') : null,
    user: {
      firstName: 'Player',
      lastName: userId,
      profilePhotoUrl: null,
    },
    team: { name: teamName },
    registration: {
      id: `reg-${userId}`,
      centerId,
      playerType,
      center: { name: centerNames[centerId] ?? 'Unassigned' },
    },
  };
}
