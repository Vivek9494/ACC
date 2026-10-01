import 'reflect-metadata';

import {
  AUDIT_LOG_RETENTION_DAYS,
  UserRole,
  type AuditLogPage,
  type AuthUser,
  type Permission,
  type PermissionContext,
} from '@acc/types';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { MatchScorerGrantService } from '../authz/match-scorer.service';
import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { AuditLogRetentionService } from './audit-log-retention.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

function user(role: UserRole): AuthUser {
  return {
    id: `${role}-1`,
    firstName: 'Test',
    lastName: role,
    mobileNumber: '+15555550001',
    email: 'test@acc.local',
    centerId: 'center-A',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    role,
    isActive: true,
    teamLeadAssignments: [],
  };
}

class HeaderRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const role = req.headers['x-test-role'];
    if (role) {
      req.user = user(role as UserRole);
    }
    return true;
  }
}

const FROM = '2026-09-30T04:00:00.000Z';
const TO = '2026-10-01T04:00:00.000Z';

function logRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    action: 'TOURNAMENT_UPDATED',
    actorUserId: 'admin-1',
    actorLabel: null,
    targetUserId: null,
    targetEntityType: 'tournament',
    targetEntityId: 'tour-1',
    before: { name: 'Old' },
    after: { name: 'New' },
    details: null,
    createdAt: new Date('2026-09-30T14:00:00.000Z'),
    ...overrides,
  };
}

