import {
  type AuthUser,
  formatGroupDeleteBlockedMessage,
  GROUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  normalizeGroupName,
  Permission,
  TournamentType,
  tournamentSupportsGroups,
  type GroupSummary,
  type UpdateGroupMembersRequest,
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
import { activeTeamWhere } from '../teams/team-query';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';
import type { CreateGroupDto } from './dto/create-group.dto';
import {
  countGroupBlockingLiveMatches,
  resolveGroupBlockingLiveMatchCounts,
  unlinkGroupOrphanedLiveMatches,
} from './group-match-query';

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
          where: activeTeamWhere,
          orderBy: { name: 'asc' },
          include: { _count: { select: { memberships: true } } },
        },
      },
    });
    const blockingCounts = await resolveGroupBlockingLiveMatchCounts(
      this.prisma,
      tournamentId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => this.toSummary(row, blockingCounts.get(row.id) ?? 0));
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

    this.assertTournamentSupportsGroups(tournament);

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
              where: activeTeamWhere,
              orderBy: { name: 'asc' },
              include: { _count: { select: { memberships: true } } },
            },
          },
        });
      });

      return this.toSummary(created, 0);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.groupNameTakenException();
      }
      throw err;
    }
  }

  async updateMembers(
    actor: AuthUser,
    tournamentId: string,
    groupId: string,
    dto: UpdateGroupMembersRequest,
  ): Promise<GroupSummary> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanManageGroups(actor, tournamentId);
    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);

    this.assertTournamentSupportsGroups(tournament);

    await this.requireGroup(tournamentId, groupId);
    const addTeamIds = [...new Set(dto.addTeamIds ?? [])];
    const removeTeamIds = [...new Set(dto.removeTeamIds ?? [])];

    const overlap = addTeamIds.filter((id) => removeTeamIds.includes(id));
    if (overlap.length > 0) {
      throw new BadRequestException({
        message: 'A team cannot be both added and removed in the same request',
        error: 'GROUP_MEMBER_DIFF_CONFLICT',
        fields: { teamIds: overlap.join(', ') },
      });
    }

    if (addTeamIds.length === 0 && removeTeamIds.length === 0) {
      return this.getGroupSummary(groupId);
    }

    if (addTeamIds.length > 0) {
      await this.assertTeamsAssignable(tournamentId, addTeamIds);
    }

    if (removeTeamIds.length > 0) {
      await this.assertTeamsInGroup(tournamentId, groupId, removeTeamIds);
    }

    await this.prisma.$transaction(async (tx) => {
      if (removeTeamIds.length > 0) {
        const removed = await tx.team.updateMany({
          where: {
            id: { in: removeTeamIds },
            tournamentId,
            groupId,
            ...activeTeamWhere,
          },
          data: { groupId: null },
        });
        if (removed.count !== removeTeamIds.length) {
          throw new BadRequestException({
            message: GROUP_FORM_MESSAGES.members.teamNotInGroup,
            error: 'TEAM_NOT_IN_GROUP',
          });
        }
      }

      if (addTeamIds.length > 0) {
        const added = await tx.team.updateMany({
          where: {
            id: { in: addTeamIds },
            tournamentId,
            groupId: null,
            ...activeTeamWhere,
          },
          data: { groupId },
        });
        if (added.count !== addTeamIds.length) {
          throw new BadRequestException({
            message: GROUP_FORM_MESSAGES.members.teamAlreadyGrouped,
            error: 'TEAM_ALREADY_GROUPED',
          });
        }
      }
    });

    return this.getGroupSummary(groupId);
  }

  async remove(actor: AuthUser, tournamentId: string, groupId: string): Promise<void> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanManageGroups(actor, tournamentId);
    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);

    this.assertTournamentSupportsGroups(tournament);

    await this.requireGroup(tournamentId, groupId);

    const matchCount = await countGroupBlockingLiveMatches(
      this.prisma,
      tournamentId,
      groupId,
    );
    if (matchCount > 0) {
      throw new BadRequestException({
        message: formatGroupDeleteBlockedMessage(matchCount),
        error: 'GROUP_HAS_MATCHES',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await unlinkGroupOrphanedLiveMatches(tx, tournamentId, groupId);
      await tx.team.updateMany({
        where: { tournamentId, groupId, ...activeTeamWhere },
        data: { groupId: null },
      });
      await tx.tournamentGroup.delete({ where: { id: groupId } });
    });
  }

  private async getGroupSummary(groupId: string): Promise<GroupSummary> {
    const row = await this.prisma.tournamentGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        teams: {
          where: activeTeamWhere,
          orderBy: { name: 'asc' },
          include: { _count: { select: { memberships: true } } },
        },
      },
    });
    const liveMatchCount = await countGroupBlockingLiveMatches(
      this.prisma,
      row.tournamentId,
      groupId,
    );
    return this.toSummary(row, liveMatchCount);
  }

  private async requireGroup(tournamentId: string, groupId: string) {
    const group = await this.prisma.tournamentGroup.findFirst({
      where: { id: groupId, tournamentId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        error: 'NOT_FOUND',
      });
    }
    return group;
  }

  private async assertCanManageGroups(actor: AuthUser, tournamentId: string): Promise<void> {
    const allowed = await this.permissions.check(Permission.CREATE_MATCH, actor, { tournamentId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage tournament groups',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertTeamsInGroup(
    tournamentId: string,
    groupId: string,
    teamIds: string[],
  ): Promise<void> {
    if (teamIds.length === 0) {
      return;
    }
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds }, tournamentId, ...activeTeamWhere },
      select: { id: true, groupId: true },
    });
    if (teams.length !== teamIds.length) {
      throw new BadRequestException({
        message: GROUP_FORM_MESSAGES.members.teamNotInTournament,
        error: 'TEAM_NOT_IN_TOURNAMENT',
      });
    }
    const notInGroup = teams.find((team) => team.groupId !== groupId);
    if (notInGroup) {
      throw new BadRequestException({
        message: GROUP_FORM_MESSAGES.members.teamNotInGroup,
        error: 'TEAM_NOT_IN_GROUP',
      });
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
      where: { id: { in: teamIds }, tournamentId, ...activeTeamWhere },
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
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { groups: true } } },
    });
    assertTournamentActive(tournament);
    return tournament;
  }

  private assertTournamentSupportsGroups(tournament: {
    type: string;
    matchSchedulingFormat: string | null;
    _count: { groups: number };
  }): void {
    if (
      tournamentSupportsGroups({
        type: tournament.type as TournamentType,
        matchSchedulingFormat: tournament.matchSchedulingFormat as MatchSchedulingFormat | null,
        groupCount: tournament._count.groups,
      })
    ) {
      return;
    }
    throw new BadRequestException({
      message: 'Groups can only be created for Group Stage + Knockout tournaments',
      error: 'INVALID_SCHEDULING_FORMAT',
    });
  }

  private toSummary(
    row: {
      id: string;
      tournamentId: string;
      name: string;
      teams: {
        id: string;
        name: string;
        logoUrl: string | null;
        _count: { memberships: number };
      }[];
    },
    liveMatchCount: number,
  ): GroupSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      name: row.name,
      liveMatchCount,
      hasLiveMatches: liveMatchCount > 0,
      teams: row.teams.map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        memberCount: team._count.memberships,
      })),
    };
  }
}
