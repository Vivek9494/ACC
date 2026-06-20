import {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE_MAX,
  type AdminOverview,
  type AdminUserDetail,
  type AdminUsersPage,
} from '@acc/types';
import { RegistrationStatus, TournamentState } from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere, activeTournamentRelationWhere } from '../tournaments/tournament-query';
import {
  buildAdminUserSearchWhere,
  toAdminUserDetail,
  toAdminUserSummary,
} from './admin.mapper';
import type { ListAdminUsersDto } from './dto/list-admin-users.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListAdminUsersDto): Promise<AdminUsersPage> {
    const limit = Math.min(query.limit ?? ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE_MAX);
    const where = buildAdminUserSearchWhere(query.q);

    const users = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        isActive: true,
        role: true,
        createdAt: true,
        roleAssignments: { select: { role: true } },
      },
    });

    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;

    return {
      items: page.map(toAdminUserSummary),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async getUser(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        isActive: true,
        role: true,
        createdAt: true,
        email: true,
        dateOfBirth: true,
        jerseyNumber: true,
        jerseyName: true,
        center: {
          select: {
            name: true,
            province: { select: { name: true } },
          },
        },
        roleAssignments: {
          select: {
            role: true,
            centerId: true,
            tournamentId: true,
            teamId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const centerIds = user.roleAssignments
      .map((row) => row.centerId)
      .filter((id): id is string => Boolean(id));
    const tournamentIds = user.roleAssignments
      .map((row) => row.tournamentId)
      .filter((id): id is string => Boolean(id));
    const teamIds = user.roleAssignments
      .map((row) => row.teamId)
      .filter((id): id is string => Boolean(id));

    const [centers, tournaments, teams] = await Promise.all([
      centerIds.length > 0
        ? this.prisma.center.findMany({
            where: { id: { in: centerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      tournamentIds.length > 0
        ? this.prisma.tournament.findMany({
            where: { id: { in: tournamentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      teamIds.length > 0
        ? this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const centerNameById = new Map(centers.map((center) => [center.id, center.name]));
    const tournamentNameById = new Map(tournaments.map((row) => [row.id, row.name]));
    const teamNameById = new Map(teams.map((row) => [row.id, row.name]));

    return toAdminUserDetail(
      {
        ...user,
        roleAssignments: user.roleAssignments.map((row) => ({
          role: row.role,
          centerId: row.centerId,
          tournament: row.tournamentId
            ? { name: tournamentNameById.get(row.tournamentId) ?? 'Unknown tournament' }
            : null,
          team: row.teamId ? { name: teamNameById.get(row.teamId) ?? 'Unknown team' } : null,
        })),
      },
      centerNameById,
    );
  }

  async getOverview(): Promise<AdminOverview> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
    ] = await Promise.all([
      this.prisma.province.count({ where: { isActive: true } }),
      this.prisma.center.count({ where: { isActive: true } }),
      this.prisma.tournament.count({
        where: { ...activeTournamentWhere, state: { not: TournamentState.Completed } },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.tournament.count({ where: activeTournamentWhere }),
      this.prisma.match.count({
        where: {
          matchDate: { gte: todayStart, lt: todayEnd },
          ...activeTournamentRelationWhere,
        },
      }),
      this.prisma.registration.count({
        where: { status: RegistrationStatus.InWaitlist },
      }),
    ]);

    return {
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
    };
  }
}
