import {
  type AuthUser,
  GROUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  normalizeGroupName,
  Permission,
  type GroupSummary,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';
import type { CreateGroupDto } from './dto/create-group.dto';

const GROUP_NAME_TAKEN = GROUP_FORM_MESSAGES.name.duplicate;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly tournaments: TournamentsService,
  ) {}

  async list(tournamentId: string): Promise<GroupSummary[]> {
    await this.requireTournament(tournamentId);
    const rows = await this.prisma.tournamentGroup.findMany({
      where: { tournamentId },
      orderBy: { name: 'asc' },
      include: {
        teams: {
          orderBy: { name: 'asc' },
          include: { _count: { select: { memberships: true } } },
        },
      },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async create(actor: AuthUser, tournamentId: string, dto: CreateGroupDto): Promise<GroupSummary> {
    const tournament = await this.requireTournament(tournamentId);

    const allowed = await this.permissions.check(Permission.CREATE_MATCH, actor, { tournamentId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage tournament groups',
        error: 'FORBIDDEN',
      });
    }

    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);

    if (tournament.matchSchedulingFormat !== MatchSchedulingFormat.GroupStageKnockout) {
      throw new BadRequestException({
        message: 'Groups can only be created for Group Stage + Knockout tournaments',
        error: 'INVALID_SCHEDULING_FORMAT',
      });
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'Group name is required',
        error: 'GROUP_NAME_REQUIRED',
        fields: { name: 'Group name is required' },
      });
    }

    const nameNormalized = normalizeGroupName(name);
    await this.assertGroupNameAvailable(tournamentId, nameNormalized);

    const teamIds = [...new Set(dto.teamIds ?? [])];
    if (teamIds.length > 0) {
      await this.assertTeamsAssignable(tournamentId, teamIds);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const group = await tx.tournamentGroup.create({
          data: { tournamentId, name, nameNormalized },
        });

        if (teamIds.length > 0) {
          const updated = await tx.team.updateMany({
            where: {
              id: { in: teamIds },
              tournamentId,
              groupId: null,
            },
            data: { groupId: group.id },
          });
          if (updated.count !== teamIds.length) {
            throw new BadRequestException({
              message: 'One or more teams are already assigned to another group',
              error: 'TEAM_ALREADY_GROUPED',
            });
          }
        }

        return tx.tournamentGroup.findUniqueOrThrow({
          where: { id: group.id },
          include: {
            teams: {
              orderBy: { name: 'asc' },
              include: { _count: { select: { memberships: true } } },
            },
          },
        });
      });

      return this.toSummary(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.groupNameTakenException();
      }
      throw err;
    }
  }

  async assertGroupNameAvailable(
    tournamentId: string,
    nameNormalized: string,
    excludeGroupId?: string,
  ): Promise<void> {
    const existing = await this.prisma.tournamentGroup.findFirst({
      where: {
        tournamentId,
        nameNormalized,
        ...(excludeGroupId ? { id: { not: excludeGroupId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw this.groupNameTakenException();
    }
  }

  private async assertTeamsAssignable(tournamentId: string, teamIds: string[]): Promise<void> {
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds }, tournamentId },
      select: { id: true, groupId: true, group: { select: { name: true } } },
    });

    if (teams.length !== teamIds.length) {
      throw new BadRequestException({
        message: 'One or more teams do not belong to this tournament',
        error: 'TEAM_NOT_IN_TOURNAMENT',
      });
    }

    const assigned = teams.find((team) => team.groupId != null);
    if (assigned) {
      throw new BadRequestException({
        message: `Team is already in ${assigned.group?.name ?? 'another group'}`,
        error: 'TEAM_ALREADY_GROUPED',
        fields: { teamIds: `Team is already in ${assigned.group?.name ?? 'another group'}` },
      });
    }
  }

  private groupNameTakenException(): BadRequestException {
    return new BadRequestException({
      message: GROUP_NAME_TAKEN,
      error: 'GROUP_NAME_TAKEN',
      fields: { name: GROUP_NAME_TAKEN },
    });
  }

  private async requireTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    assertTournamentActive(tournament);
    return tournament;
  }

  private toSummary(row: {
    id: string;
    tournamentId: string;
    name: string;
    teams: {
      id: string;
      name: string;
      logoUrl: string | null;
      _count: { memberships: number };
    }[];
  }): GroupSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      name: row.name,
      teams: row.teams.map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        memberCount: team._count.memberships,
      })),
    };
  }
}
