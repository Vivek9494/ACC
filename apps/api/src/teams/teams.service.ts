import {
  type AssignTeamRolesResponse,
  type AuthUser,
  BallType,
  Permission,
  PlayerCategory,
  PLAYER_REGISTRATION_ROLE_LABELS,
  PlayerRegistrationRole,
  TEAM_FORM_MESSAGES,
  normalizeTeamName,
  type TeamDetailView,
  type TeamDetailPlayerRow,
  type TeamSummary,
  type TournamentPlayerProfileView,
  teamCapError,
  UserRole,
  canViewTournamentPlayerProfiles,
  PLAYER_PROFILE_BALL_TYPE_LABELS,
  type AssignTeamRolesRequest,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { MediaService } from '../media/media.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';
import type { CreateTeamDto } from './dto/create-team.dto';

const TEAM_LEADER_ROLES = [UserRole.Captain, UserRole.ViceCaptain] as const;

const TEAM_NAME_TAKEN = TEAM_FORM_MESSAGES.name.duplicate;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly media: MediaService,
    private readonly tournaments: TournamentsService,
    private readonly playerStats: PlayerStatsService,
  ) {}

  async list(tournamentId: string): Promise<TeamSummary[]> {
    await this.requireTournament(tournamentId);
    const rows = await this.prisma.team.findMany({
      where: { tournamentId },
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getDetail(
    tournamentId: string,
    teamId: string,
    viewer: AuthUser | null = null,
  ): Promise<TeamDetailView> {
    await this.requireTournament(tournamentId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      select: {
        id: true,
        tournamentId: true,
        name: true,
        logoUrl: true,
        tournament: { select: { ballType: true } },
      },
    });
    if (!team) {
      throw new NotFoundException({
        message: 'Team not found',
        error: 'TEAM_NOT_FOUND',
      });
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { teamId, tournamentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    const userIds = memberships.map((row) => row.userId);
    const [registrations, leaderAssignments] = await Promise.all([
      userIds.length === 0
        ? Promise.resolve([])
        : this.prisma.registration.findMany({
            where: { tournamentId, userId: { in: userIds } },
            select: {
              userId: true,
              battingRating: true,
              bowlingRating: true,
              fieldingRating: true,
              playerType: true,
            },
          }),
      this.prisma.roleAssignment.findMany({
        where: {
          teamId,
          tournamentId,
          role: { in: [...TEAM_LEADER_ROLES] },
        },
        select: { userId: true, role: true },
      }),
    ]);

    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));
    const captainUserId =
      leaderAssignments.find((row) => row.role === UserRole.Captain)?.userId ?? null;
    const viceCaptainUserId =
      leaderAssignments.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null;
    const showPlayerCategorySplit = team.tournament.ballType === BallType.Leather;

    let fulltimePlayerCount = 0;
    let parttimePlayerCount = 0;

    const players: TeamDetailPlayerRow[] = memberships.map((membership) => {
      const registration = registrationByUser.get(membership.userId);
      const playerCategory = this.toPlayerCategory(registration?.playerType ?? null);

      if (showPlayerCategorySplit) {
        if (playerCategory === PlayerCategory.Fulltime) {
          fulltimePlayerCount += 1;
        } else if (playerCategory === PlayerCategory.Parttime) {
          parttimePlayerCount += 1;
        }
      }

      return {
        userId: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        profilePhotoUrl: membership.user.profilePhotoUrl,
        isCaptain: membership.userId === captainUserId,
        isViceCaptain: membership.userId === viceCaptainUserId,
        playerCategory,
        battingRating: registration?.battingRating ?? null,
        bowlingRating: registration?.bowlingRating ?? null,
        fieldingRating: registration?.fieldingRating ?? null,
      };
    });

    players.sort((a, b) => {
      const rank = (player: TeamDetailPlayerRow): number => {
        if (player.isCaptain) {
          return 0;
        }
        if (player.isViceCaptain) {
          return 1;
        }
        return 2;
      };
      const roleDiff = rank(a) - rank(b);
      if (roleDiff !== 0) {
        return roleDiff;
      }
      const last = a.lastName.localeCompare(b.lastName);
      if (last !== 0) {
        return last;
      }
      return a.firstName.localeCompare(b.firstName);
    });

    return {
      id: team.id,
      tournamentId: team.tournamentId,
      name: team.name,
      logoUrl: team.logoUrl,
      ballType: team.tournament.ballType as BallType,
      showPlayerCategorySplit,
      activePlayerCount: players.length,
      fulltimePlayerCount,
      parttimePlayerCount,
      canViewPlayerProfiles: canViewTournamentPlayerProfiles(viewer, tournamentId),
      canAssignTeamRoles: viewer
        ? await this.permissions.check(Permission.ASSIGN_TEAM_ROLES, viewer, {
            tournamentId,
            teamId,
          })
        : false,
      players,
    };
  }

  /** Captain / Club Manager views another player's tournament profile (Team Detail → View Profile). */
  async getPlayerProfile(
    actor: AuthUser,
    tournamentId: string,
    userId: string,
  ): Promise<TournamentPlayerProfileView> {
    const allowed = await this.permissions.check(Permission.VIEW_TOURNAMENT_PLAYER_PROFILE, actor, {
      tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view this player profile',
        error: 'FORBIDDEN',
      });
    }

    const tournament = await this.requireTournament(tournamentId);
    const ballType = tournament.ballType;

    const membership = await this.prisma.teamMembership.findFirst({
      where: { tournamentId, userId },
      include: {
        team: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            center: { select: { name: true } },
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException({
        message: 'Player is not on a team in this tournament',
        error: 'NOT_FOUND',
      });
    }

    const [registration, leaderAssignments, statsBundle] = await Promise.all([
      this.prisma.registration.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
        select: {
          playerRole: true,
          fieldingPosition: true,
          battingRating: true,
          bowlingRating: true,
          fieldingRating: true,
        },
      }),
      this.prisma.roleAssignment.findMany({
        where: {
          tournamentId,
          teamId: membership.teamId,
          role: { in: [...TEAM_LEADER_ROLES] },
        },
        select: { userId: true, role: true },
      }),
      this.playerStats.buildCareerStats(userId, ballType),
    ]);

    const captainUserId =
      leaderAssignments.find((row) => row.role === UserRole.Captain)?.userId ?? null;
    const viceCaptainUserId =
      leaderAssignments.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null;

    const playerRole = registration?.playerRole ?? null;
    const playerRoleLabel =
      playerRole && playerRole in PLAYER_REGISTRATION_ROLE_LABELS
        ? PLAYER_REGISTRATION_ROLE_LABELS[playerRole as PlayerRegistrationRole]
        : null;
    const isWicketkeeper = registration?.fieldingPosition === 'Wicketkeeper';
    const showStumpingsCard = isWicketkeeper && statsBundle.career.stumpings > 0;

    return {
      userId: membership.user.id,
      tournamentId,
      teamId: membership.team.id,
      teamName: membership.team.name,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      profilePhotoUrl: membership.user.profilePhotoUrl,
      centerName: membership.user.center?.name ?? null,
      ballType,
      ballTypeLabel: PLAYER_PROFILE_BALL_TYPE_LABELS[ballType],
      playerRoleLabel,
      isCaptain: captainUserId === userId,
      isViceCaptain: viceCaptainUserId === userId,
      isWicketkeeper,
      showStumpingsCard,
      battingRating: registration?.battingRating ?? null,
      bowlingRating: registration?.bowlingRating ?? null,
      fieldingRating: registration?.fieldingRating ?? null,
      career: statsBundle.career,
      byYear: statsBundle.byYear,
      byTournament: statsBundle.byTournament,
    };
  }

  async create(actor: AuthUser, tournamentId: string, dto: CreateTeamDto): Promise<TeamSummary> {
    const tournament = await this.requireTournament(tournamentId);

    const allowed = await this.permissions.check(Permission.EDIT_TOURNAMENT, actor, {
      tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to add teams to this tournament',
        error: 'FORBIDDEN',
      });
    }

    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);

    const teamCount = await this.prisma.team.count({ where: { tournamentId } });
    if (teamCount >= tournament.numberOfTeams) {
      throw new BadRequestException({
        message: teamCapError(tournament.numberOfTeams),
        error: 'TEAM_CAP_REACHED',
      });
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'Team name is required',
        error: 'TEAM_NAME_REQUIRED',
        fields: { name: 'Team name is required' },
      });
    }

    const nameNormalized = normalizeTeamName(name);
    await this.assertTeamNameAvailable(tournamentId, nameNormalized);

    try {
      const created = await this.prisma.team.create({
        data: {
          tournamentId,
          name,
          nameNormalized,
          logoUrl: dto.logoUrl ?? null,
        },
        include: { _count: { select: { memberships: true } } },
      });
      return this.toSummary(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.teamNameTakenException();
      }
      throw err;
    }
  }

  async assignTeamRoles(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
    dto: AssignTeamRolesRequest,
  ): Promise<AssignTeamRolesResponse> {
    await this.requireTournament(tournamentId);

    const allowed = await this.permissions.check(Permission.ASSIGN_TEAM_ROLES, actor, {
      tournamentId,
      teamId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Only the Club Manager may assign team Captain and Vice-Captain roles',
        error: 'FORBIDDEN',
      });
    }

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException({
        message: 'Team not found',
        error: 'TEAM_NOT_FOUND',
      });
    }

    const updates: Array<{ role: UserRole; userId: string | null }> = [];
    if (dto.captainUserId !== undefined) {
      updates.push({ role: UserRole.Captain, userId: dto.captainUserId });
    }
    if (dto.viceCaptainUserId !== undefined) {
      updates.push({ role: UserRole.ViceCaptain, userId: dto.viceCaptainUserId });
    }
    if (updates.length === 0) {
      throw new BadRequestException({
        message: 'Provide captainUserId and/or viceCaptainUserId to assign',
        error: 'NO_ROLE_UPDATES',
      });
    }

    const existingLeaders = await this.prisma.roleAssignment.findMany({
      where: {
        teamId,
        tournamentId,
        role: { in: [...TEAM_LEADER_ROLES] },
      },
      select: { userId: true, role: true },
    });
    const existingCaptain =
      existingLeaders.find((row) => row.role === UserRole.Captain)?.userId ?? null;
    const existingViceCaptain =
      existingLeaders.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null;

    const finalCaptain =
      dto.captainUserId !== undefined ? dto.captainUserId : existingCaptain;
    const finalViceCaptain =
      dto.viceCaptainUserId !== undefined ? dto.viceCaptainUserId : existingViceCaptain;

    if (finalCaptain != null && finalViceCaptain != null && finalCaptain === finalViceCaptain) {
      throw new BadRequestException({
        message: 'One person cannot be both Captain and Vice-Captain of the same team',
        error: 'DUAL_TEAM_LEADER',
      });
    }

    const assigneeIds = [finalCaptain, finalViceCaptain].filter(
      (id): id is string => id != null,
    );
    if (assigneeIds.length > 0) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { teamId, tournamentId, userId: { in: assigneeIds } },
        select: { userId: true },
      });
      const memberIds = new Set(memberships.map((row) => row.userId));
      for (const userId of assigneeIds) {
        if (!memberIds.has(userId)) {
          throw new BadRequestException({
            message: 'Team leaders must be on the team roster',
            error: 'NOT_ON_ROSTER',
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.roleAssignment.deleteMany({
          where: { teamId, tournamentId, role: update.role },
        });
        if (update.userId != null) {
          await tx.roleAssignment.create({
            data: {
              userId: update.userId,
              role: update.role,
              tournamentId,
              teamId,
            },
          });
        }
      }
    });

    const refreshed = await this.prisma.roleAssignment.findMany({
      where: {
        teamId,
        tournamentId,
        role: { in: [...TEAM_LEADER_ROLES] },
      },
      select: { userId: true, role: true },
    });

    return {
      captainUserId: refreshed.find((row) => row.role === UserRole.Captain)?.userId ?? null,
      viceCaptainUserId:
        refreshed.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null,
    };
  }

  async uploadLogo(actor: AuthUser, buffer: Buffer): Promise<string> {
    return this.media.uploadTeamLogo(actor.id, buffer);
  }

  /**
   * Reject duplicate display names within a tournament (case-insensitive, trimmed).
   * Pass `excludeTeamId` when renaming an existing team.
   */
  async assertTeamNameAvailable(
    tournamentId: string,
    nameNormalized: string,
    excludeTeamId?: string,
  ): Promise<void> {
    const existing = await this.prisma.team.findFirst({
      where: {
        tournamentId,
        nameNormalized,
        ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw this.teamNameTakenException();
    }
  }

  private teamNameTakenException(): BadRequestException {
    return new BadRequestException({
      message: TEAM_NAME_TAKEN,
      error: 'TEAM_NAME_TAKEN',
      fields: { name: TEAM_NAME_TAKEN },
    });
  }

  private async requireTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    assertTournamentActive(tournament);
    return tournament;
  }

  private toPlayerCategory(
    playerType: string | null | undefined,
  ): PlayerCategory | null {
    if (playerType === 'FULL_TIME') {
      return PlayerCategory.Fulltime;
    }
    if (playerType === 'PART_TIME') {
      return PlayerCategory.Parttime;
    }
    return null;
  }

  private toSummary(row: {
    id: string;
    tournamentId: string;
    name: string;
    logoUrl: string | null;
    groupId?: string | null;
    group?: { id: string; name: string } | null;
    _count?: { memberships: number };
  }): TeamSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      name: row.name,
      logoUrl: row.logoUrl,
      memberCount: row._count?.memberships ?? 0,
      groupId: row.groupId ?? row.group?.id ?? null,
      groupName: row.group?.name ?? null,
    };
  }
}
