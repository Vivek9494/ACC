import {
  AUDIT_LOG_MAX_RANGE_DAYS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_SYSTEM_ACTOR_LABEL,
  AuditEntityType,
  type AuditJsonValue,
  type AuditLogActorView,
  type AuditLogFilterOptions,
  type AuditLogPage,
  type ListAuditLogsParams,
  type UserRole,
} from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETED_USER_LABEL = 'Deleted user';

type AuditLogRow = Prisma.AuditLogGetPayload<Record<string, never>>;

interface UserName {
  name: string;
  role: UserRole;
}

function toAuditJson(value: Prisma.JsonValue): AuditJsonValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toAuditJson(item));
  }
  const out: { [key: string]: AuditJsonValue } = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      out[key] = toAuditJson(child);
    }
  }
  return out;
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim() || '—';
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListAuditLogsParams): Promise<AuditLogPage> {
    const where = this.whereFor(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? AUDIT_LOG_PAGE_SIZE;

    const [totalCount, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const userIds = rows.flatMap((row) =>
      [row.actorUserId, row.targetUserId].filter((id): id is string => Boolean(id)),
    );
    const [users, entityNames] = await Promise.all([
      this.userNames(userIds),
      this.entityNames(rows),
    ]);

    return {
      page,
      pageSize,
      totalCount,
      items: rows.map((row) => {
        const entityKey = `${row.targetEntityType?.toLowerCase() ?? ''}:${row.targetEntityId ?? ''}`;
        const targetUser =
          row.targetUserId &&
          !(row.targetEntityType?.toLowerCase() === AuditEntityType.User && row.targetEntityId === row.targetUserId)
            ? { id: row.targetUserId, name: users.get(row.targetUserId)?.name ?? DELETED_USER_LABEL }
            : null;
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          action: row.action,
          actor: this.actorView(row, users),
          entity: {
            type: row.targetEntityType,
            id: row.targetEntityId,
            name: entityNames.get(entityKey) ?? null,
          },
          targetUser,
          before: row.before === null ? null : toAuditJson(row.before),
          after: row.after === null ? null : toAuditJson(row.after),
          details: row.details === null ? null : toAuditJson(row.details),
        };
      }),
    };
  }

  async filterOptions(params: Pick<ListAuditLogsParams, 'from' | 'to'>): Promise<AuditLogFilterOptions> {
    const where = this.whereFor(params);
    const [actions, entityTypes, actors] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ['action'], where, orderBy: { action: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['targetEntityType'], where }),
      this.prisma.auditLog.groupBy({ by: ['actorUserId'], where }),
    ]);

    const actorIds = actors
      .map((row) => row.actorUserId)
      .filter((id): id is string => Boolean(id));
    const users = await this.userNames(actorIds);
    const actorViews: AuditLogActorView[] = actorIds
      .map((id) => ({
        userId: id,
        name: users.get(id)?.name ?? DELETED_USER_LABEL,
        role: users.get(id)?.role ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (actors.some((row) => row.actorUserId === null)) {
      actorViews.push({ userId: null, name: AUDIT_SYSTEM_ACTOR_LABEL, role: null });
    }

    return {
      actions: actions.map((row) => row.action),
      entityTypes: [
        ...new Set(
          entityTypes
            .map((row) => row.targetEntityType?.toLowerCase())
            .filter((type): type is string => Boolean(type)),
        ),
      ].sort(),
      actors: actorViews,
    };
  }

  private whereFor(
    params: Pick<ListAuditLogsParams, 'from' | 'to' | 'actorUserId' | 'action' | 'entityType'>,
  ): Prisma.AuditLogWhereInput {
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('`from` must be before `to`');
    }
    if (to.getTime() - from.getTime() > AUDIT_LOG_MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException(`Pick a range of at most ${AUDIT_LOG_MAX_RANGE_DAYS} days`);
    }

    const where: Prisma.AuditLogWhereInput = { createdAt: { gte: from, lt: to } };
    if (params.actorUserId === AUDIT_SYSTEM_ACTOR_LABEL) {
      where.actorUserId = null;
    } else if (params.actorUserId) {
      where.actorUserId = params.actorUserId;
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.entityType) {
      where.targetEntityType = { equals: params.entityType, mode: 'insensitive' };
    }
    return where;
  }

  private actorView(row: AuditLogRow, users: Map<string, UserName>): AuditLogActorView {
    if (!row.actorUserId) {
      return { userId: null, name: row.actorLabel ?? AUDIT_SYSTEM_ACTOR_LABEL, role: null };
    }
    const user = users.get(row.actorUserId);
    return {
      userId: row.actorUserId,
      name: user?.name ?? row.actorLabel ?? DELETED_USER_LABEL,
      role: user?.role ?? null,
    };
  }

  private async userNames(ids: string[]): Promise<Map<string, UserName>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    return new Map(users.map((user) => [user.id, { name: fullName(user), role: user.role }]));
  }

  /** `type:id` → display name for the entity types we can look up. */
  private async entityNames(rows: AuditLogRow[]): Promise<Map<string, string>> {
    const idsByType = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.targetEntityType || !row.targetEntityId) {
        continue;
      }
      const type = row.targetEntityType.toLowerCase();
      const set = idsByType.get(type) ?? new Set<string>();
      set.add(row.targetEntityId);
      idsByType.set(type, set);
    }
    const ids = (type: AuditEntityType): string[] => [...(idsByType.get(type) ?? [])];
    const names = new Map<string, string>();
    const put = (type: AuditEntityType, id: string, name: string): void => {
      names.set(`${type}:${id}`, name);
    };

    const [tournaments, teams, matches, users, centers, provinces, groups, types, registrations] =
      await Promise.all([
        this.prisma.tournament.findMany({
          where: { id: { in: ids(AuditEntityType.Tournament) } },
          select: { id: true, name: true },
        }),
        this.prisma.team.findMany({
          where: { id: { in: ids(AuditEntityType.Team) } },
          select: { id: true, name: true, tournament: { select: { name: true } } },
        }),
        this.prisma.match.findMany({
          where: { id: { in: ids(AuditEntityType.Match) } },
          select: {
            id: true,
            externalOpponentName: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
            tournament: { select: { name: true } },
          },
        }),
        this.userNames(ids(AuditEntityType.User)),
        this.prisma.center.findMany({
          where: { id: { in: ids(AuditEntityType.Center) } },
          select: { id: true, name: true },
        }),
        this.prisma.province.findMany({
          where: { id: { in: ids(AuditEntityType.Province) } },
          select: { id: true, name: true },
        }),
        this.prisma.tournamentGroup.findMany({
          where: { id: { in: ids(AuditEntityType.Group) } },
          select: { id: true, name: true, tournament: { select: { name: true } } },
        }),
        this.prisma.tournamentTypeDefinition.findMany({
          where: { id: { in: ids(AuditEntityType.TournamentTypeDefinition) } },
          select: { id: true, name: true },
        }),
        this.prisma.registration.findMany({
          where: { id: { in: ids(AuditEntityType.Registration) } },
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            tournament: { select: { name: true } },
          },
        }),
      ]);

    for (const row of tournaments) put(AuditEntityType.Tournament, row.id, row.name);
    for (const row of teams) put(AuditEntityType.Team, row.id, `${row.name} · ${row.tournament.name}`);
    for (const row of matches) {
      const home = row.homeTeam?.name ?? 'TBD';
      const away = row.awayTeam?.name ?? row.externalOpponentName ?? 'TBD';
      put(AuditEntityType.Match, row.id, `${home} vs ${away} · ${row.tournament.name}`);
    }
    for (const [id, user] of users) put(AuditEntityType.User, id, user.name);
    for (const row of centers) put(AuditEntityType.Center, row.id, row.name);
    for (const row of provinces) put(AuditEntityType.Province, row.id, row.name);
    for (const row of groups) put(AuditEntityType.Group, row.id, `${row.name} · ${row.tournament.name}`);
    for (const row of types) put(AuditEntityType.TournamentTypeDefinition, row.id, row.name);
    for (const row of registrations) {
      put(AuditEntityType.Registration, row.id, `${fullName(row.user)} · ${row.tournament.name}`);
    }
    return names;
  }
}