describe('Audit logs endpoint', () => {
  let app: INestApplication;
  let baseUrl: string;
  const empty = () => jest.fn().mockResolvedValue([]);
  const prisma = {
    auditLog: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    user: { findMany: jest.fn() },
    tournament: { findMany: empty() },
    team: { findMany: empty() },
    match: { findMany: empty() },
    center: { findMany: empty() },
    province: { findMany: empty() },
    tournamentGroup: { findMany: empty() },
    tournamentTypeDefinition: { findMany: empty() },
    registration: { findMany: empty() },
  };

  beforeAll(async () => {
    const matrix = new PermissionService(
      {} as PrismaService,
      {} as MatchScorerGrantService,
    );
    const permissions = {
      check: jest.fn(async (permission: Permission, actor: AuthUser) => {
        const ctx: PermissionContext = { subjects: [actor.role] };
        return matrix.evaluate(permission, ctx);
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        AuditLogsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderRoleGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `${await app.getUrl()}/admin/audit-logs`.replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([logRow()]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', firstName: 'Asha', lastName: 'Admin', role: UserRole.Admin },
    ]);
    prisma.tournament.findMany.mockResolvedValue([{ id: 'tour-1', name: 'APL 2026' }]);
  });

  const query = `?from=${FROM}&to=${TO}`;

  it.each([UserRole.ClubManager, UserRole.CenterSevak, UserRole.Player])('returns 403 for %s', async (role) => {
    const responses = await Promise.all([
      fetch(`${baseUrl}${query}`, { headers: { 'x-test-role': role } }),
      fetch(`${baseUrl}/filters${query}`, { headers: { 'x-test-role': role } }),
    ]);
    expect(responses.map((res) => res.status)).toEqual([403, 403]);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('returns 401 without a signed-in user', async () => {
    const res = await fetch(`${baseUrl}${query}`);
    expect(res.status).toBe(401);
  });

  it('lists a page for Admin with actor and entity names resolved', async () => {
    const res = await fetch(`${baseUrl}${query}&page=2&pageSize=10`, {
      headers: { 'x-test-role': UserRole.Admin },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AuditLogPage;
    expect(body).toMatchObject({ page: 2, pageSize: 10, totalCount: 1 });
    expect(body.items[0]).toMatchObject({
      action: 'TOURNAMENT_UPDATED',
      createdAt: '2026-09-30T14:00:00.000Z',
      actor: { userId: 'admin-1', name: 'Asha Admin', role: UserRole.Admin },
      entity: { type: 'tournament', id: 'tour-1', name: 'APL 2026' },
      before: { name: 'Old' },
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: new Date(FROM), lt: new Date(TO) } },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('applies actor, action and entity-type filters (System = null actor)', async () => {
    await fetch(`${baseUrl}${query}&actorUserId=System&action=MATCH_UPDATED&entityType=match`, {
      headers: { 'x-test-role': UserRole.Admin },
    });
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      createdAt: { gte: new Date(FROM), lt: new Date(TO) },
      actorUserId: null,
      action: 'MATCH_UPDATED',
      targetEntityType: { equals: 'match', mode: 'insensitive' },
    });
  });

  it.each([
    ['reversed range', `?from=${TO}&to=${FROM}`],
    ['range over 31 days', '?from=2026-08-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z'],
    ['missing dates', ''],
  ])('rejects a %s', async (_label, q) => {
    const res = await fetch(`${baseUrl}${q}`, { headers: { 'x-test-role': UserRole.Admin } });
    expect(res.status).toBe(400);
  });

  it('shows System and deleted actors', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      logRow({ id: 'a', actorUserId: null, actorLabel: 'System' }),
      logRow({ id: 'b', actorUserId: 'gone-1' }),
    ]);
    const res = await fetch(`${baseUrl}${query}`, { headers: { 'x-test-role': UserRole.Admin } });
    const body = (await res.json()) as AuditLogPage;
    expect(body.items.map((item) => item.actor.name)).toEqual(['System', 'Deleted user']);
  });

  it('returns filter options for the range', async () => {
    prisma.auditLog.groupBy
      .mockResolvedValueOnce([{ action: 'MATCH_UPDATED' }, { action: 'TOURNAMENT_UPDATED' }])
      .mockResolvedValueOnce([{ targetEntityType: 'User' }, { targetEntityType: 'user' }, { targetEntityType: null }])
      .mockResolvedValueOnce([{ actorUserId: 'admin-1' }, { actorUserId: null }]);
    const res = await fetch(`${baseUrl}/filters${query}`, { headers: { 'x-test-role': UserRole.Admin } });
    expect(await res.json()).toEqual({
      actions: ['MATCH_UPDATED', 'TOURNAMENT_UPDATED'],
      entityTypes: ['user'],
      actors: [
        { userId: 'admin-1', name: 'Asha Admin', role: UserRole.Admin },
        { userId: null, name: 'System', role: null },
      ],
    });
  });
});

describe('AuditLogRetentionService', () => {
  function setup(batches: Array<Array<{ id: string }>>) {
    const findMany = jest.fn();
    for (const batch of batches) {
      findMany.mockResolvedValueOnce(batch);
    }
    findMany.mockResolvedValue([]);
    const prisma = {
      auditLog: {
        findMany,
        deleteMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => ({
          count: where.id.in.length,
        })),
      },
      passwordResetOtpSend: { deleteMany: jest.fn(), findMany: jest.fn() },
    };
    const redis = { acquireLock: jest.fn().mockResolvedValue(true) };
    const service = new AuditLogRetentionService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
    );
    return { service, prisma, redis };
  }

  it('deletes only audit-log rows older than the retention window, in batches', async () => {
    const full = Array.from({ length: 5000 }, (_, i) => ({ id: `old-${i}` }));
    const { service, prisma } = setup([full, [{ id: 'old-last' }]]);
    const now = new Date('2026-09-30T07:30:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    await service.runDaily();

    const cutoff = new Date(now - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: 5000,
    });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.deleteMany.mock.calls[1]?.[0]).toEqual({ where: { id: { in: ['old-last'] } } });
    expect(prisma.passwordResetOtpSend.deleteMany).not.toHaveBeenCalled();
    expect(prisma.passwordResetOtpSend.findMany).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('skips when another replica holds the lock', async () => {
    const { service, prisma, redis } = setup([[{ id: 'x' }]]);
    redis.acquireLock.mockResolvedValue(false);
    await service.runDaily();
    expect(redis.acquireLock).toHaveBeenCalledWith('cron:audit-log-retention', 1800);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('returns the number removed', async () => {
    const { service } = setup([[{ id: 'a' }, { id: 'b' }]]);
    await expect(service.purgeOlderThan(new Date())).resolves.toBe(2);
  });
});
