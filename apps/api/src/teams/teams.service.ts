import {
  type AssignTeamRolesResponse,
  type AuthUser,
  BallType,
  Permission,
  PlayerCategory,
  RegistrationPlayerType,
  RegistrationStatus,
  PLAYER_REGISTRATION_ROLE_LABELS,
  PlayerRegistrationRole,
  TEAM_FORM_MESSAGES,
  normalizeTeamName,
  type TeamDetailView,
  type TeamDetailPlayerRow,
  type TeamRoleCandidatesView,
  type TeamSummary,
  type TournamentPlayerProfileView,
  teamCapError,
  UserRole,
  canAssignTeamLeadershipRoles,
  canViewTournamentPlayerProfiles,
  canViewTeamRosterMobileNumbers,
  isTeamLeadershipAssignmentWindowOpen,
  PLAYER_PROFILE_BALL_TYPE_LABELS,
  type AssignTeamRolesRequest,
  type AddTeamPlayersResponse,
  type TeamAddPlayersPickerView,
  type UnassignedTeamPlayerCandidate,
  validateTeamRoleAssignments,
  teamRosterCapExceededMessage,
  teamRosterSlotsRemaining,
  TournamentType,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { AuditService } from '../audit/audit.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { S3StorageService } from '../storage/s3-storage.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';
import { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';
import { NotificationsService, NotificationTrigger } from '../notifications/notifications.service';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { AddTeamPlayersDto } from './dto/add-team-players.dto';
import type { UpdateTeamDto } from './dto/update-team.dto';
import { activeTeamMembershipWhere, activeTeamMembershipCountSelect } from './team-membership-query';
import { activeTeamWhere, resolveTeamHasMatches } from './team-query';

const TEAM_LEADER_ROLES = [UserRole.Captain, UserRole.ViceCaptain] as const;
const TEAM_ASSIGNABLE_ROLES = [
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
] as const;

const TEAM_NAME_TAKEN = TEAM_FORM_MESSAGES.name.duplicate;
const REMOVAL_BLOCKING_MATCH_STATES = [
  'SCHEDULED',
  'DELAYED',
  'PLAYING_XI_LOCKED',
  'TOSS_COMPLETED',
  'LIVE',
  'RAIN_INTERRUPTED',
] as const;

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly storage: S3StorageService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly tournaments: TournamentsService,
    private readonly tennisVisibility: TennisTournamentVisibilityService,
    private readonly playerStats: PlayerStatsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    tournamentId: string,
    viewer: AuthUser | null = null,
  ): Promise<TeamSummary[]> {
    const tournament = await this.requireTournament(tournamentId);
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, tournament, {
      allowUnauthenticated: true,
    });
    const rows = await this.prisma.team.findMany({
      where: { tournamentId, ...activeTeamWhere },
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { memberships: activeTeamMembershipCountSelect } },
      },
    });
    const hasMatchesByTeamId = await resolveTeamHasMatches(
      this.prisma,
      tournamentId,
      rows.map((row) => row.id),
    );
    return Promise.all(
      rows.map((row) =>
        this.toSummary(row, hasMatchesByTeamId.get(row.id) ?? false),
      ),
    );
  }

  async getDetail(
    tournamentId: string,
    teamId: string,
    viewer: AuthUser | null = null,
  ): Promise<TeamDetailView> {
    const tournament = await this.requireTournament(tournamentId);
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, tournament, {
      allowUnauthenticated: true,
    });
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId, ...activeTeamWhere },
      select: {
        id: true,
        tournamentId: true,
        name: true,
        logoUrl: true,
        tournament: { select: { ballType: true, playersPerTeam: true } },
      },
    });
    if (!team) {
      throw new NotFoundException({
        message: 'Team not found',
        error: 'TEAM_NOT_FOUND',
      });
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { teamId, tournamentId, ...activeTeamMembershipWhere },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            mobileNumber: true,
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    const userIds = memberships.map((row) => row.userId);
    const [registrations, leaderAssignments, viewerMembership] = await Promise.all([
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
          role: { in: [...TEAM_ASSIGNABLE_ROLES] },
        },
        select: { userId: true, role: true },
      }),
      viewer == null
        ? Promise.resolve(null)
        : this.prisma.teamMembership.findFirst({
            where: { tournamentId, teamId, userId: viewer.id, ...activeTeamMembershipWhere },
            select: { id: true },
          }),
    ]);

    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));
    const captainUserId =
      leaderAssignments.find((row) => row.role === UserRole.Captain)?.userId ?? null;
    const viceCaptainUserId =
      leaderAssignments.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null;
    const managerUserId =
      leaderAssignments.find((row) => row.role === UserRole.Manager)?.userId ?? null;
    const showPlayerCategorySplit = team.tournament.ballType === BallType.Leather;
    const canViewPlayerProfiles = canViewTournamentPlayerProfiles(viewer, tournamentId);
    const canManageRoster = viewer ? await this.canManageTeamRoster(viewer, tournamentId) : false;
    const canAssignTeamRoles = viewer
      ? await this.resolveCanAssignTeamLeadership(viewer, tournament)
      : false;
    const canViewMobileNumbers = canViewTeamRosterMobileNumbers(
      viewer,
      viewerMembership != null,
      canManageRoster,
    );

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
        isManager: membership.userId === managerUserId,
        playerCategory,
        mobileNumber: canViewMobileNumbers ? membership.user.mobileNumber : null,
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
        if (player.isManager) {
          return 2;
        }
        return 3;
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

    const playersPerTeamCap = team.tournament.playersPerTeam;
    const rosterSlotsRemaining = teamRosterSlotsRemaining(playersPerTeamCap, players.length);

    return {
      id: team.id,
      tournamentId: team.tournamentId,
      name: team.name,
      logoUrl: await this.mediaUrls.resolveReadUrl(team.logoUrl),
      ballType: team.tournament.ballType as BallType,
      showPlayerCategorySplit,
      activePlayerCount: players.length,
      fulltimePlayerCount,
      parttimePlayerCount,
      canViewPlayerProfiles,
      canAssignTeamRoles,
      canAddPlayers: canManageRoster,
      canRemovePlayers: canManageRoster,
      playersPerTeamCap,
      rosterSlotsRemaining,
      players: await this.mediaUrls.resolveProfilePhotoUrls(players),
    };
  }

  async listAddPlayerCandidates(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
  ): Promise<TeamAddPlayersPickerView> {
    await this.assertCanManageTeamRoster(actor, tournamentId);
    await this.findActiveTeam(tournamentId, teamId);

    const tournament = await this.requireTournament(tournamentId);
    const currentRosterSize = await this.prisma.teamMembership.count({
      where: { teamId, tournamentId, ...activeTeamMembershipWhere },
    });
    const playersPerTeamCap = tournament.playersPerTeam;
    const rosterSlotsRemaining = teamRosterSlotsRemaining(playersPerTeamCap, currentRosterSize);
    const showPlayerTypeTabs = tournament.ballType === BallType.Leather;

    const rows = await this.loadUnrosteredRegistrationRows(tournamentId);
    const candidates = await this.mapUnrosteredCandidates(rows);

    const fulltimeCandidates = showPlayerTypeTabs
      ? candidates.filter((row) => row.playerType === RegistrationPlayerType.FullTime)
      : [];
    const parttimeCandidates = showPlayerTypeTabs
      ? candidates.filter((row) => row.playerType === RegistrationPlayerType.PartTime)
      : [];

    return {
      ballType: tournament.ballType as BallType,
      showPlayerTypeTabs,
      playersPerTeamCap,
      currentRosterSize,
      rosterSlotsRemaining,
      fulltimeCandidates,
      parttimeCandidates,
      candidates: showPlayerTypeTabs ? [] : candidates,
    };
  }

  async addPlayersToTeam(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
    dto: AddTeamPlayersDto,
  ): Promise<AddTeamPlayersResponse> {
    await this.assertCanManageTeamRoster(actor, tournamentId);
    const tournament = await this.requireTournament(tournamentId);
    const team = await this.findActiveTeam(tournamentId, teamId);

    const userIds = [...new Set(dto.userIds)];
    if (userIds.length === 0) {
      throw new BadRequestException({
        message: 'Select at least one player to add',
        error: 'NO_PLAYERS_SELECTED',
      });
    }

    const currentRosterSize = await this.prisma.teamMembership.count({
      where: { teamId, tournamentId, ...activeTeamMembershipWhere },
    });
    const cap = tournament.playersPerTeam;
    if (cap != null && currentRosterSize + userIds.length > cap) {
      throw new BadRequestException({
        message: teamRosterCapExceededMessage(cap, currentRosterSize, userIds.length),
        error: 'ROSTER_CAP_EXCEEDED',
      });
    }

    await this.assertRegisteredAndUnrostered(tournamentId, userIds);

    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        status: RegistrationStatus.Confirmed,
      },
      select: { userId: true, playerType: true },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));

    await this.prisma.$transaction(async (tx) => {
      for (const userId of userIds) {
        const registration = registrationByUser.get(userId);
        const playerCategory = this.registrationToPlayerCategory(
          registration?.playerType ?? null,
          tournament.ballType as BallType,
        );
        await tx.teamMembership.upsert({
          where: { tournamentId_userId: { tournamentId, userId } },
          create: { tournamentId, teamId, userId, playerCategory },
          update: {
            teamId,
            playerCategory,
            isDeleted: false,
            deletedAt: null,
            deletedByUserId: null,
          },
        });
      }
    });

    await this.audit.record({
      action: 'TEAM_PLAYERS_ADDED',
      actorUserId: actor.id,
      targetEntityType: 'team',
      targetEntityId: teamId,
      after: { userIds, addedCount: userIds.length },
      details: { tournamentId },
    });

    await this.notifyPlayersAddedToTeam(tournamentId, teamId, team.name, tournament.name, userIds);

    return { addedCount: userIds.length };
  }

  async removePlayerFromTeam(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.assertCanManageTeamRoster(actor, tournamentId);
    const [tournament, team, membership] = await Promise.all([
      this.requireTournament(tournamentId),
      this.findActiveTeam(tournamentId, teamId),
      this.prisma.teamMembership.findFirst({
        where: { tournamentId, teamId, userId, ...activeTeamMembershipWhere },
        select: { id: true },
      }),
    ]);
    if (!membership) {
      throw new NotFoundException({
        message: 'Player is not an active member of this team',
        error: 'TEAM_MEMBERSHIP_NOT_FOUND',
      });
    }

    const blockingSquad = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId,
        squad: {
          teamId,
          match: {
            tournamentId,
            isDeleted: false,
            state: { in: [...REMOVAL_BLOCKING_MATCH_STATES] },
          },
        },
      },
      select: { id: true },
    });
    if (blockingSquad) {
      throw new BadRequestException({
        message:
          'This player cannot be removed because they are in a confirmed Playing 11 or an upcoming/live match squad for this team.',
        error: 'PLAYER_IN_ACTIVE_MATCH_SQUAD',
      });
    }

    const removedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.teamMembership.update({
        where: { id: membership.id },
        data: { isDeleted: true, deletedAt: removedAt, deletedByUserId: actor.id },
      }),
      this.prisma.roleAssignment.deleteMany({
        where: {
          userId,
          tournamentId,
          teamId,
          role: { in: [...TEAM_ASSIGNABLE_ROLES] },
        },
      }),
    ]);

    await this.audit.record({
      action: 'TEAM_PLAYER_REMOVED',
      actorUserId: actor.id,
      targetEntityType: 'team_membership',
      targetEntityId: membership.id,
      after: { tournamentId, teamId, userId, deletedAt: removedAt.toISOString() },
    });
    await this.notifyPlayerRemovedFromTeam(
      tournamentId,
      teamId,
      team.name,
      tournament.name,
      userId,
      membership.id,
      removedAt,
    );
  }

  /**
   * §17 Phase B: notify each added player they were rostered. Per-player dedupe
   * so a re-add / retry never double-notifies. Best-effort — never fails the add.
   */
  private async notifyPlayersAddedToTeam(
    tournamentId: string,
    teamId: string,
    teamName: string,
    tournamentName: string,
    userIds: string[],
  ): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.notifications.sendNotification({
          userIds: [userId],
          triggerKey: NotificationTrigger.PlayerAddedToTeam,
          dedupeKey: `${NotificationTrigger.PlayerAddedToTeam}:${tournamentId}:${teamId}:${userId}`,
          title: 'Added to a team',
          body: `You've been added to ${teamName} in ${tournamentName}.`,
          data: { tournamentId, teamId, screen: 'tournament' },
          audienceSummary: `Player ${userId} added to team ${teamId}`,
        });
      } catch (err) {
        this.logger.error(
          `Failed to send player-added notification for ${userId} on team ${teamId}`,
          err as Error,
        );
      }
    }
  }

  private async notifyPlayerRemovedFromTeam(
    tournamentId: string,
    teamId: string,
    teamName: string,
    tournamentName: string,
    userId: string,
    membershipId: string,
    removedAt: Date,
  ): Promise<void> {
    try {
      await this.notifications.sendNotification({
        userIds: [userId],
        triggerKey: NotificationTrigger.PlayerRemovedFromTeam,
        dedupeKey: `${NotificationTrigger.PlayerRemovedFromTeam}:${membershipId}:${removedAt.toISOString()}`,
        title: 'Removed from a team',
        body: `You've been removed from ${teamName} in ${tournamentName}.`,
        data: { tournamentId, teamId, screen: 'tournament' },
        audienceSummary: `Player ${userId} removed from team ${teamId}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send player-removed notification for ${userId} on team ${teamId}`,
        err as Error,
      );
    }
  }

  /** Captain / Club Manager / Manager views another player's tournament profile (Team Detail → View Profile). */
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
      where: { tournamentId, userId, ...activeTeamMembershipWhere },
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
      profilePhotoUrl: await this.mediaUrls.resolveReadUrl(membership.user.profilePhotoUrl),
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

  async listRoleCandidates(
    actor: AuthUser,
    tournamentId: string,
    filters: { search?: string; centerId?: string } = {},
  ): Promise<TeamRoleCandidatesView> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanAssignTeamLeadership(actor, tournament);
    return this.loadConfirmedRegistrantRoleCandidates(tournament.id, filters);
  }

  async create(actor: AuthUser, tournamentId: string, dto: CreateTeamDto): Promise<TeamSummary> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanEditTournamentTeams(actor, tournament);

    const teamCount = await this.prisma.team.count({
      where: { tournamentId, ...activeTeamWhere },
    });
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
        include: { _count: { select: { memberships: activeTeamMembershipCountSelect } } },
      });
      return this.toSummary(created, false);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.teamNameTakenException();
      }
      throw err;
    }
  }

  async update(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<TeamSummary> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanEditTournamentTeams(actor, tournament);

    const team = await this.findActiveTeam(tournamentId, teamId);

    const nextName = dto.name !== undefined ? dto.name.trim() : team.name;
    if (!nextName) {
      throw new BadRequestException({
        message: 'Team name is required',
        error: 'TEAM_NAME_REQUIRED',
        fields: { name: 'Team name is required' },
      });
    }

    const nameNormalized = normalizeTeamName(nextName);
    if (nameNormalized !== team.nameNormalized) {
      await this.assertTeamNameAvailable(tournamentId, nameNormalized, teamId);
    }

    const nextLogoUrl = dto.logoUrl !== undefined ? dto.logoUrl : team.logoUrl;
    if (dto.logoUrl !== undefined && team.logoUrl && team.logoUrl !== dto.logoUrl) {
      await this.storage.deleteObject(team.logoUrl);
    }

    try {
      const updated = await this.prisma.team.update({
        where: { id: teamId },
        data: {
          name: nextName,
          nameNormalized,
          logoUrl: nextLogoUrl,
        },
        include: {
          group: { select: { id: true, name: true } },
          _count: { select: { memberships: activeTeamMembershipCountSelect } },
        },
      });
      const hasMatches = await this.teamHasMatches(tournamentId, teamId);
      return this.toSummary(updated, hasMatches);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.teamNameTakenException();
      }
      throw err;
    }
  }

  /** Soft-deletes a team with no match history; detaches members (§6.3). */
  async remove(actor: AuthUser, tournamentId: string, teamId: string): Promise<void> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanEditTournamentTeams(actor, tournament);
    const team = await this.findActiveTeam(tournamentId, teamId);

    if (await this.teamHasMatches(tournamentId, teamId)) {
      throw new BadRequestException({
        message: TEAM_FORM_MESSAGES.delete.hasMatches,
        error: 'TEAM_HAS_MATCHES',
      });
    }

    await this.prisma.$transaction([
      this.prisma.teamMembership.deleteMany({ where: { teamId, tournamentId } }),
      this.prisma.roleAssignment.deleteMany({ where: { teamId, tournamentId } }),
      this.prisma.teamRegistrationFavourite.deleteMany({ where: { teamId, tournamentId } }),
      this.prisma.team.update({
        where: { id: teamId },
        data: {
          deletedAt: new Date(),
          groupId: null,
          nameNormalized: `${team.nameNormalized}__deleted__${teamId}`,
        },
      }),
    ]);
  }

  async assignTeamRoles(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
    dto: AssignTeamRolesRequest,
  ): Promise<AssignTeamRolesResponse> {
    const tournament = await this.requireTournament(tournamentId);
    await this.assertCanAssignTeamLeadership(actor, tournament);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId, ...activeTeamWhere },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException({
        message: 'Team not found',
        error: 'TEAM_NOT_FOUND',
      });
    }

    if (dto.managerUserId !== undefined && tournament.ballType === BallType.Leather) {
      throw new BadRequestException({
        message: 'Manager role is not used in ACC (leather-ball) tournaments',
        error: 'MANAGER_NOT_ALLOWED',
      });
    }

    const updates: Array<{ role: UserRole; userId: string | null }> = [];
    if (dto.captainUserId !== undefined) {
      updates.push({ role: UserRole.Captain, userId: dto.captainUserId });
    }
    if (dto.viceCaptainUserId !== undefined) {
      updates.push({ role: UserRole.ViceCaptain, userId: dto.viceCaptainUserId });
    }
    if (dto.managerUserId !== undefined) {
      updates.push({ role: UserRole.Manager, userId: dto.managerUserId });
    }
    if (updates.length === 0) {
      throw new BadRequestException({
        message: 'Provide captainUserId, viceCaptainUserId, and/or managerUserId to assign',
        error: 'NO_ROLE_UPDATES',
      });
    }

    const existingAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        teamId,
        tournamentId,
        role: { in: [...TEAM_ASSIGNABLE_ROLES] },
      },
      select: { userId: true, role: true },
    });
    const existingCaptain =
      existingAssignments.find((row) => row.role === UserRole.Captain)?.userId ?? null;
    const existingViceCaptain =
      existingAssignments.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null;
    const existingManager =
      existingAssignments.find((row) => row.role === UserRole.Manager)?.userId ?? null;

    const before = {
      captainUserId: existingCaptain,
      viceCaptainUserId: existingViceCaptain,
      managerUserId: existingManager,
    };

    const finalCaptain =
      dto.captainUserId !== undefined ? dto.captainUserId : existingCaptain;
    const finalViceCaptain =
      dto.viceCaptainUserId !== undefined ? dto.viceCaptainUserId : existingViceCaptain;
    const finalManager =
      dto.managerUserId !== undefined ? dto.managerUserId : existingManager;

    const roleConflict = validateTeamRoleAssignments(
      finalCaptain,
      finalViceCaptain,
      finalManager,
    );
    if (roleConflict) {
      throw new BadRequestException({
        message: roleConflict,
        error: 'DUAL_TEAM_LEADER',
      });
    }

    const assigneeIds = [...new Set(
      [finalCaptain, finalViceCaptain, finalManager].filter((id): id is string => id != null),
    )];
    if (assigneeIds.length > 0) {
      await this.assertEligibleForTeamRole(tournament, assigneeIds, { teamId });
    }

    await this.prisma.$transaction(async (tx) => {
      if (assigneeIds.length > 0) {
        await this.ensureUsersRosteredOnTeam(tx, tournament, teamId, assigneeIds);
      }
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
        role: { in: [...TEAM_ASSIGNABLE_ROLES] },
      },
      select: { userId: true, role: true },
    });

    const after = {
      captainUserId: refreshed.find((row) => row.role === UserRole.Captain)?.userId ?? null,
      viceCaptainUserId:
        refreshed.find((row) => row.role === UserRole.ViceCaptain)?.userId ?? null,
      managerUserId: refreshed.find((row) => row.role === UserRole.Manager)?.userId ?? null,
    };

    await this.audit.record({
      action: 'TEAM_ROLES_ASSIGNED',
      actorUserId: actor.id,
      targetEntityType: 'team',
      targetEntityId: teamId,
      before,
      after,
      details: { tournamentId },
    });

    return after;
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
        ...activeTeamWhere,
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

  /**
   * Create / update / delete team entity — same EDIT_TOURNAMENT organizer gate
   * (Admin; CM when organizer; participating Center Sevak on multi-center tennis).
   */
  private async assertCanEditTournamentTeams(
    actor: AuthUser,
    tournament: { id: string; type: string; createdByUserId: string },
  ): Promise<void> {
    const allowed = await this.permissions.check(Permission.EDIT_TOURNAMENT, actor, {
      tournamentId: tournament.id,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage teams in this tournament',
        error: 'FORBIDDEN',
      });
    }
    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);
  }

  private async canAdminOrClubManagerManageTeams(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<boolean> {
    if (actor.role === UserRole.Admin) {
      return true;
    }
    if (actor.role === UserRole.ClubManager) {
      return this.permissions.check(Permission.EDIT_TOURNAMENT, actor, { tournamentId });
    }
    return false;
  }

  /**
   * Roster add/remove authorization:
   * Admin/Club Manager globally; Center Sevak only for a multi-center
   * Center-level tournament linked to one of their assigned centers.
   */
  private async canManageTeamRoster(actor: AuthUser, tournamentId: string): Promise<boolean> {
    if (await this.canAdminOrClubManagerManageTeams(actor, tournamentId)) {
      return true;
    }
    if (actor.role !== UserRole.CenterSevak) {
      return false;
    }

    const tournament = await this.requireTournament(tournamentId);
    if (tournament.type !== TournamentType.Center) {
      return false;
    }
    const [centerIds, involvedCenterCount] = await Promise.all([
      this.tournaments.resolveCenterSevakCenterIds(actor.id),
      this.prisma.tournamentCenter.count({ where: { tournamentId } }),
    ]);
    if (centerIds.length === 0 || involvedCenterCount < 2) {
      return false;
    }
    const involvedCenter = await this.prisma.tournamentCenter.findFirst({
      where: { tournamentId, centerId: { in: centerIds } },
      select: { centerId: true },
    });
    return involvedCenter !== null;
  }

  private async assertCanManageTeamRoster(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<void> {
    if (!(await this.canManageTeamRoster(actor, tournamentId))) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage this team roster',
        error: 'FORBIDDEN',
      });
    }
  }

  private async findActiveTeam(tournamentId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId, ...activeTeamWhere },
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        logoUrl: true,
      },
    });
    if (!team) {
      throw new NotFoundException({
        message: 'Team not found',
        error: 'TEAM_NOT_FOUND',
      });
    }
    return team;
  }

  private async teamHasMatches(tournamentId: string, teamId: string): Promise<boolean> {
    const map = await resolveTeamHasMatches(this.prisma, tournamentId, [teamId]);
    return map.get(teamId) ?? false;
  }

  private async resolveCanAssignTeamLeadership(
    actor: AuthUser,
    tournament: {
      id: string;
      type: string;
      createdByUserId: string;
      registrationOpenAt: Date | null;
      registrationCloseAt: Date | null;
    },
  ): Promise<boolean> {
    if (
      !isTeamLeadershipAssignmentWindowOpen({
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      })
    ) {
      return false;
    }

    const [participatingCenterIds, sevakCenterIds] = await Promise.all([
      this.loadParticipatingCenterIds(tournament.id),
      (async (): Promise<string[]> => {
        if ((actor.centerSevakCenterIds?.length ?? 0) > 0) {
          return [...actor.centerSevakCenterIds!];
        }
        if (actor.role === UserRole.CenterSevak) {
          return this.tournaments.resolveCenterSevakCenterIds(actor.id);
        }
        return [];
      })(),
    ]);

    return canAssignTeamLeadershipRoles(
      {
        userId: actor.id,
        role: actor.role,
        sevakCenterIds,
      },
      {
        type: tournament.type as TournamentType,
        createdByUserId: tournament.createdByUserId,
        participatingCenterIds,
      },
    );
  }

  private async assertCanAssignTeamLeadership(
    actor: AuthUser,
    tournament: {
      id: string;
      type: string;
      createdByUserId: string;
      registrationOpenAt: Date | null;
      registrationCloseAt: Date | null;
    },
  ): Promise<void> {
    if (
      !isTeamLeadershipAssignmentWindowOpen({
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      })
    ) {
      throw new ForbiddenException({
        message: 'Team leadership roles can only be assigned after registration closes',
        error: 'REGISTRATION_STILL_OPEN',
      });
    }

    const allowed = await this.resolveCanAssignTeamLeadership(actor, tournament);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to assign team leadership roles',
        error: 'FORBIDDEN',
      });
    }
  }

  /** Confirmed registrants for Cap/VC/Manager pickers (includes rostered players). */
  private async loadConfirmedRegistrantRoleCandidates(
    tournamentId: string,
    filters: { search?: string; centerId?: string },
  ): Promise<TeamRoleCandidatesView> {
    const search = filters.search?.trim() || undefined;
    const centerId = filters.centerId?.trim() || undefined;

    const [rosteredRows, totalConfirmed, registrations] = await Promise.all([
      this.prisma.teamMembership.findMany({
        where: { tournamentId, team: activeTeamWhere, ...activeTeamMembershipWhere },
        select: { userId: true },
      }),
      this.prisma.registration.count({
        where: {
          tournamentId,
          status: RegistrationStatus.Confirmed,
          user: selectableUserWhere,
        },
      }),
      this.prisma.registration.findMany({
        where: {
          tournamentId,
          status: RegistrationStatus.Confirmed,
          user: {
            ...selectableUserWhere,
            ...(centerId ? { centerId } : {}),
            ...(search
              ? {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              centerId: true,
              center: { select: { id: true, name: true } },
            },
          },
          center: { select: { id: true, name: true } },
        },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
    ]);

    const rosteredUserIds = [...new Set(rosteredRows.map((row) => row.userId))];
    const centersById = new Map<string, string>();
    for (const row of registrations) {
      const center = row.user.center ?? row.center;
      if (center) {
        centersById.set(center.id, center.name);
      }
    }

    return {
      candidates: registrations.map((row) => ({
        userId: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        centerId: row.user.centerId,
        centerName: row.user.center?.name ?? row.center.name,
      })),
      centers: [...centersById.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      confirmedRegistrantCount: totalConfirmed,
      rosteredCount: rosteredUserIds.length,
    };
  }

  /** TournamentCenter.centerIds for tennis APL / Center-level audiences. */
  private async loadParticipatingCenterIds(tournamentId: string): Promise<string[]> {
    const rows = await this.prisma.tournamentCenter.findMany({
      where: { tournamentId },
      select: { centerId: true },
    });
    return rows.map((row) => row.centerId);
  }

  private async loadUnrosteredRegistrationRows(tournamentId: string) {
    const rosteredRows = await this.prisma.teamMembership.findMany({
      where: { tournamentId, team: activeTeamWhere, ...activeTeamMembershipWhere },
      select: { userId: true },
    });
    const rosteredUserIds = [...new Set(rosteredRows.map((row) => row.userId))];

    return this.prisma.registration.findMany({
      where: {
        tournamentId,
        status: RegistrationStatus.Confirmed,
        user: selectableUserWhere,
        ...(rosteredUserIds.length > 0 ? { userId: { notIn: rosteredUserIds } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        center: { select: { name: true } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
  }

  private async mapUnrosteredCandidates(
    rows: Awaited<ReturnType<TeamsService['loadUnrosteredRegistrationRows']>>,
  ): Promise<UnassignedTeamPlayerCandidate[]> {
    const mapped = rows.map((row) => ({
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      centerName: row.center.name,
      profilePhotoUrl: row.user.profilePhotoUrl,
      playerType: (row.playerType as RegistrationPlayerType | null) ?? null,
      battingRating: row.battingRating,
      bowlingRating: row.bowlingRating,
      fieldingRating: row.fieldingRating,
    }));
    return this.mediaUrls.resolveProfilePhotoUrls(mapped);
  }

  /** Assignees must be confirmed registrants (or already on this team) and selectable. */
  private async assertEligibleForTeamRole(
    tournament: {
      id: string;
      ballType: string;
      provinceId: string | null;
    },
    userIds: string[],
    options: { teamId?: string } = {},
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(userIds)];
    const [registrations, selectableUsers, teamMemberships] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          tournamentId: tournament.id,
          userId: { in: uniqueIds },
          status: RegistrationStatus.Confirmed,
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: uniqueIds }, ...selectableUserWhere },
        select: { id: true },
      }),
      options.teamId
        ? this.prisma.teamMembership.findMany({
            where: {
              tournamentId: tournament.id,
              teamId: options.teamId,
              userId: { in: uniqueIds },
              ...activeTeamMembershipWhere,
            },
            select: { userId: true },
          })
        : Promise.resolve([] as Array<{ userId: string }>),
    ]);
    const registeredIds = new Set(registrations.map((row) => row.userId));
    const selectableIds = new Set(selectableUsers.map((row) => row.id));
    const onThisTeam = new Set(teamMemberships.map((row) => row.userId));

    for (const userId of uniqueIds) {
      if (!selectableIds.has(userId)) {
        throw new BadRequestException({
          message: 'One or more selected players are inactive or unavailable',
          error: 'USER_NOT_SELECTABLE',
        });
      }
      if (!registeredIds.has(userId) && !onThisTeam.has(userId)) {
        throw new BadRequestException({
          message: 'Selected players must be confirmed registrants in this tournament',
          error: 'NOT_ELIGIBLE_FOR_TEAM_ROLE',
        });
      }
    }
  }

  private async assertNotRosteredInTournament(
    tournamentId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        team: activeTeamWhere,
        ...activeTeamMembershipWhere,
      },
      select: { userId: true },
    });
    if (memberships.length > 0) {
      throw new BadRequestException({
        message: 'Selected players are already assigned to another team in this tournament',
        error: 'ALREADY_ROSTERED',
      });
    }
  }

  /**
   * Upsert TeamMembership onto `teamId`. Rejects when the user is already active
   * on a different team in this tournament. No-op when already on this team.
   */
  private async ensureUsersRosteredOnTeam(
    tx: Prisma.TransactionClient,
    tournament: { id: string; ballType: string },
    teamId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const tournamentId = tournament.id;
    const uniqueIds = [...new Set(userIds)];
    const memberships = await tx.teamMembership.findMany({
      where: {
        tournamentId,
        userId: { in: uniqueIds },
        team: activeTeamWhere,
        ...activeTeamMembershipWhere,
      },
      select: { userId: true, teamId: true },
    });

    for (const membership of memberships) {
      if (membership.teamId !== teamId) {
        throw new BadRequestException({
          message: 'Selected players are already assigned to another team in this tournament',
          error: 'ALREADY_ROSTERED',
        });
      }
    }

    const alreadyOnTeam = new Set(
      memberships.filter((row) => row.teamId === teamId).map((row) => row.userId),
    );
    const toRoster = uniqueIds.filter((id) => !alreadyOnTeam.has(id));
    if (toRoster.length === 0) {
      return;
    }

    const registrations = await tx.registration.findMany({
      where: {
        tournamentId,
        userId: { in: toRoster },
        status: RegistrationStatus.Confirmed,
      },
      select: { userId: true, playerType: true },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));

    for (const userId of toRoster) {
      const registration = registrationByUser.get(userId);
      await tx.teamMembership.upsert({
        where: { tournamentId_userId: { tournamentId, userId } },
        create: {
          tournamentId,
          teamId,
          userId,
          playerCategory: this.registrationToPlayerCategory(
            registration?.playerType ?? null,
            tournament.ballType as BallType,
          ),
        },
        update: {
          teamId,
          playerCategory: this.registrationToPlayerCategory(
            registration?.playerType ?? null,
            tournament.ballType as BallType,
          ),
          isDeleted: false,
          deletedAt: null,
          deletedByUserId: null,
        },
      });
    }
  }

  private async assertRegisteredAndUnrostered(
    tournamentId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const [registrations, memberships, selectableUsers] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          tournamentId,
          userId: { in: userIds },
          status: RegistrationStatus.Confirmed,
        },
        select: { userId: true },
      }),
      this.prisma.teamMembership.findMany({
        where: {
          tournamentId,
          userId: { in: userIds },
          team: activeTeamWhere,
          ...activeTeamMembershipWhere,
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds }, ...selectableUserWhere },
        select: { id: true },
      }),
    ]);

    const registeredIds = new Set(registrations.map((row) => row.userId));
    const selectableIds = new Set(selectableUsers.map((row) => row.id));
    for (const userId of userIds) {
      if (!selectableIds.has(userId)) {
        throw new BadRequestException({
          message: 'One or more selected players are inactive or unavailable',
          error: 'USER_NOT_SELECTABLE',
        });
      }
      if (!registeredIds.has(userId)) {
        throw new BadRequestException({
          message: 'Team leaders must be confirmed registered players in this tournament',
          error: 'NOT_REGISTERED',
        });
      }
    }

    if (memberships.length > 0) {
      throw new BadRequestException({
        message: 'Selected players are already assigned to another team in this tournament',
        error: 'ALREADY_ROSTERED',
      });
    }
  }

  private registrationToPlayerCategory(
    playerType: string | null,
    ballType: BallType,
  ): PlayerCategory | null {
    if (ballType !== BallType.Leather) {
      return null;
    }
    if (playerType === RegistrationPlayerType.FullTime) {
      return PlayerCategory.Fulltime;
    }
    if (playerType === RegistrationPlayerType.PartTime) {
      return PlayerCategory.Parttime;
    }
    return null;
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

  private async toSummary(
    row: {
      id: string;
      tournamentId: string;
      name: string;
      logoUrl: string | null;
      groupId?: string | null;
      group?: { id: string; name: string } | null;
      _count?: { memberships: number };
    },
    hasMatches: boolean,
  ): Promise<TeamSummary> {
    const logoUrl = await this.mediaUrls.resolveReadUrl(row.logoUrl);
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      name: row.name,
      logoUrl,
      memberCount: row._count?.memberships ?? 0,
      groupId: row.groupId ?? row.group?.id ?? null,
      groupName: row.group?.name ?? null,
      hasMatches,
    };
  }
}
