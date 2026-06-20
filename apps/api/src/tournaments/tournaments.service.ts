import {
  type AuthUser,
  BallType,
  type CloneSuggestion,
  compareIsoDateOnly,
  DEFAULT_PLAYERS_PER_TEAM,
  deriveTournamentWindowFromDates,
  formatUtcIsoDate,
  isIsoDateOnly,
  isTournamentRegistrationOpen,
  isRegistrationVerificationComplete,
  type MatchSchedulingFormat,
  normalizeTournamentDates,
  normalizeTeamName,
  Permission,
  RegistrationStatus,
  TOURNAMENT_FORM_MESSAGES,
  TournamentState,
  TOURNAMENT_STATE_TRANSITIONS,
  tournamentHasRegistrationWindow,
  type TournamentDashboardPermissions,
  type TournamentDashboardEntry,
  type TournamentDetail,
  type TournamentEditFormData,
  type TournamentScopeDisplay,
  type TournamentSummary,
  CitySelection,
  TournamentType,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Tournament } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { TournamentTypeResolverService } from '../authz/tournament-type-resolver.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { PlayerSkillVideosService } from '../player-videos/player-skill-videos.service';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import {
  activeTournamentWhere,
  assertTournamentActive,
  withActiveTournamentWhere,
} from './tournament-query';
import {
  assertCreateTournamentFormValid,
  registrationCloseBeforeOpenFields,
  videoDateAfterRegistrationFields,
  videoDateRequiredFields,
} from './tournament-create-validation';
import { resolveTournamentTimezone } from './tournament-timezone.utils';

const CREATE_PERMISSION: Record<TournamentType, Permission> = {
  ACC: Permission.CREATE_ACC_TOURNAMENT,
  APL: Permission.CREATE_APL_TOURNAMENT,
  CENTER: Permission.CREATE_CENTER_TOURNAMENT,
};

type TournamentWithCounts = Tournament & { _count: { teams: number } };

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly typeResolver: TournamentTypeResolverService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly playerSkillVideos: PlayerSkillVideosService,
  ) {}

  /** Creates a tournament (§6.1), deriving the type server-side and RBAC-gating it. */
  async create(actor: AuthUser, dto: CreateTournamentDto): Promise<TournamentDetail> {
    const type = this.typeResolver.resolve({
      ballType: dto.ballType,
      ...(dto.ballType === BallType.Tennis ? { citySelection: dto.citySelection } : {}),
    });

    const allowed = await this.permissions.check(CREATE_PERMISSION[type], actor, {});
    if (!allowed) {
      throw new ForbiddenException({
        message: `You do not have permission to create a ${type} tournament`,
        error: 'FORBIDDEN',
      });
    }

    assertCreateTournamentFormValid(dto);

    this.validateTournamentDates(dto.dates);
    const { startAt, endAt, normalizedDates } = this.deriveTournamentSchedule(dto.dates);
    const dtoWithWindow = { ...dto, startAt, endAt };

    this.validateDates(dtoWithWindow);
    this.validateCenterParticipation(dto, type);

    const playersPerTeam = dto.playersPerTeam ?? DEFAULT_PLAYERS_PER_TEAM;
    const timezone = resolveTournamentTimezone({
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: dto.name,
          year: dto.year,
          posterUrl: dto.posterUrl,
          maxOversPerBowler: dto.maxOversPerBowler,
          numberOfTeams: dto.numberOfTeams,
          playersPerTeam,
          substitutesAllowed: dto.substitutesAllowed,
          locationAddress: dto.locationAddress ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          timezone,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          ballType: dto.ballType,
          type,
          state: TournamentState.New,
          format: dto.format,
          impactPlayerEnabled: dto.impactPlayerEnabled,
          videoRequired: dto.videoRequired,
          videoUploadEndDate: dto.videoUploadEndDate ? new Date(dto.videoUploadEndDate) : null,
          youtubeUrl: dto.youtubeUrl ?? null,
          registrationOpenAt: dto.registrationOpenAt ? new Date(dto.registrationOpenAt) : null,
          registrationCloseAt: dto.registrationCloseAt ? new Date(dto.registrationCloseAt) : null,
          auctionAt: dto.auctionAt ? new Date(dto.auctionAt) : null,
          createdByUserId: actor.id,
        },
      });

      await tx.tournamentDate.createMany({
        data: normalizedDates.map((date) => ({
          tournamentId: tournament.id,
          date: new Date(`${date}T00:00:00.000Z`),
        })),
      });

      await this.linkCenters(tx, tournament.id, type, dto, actor);

      if (dto.cloneFromTournamentId) {
        await this.cloneTeams(
          tx,
          dto.cloneFromTournamentId,
          tournament.id,
          dto.copyRoleAssignments ?? false,
        );
      }

      return tournament.id;
    });

    return this.getDetail(created);
  }

  async uploadPoster(actor: AuthUser, buffer: Buffer): Promise<string> {
    return this.media.uploadTournamentPoster(actor.id, buffer);
  }

  /** Lists tournaments newest-first for the dashboard list. */
  async list(): Promise<TournamentSummary[]> {
    const rows = await this.prisma.tournament.findMany({
      where: activeTournamentWhere,
      include: { _count: { select: { teams: true } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getDetail(id: string, viewer: AuthUser | null = null): Promise<TournamentDetail> {
    const row = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { teams: true, groups: true } },
        groups: {
          orderBy: { name: 'asc' },
          include: {
            teams: {
              orderBy: { name: 'asc' },
              include: { _count: { select: { memberships: true } } },
            },
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            groupId: true,
            group: { select: { name: true } },
            _count: { select: { memberships: true } },
          },
          orderBy: { name: 'asc' },
        },
        scheduledDates: { select: { date: true }, orderBy: { date: 'asc' } },
      },
    });
    assertTournamentActive(row);

    let myTeamId: string | null = null;
    if (viewer) {
      const membership = await this.prisma.teamMembership.findUnique({
        where: {
          tournamentId_userId: { tournamentId: id, userId: viewer.id },
        },
        select: { teamId: true },
      });
      myTeamId = membership?.teamId ?? null;
    }

    const detailBase = {
      ...this.toSummary(row),
      dates: row.scheduledDates.map((entry) => formatUtcIsoDate(entry.date)),
      oversPerInnings: row.oversPerInnings,
      maxOversPerBowler: row.maxOversPerBowler,
      numberOfTeams: row.numberOfTeams,
      playersPerTeam: row.playersPerTeam,
      substitutesAllowed: row.substitutesAllowed,
      format: row.format,
      matchSchedulingFormat: row.matchSchedulingFormat ?? null,
      impactPlayerEnabled: row.impactPlayerEnabled,
      videoRequired: row.videoRequired,
      videoUploadEndDate: row.videoUploadEndDate?.toISOString() ?? null,
      youtubeUrl: row.youtubeUrl,
      registrationOpenAt: row.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: row.registrationCloseAt?.toISOString() ?? null,
      auctionAt: row.auctionAt?.toISOString() ?? null,
      groupCount: row._count.groups,
      groups: row.groups.map((group) => ({
        id: group.id,
        tournamentId: row.id,
        name: group.name,
        teams: group.teams.map((team) => ({
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          memberCount: team._count.memberships,
        })),
      })),
      teams: row.teams.map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        memberCount: team._count.memberships,
        groupId: team.groupId,
        groupName: team.group?.name ?? null,
      })),
    };
    const hasRegistrationWindow = tournamentHasRegistrationWindow(detailBase);

    let registrationVerificationComplete = false;
    if (hasRegistrationWindow) {
      const pendingWaitlistCount = await this.prisma.registration.count({
        where: {
          tournamentId: id,
          status: RegistrationStatus.InWaitlist,
        },
      });
      registrationVerificationComplete = isRegistrationVerificationComplete(
        {
          ballType: row.ballType as BallType,
          hasRegistrationWindow,
          registrationOpenAt: detailBase.registrationOpenAt,
          registrationCloseAt: detailBase.registrationCloseAt,
        },
        pendingWaitlistCount,
      );
    }

    let canViewRegisteredPlayersList = false;
    let canViewFavouritePlayers = false;
    if (viewer && registrationVerificationComplete) {
      [canViewRegisteredPlayersList, canViewFavouritePlayers] = await Promise.all([
        this.permissions.check(Permission.VIEW_VERIFIED_REGISTERED_PLAYERS, viewer, {
          tournamentId: id,
        }),
        this.permissions.check(Permission.FAVOURITE_PLAYERS, viewer, { tournamentId: id }),
      ]);
    }

    const videoFlags = await this.playerSkillVideos.viewerUploadFlags(viewer, {
      id,
      ballType: row.ballType,
      hasRegistrationWindow,
      registrationOpenAt: detailBase.registrationOpenAt,
      registrationCloseAt: detailBase.registrationCloseAt,
      registrationVerificationComplete,
      videoUploadEndDate: detailBase.videoUploadEndDate,
    });

    return {
      ...detailBase,
      myTeamId,
      hasRegistrationWindow,
      registrationIsOpen: isTournamentRegistrationOpen(detailBase),
      registrationVerificationComplete,
      canViewRegisteredPlayersList,
      canViewFavouritePlayers,
      canUploadSkillVideo: videoFlags.canUploadSkillVideo,
      hasSkillVideo: videoFlags.hasSkillVideo,
      canUploadPlayerVideo: videoFlags.canUploadSkillVideo,
      hasPlayerVideo: videoFlags.hasSkillVideo,
    };
  }

  /**
   * Suggests cloning team names from a past tournament with the same name
   * (§6.2). Only names are ever suggested — players are never copied.
   */
  async cloneSuggestion(name: string): Promise<CloneSuggestion | null> {
    const past = await this.prisma.tournament.findFirst({
      where: withActiveTournamentWhere({
        name: { equals: name.trim(), mode: 'insensitive' },
      }),
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        teams: { select: { id: true, name: true } },
      },
    });
    if (!past) {
      return null;
    }
    const roleAssignmentCount = await this.prisma.roleAssignment.count({
      where: {
        tournamentId: past.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain, UserRole.Manager] },
      },
    });
    return {
      tournamentId: past.id,
      name: past.name,
      year: past.year,
      teamNames: past.teams.map((t) => t.name),
      hasRoleAssignments: roleAssignmentCount > 0,
    };
  }

  /** Applies mid-tournament edits (§6.4) and notifies when warranted. */
  async update(actor: AuthUser, id: string, dto: UpdateTournamentDto): Promise<TournamentDetail> {
    const existing = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { teams: true } },
        scheduledDates: { select: { date: true }, orderBy: { date: 'asc' } },
      },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    assertTournamentActive(existing);

    await this.assertCenterSevakTournamentAccess(actor, existing);

    const existingDates = existing.scheduledDates.map((entry) => formatUtcIsoDate(entry.date));
    const merged = {
      startAt: existing.startAt.toISOString(),
      endAt: existing.endAt.toISOString(),
      registrationOpenAt:
        dto.registrationOpenAt !== undefined
          ? dto.registrationOpenAt
          : existing.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt:
        dto.registrationCloseAt !== undefined
          ? dto.registrationCloseAt
          : existing.registrationCloseAt?.toISOString() ?? null,
      videoRequired:
        dto.videoRequired !== undefined ? dto.videoRequired : existing.videoRequired,
      videoUploadEndDate:
        dto.videoUploadEndDate !== undefined
          ? dto.videoUploadEndDate
          : existing.videoUploadEndDate?.toISOString() ?? null,
    };

    if (dto.numberOfTeams !== undefined && dto.numberOfTeams < existing._count.teams) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.numberOfTeams.belowExisting(existing._count.teams),
        error: 'TEAM_COUNT_TOO_LOW',
        fields: {
          numberOfTeams: TOURNAMENT_FORM_MESSAGES.numberOfTeams.belowExisting(
            existing._count.teams,
          ),
        },
      });
    }

    let normalizedDates: string[] | undefined;
    if (dto.dates !== undefined) {
      this.validateTournamentDatesForUpdate(existingDates, dto.dates);
      normalizedDates = normalizeTournamentDates(dto.dates);
      const removed = existingDates.filter((date) => !normalizedDates!.includes(date));
      if (removed.length > 0) {
        const datesWithMatches = await this.getDatesWithScheduledMatches(id);
        for (const date of removed) {
          if (datesWithMatches.includes(date)) {
            throw new BadRequestException({
              message: TOURNAMENT_FORM_MESSAGES.tournamentDates.hasScheduledMatch(date),
              error: 'DATE_HAS_SCHEDULED_MATCH',
              fields: {
                tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.hasScheduledMatch(date),
              },
            });
          }
        }
      }
      const { startAt, endAt } = deriveTournamentWindowFromDates(normalizedDates);
      merged.startAt = startAt;
      merged.endAt = endAt;
    }

    this.validateDates(merged);

    const data: Prisma.TournamentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.posterUrl !== undefined) data.posterUrl = dto.posterUrl;
    if (dto.oversPerInnings !== undefined) data.oversPerInnings = dto.oversPerInnings;
    if (dto.maxOversPerBowler !== undefined) data.maxOversPerBowler = dto.maxOversPerBowler;
    if (dto.numberOfTeams !== undefined) data.numberOfTeams = dto.numberOfTeams;
    if (dto.playersPerTeam !== undefined) data.playersPerTeam = dto.playersPerTeam;
    if (dto.substitutesAllowed !== undefined) data.substitutesAllowed = dto.substitutesAllowed;
    if (dto.locationAddress !== undefined) data.locationAddress = dto.locationAddress;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (
      dto.timezone !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined
    ) {
      const nextLatitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
      const nextLongitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
      data.timezone = resolveTournamentTimezone({
        latitude: nextLatitude,
        longitude: nextLongitude,
        timezone: dto.timezone,
        existingTimezone: existing.timezone,
      });
    }
    if (normalizedDates !== undefined) {
      data.startAt = new Date(merged.startAt);
      data.endAt = new Date(merged.endAt);
    }
    if (dto.format !== undefined) data.format = dto.format;
    if (dto.impactPlayerEnabled !== undefined) data.impactPlayerEnabled = dto.impactPlayerEnabled;
    if (dto.videoRequired !== undefined) data.videoRequired = dto.videoRequired;
    if (dto.videoUploadEndDate !== undefined) {
      data.videoUploadEndDate = dto.videoUploadEndDate ? new Date(dto.videoUploadEndDate) : null;
    }
    if (dto.youtubeUrl !== undefined) data.youtubeUrl = dto.youtubeUrl;
    if (dto.registrationOpenAt !== undefined) {
      data.registrationOpenAt = dto.registrationOpenAt ? new Date(dto.registrationOpenAt) : null;
    }
    if (dto.registrationCloseAt !== undefined) {
      data.registrationCloseAt = dto.registrationCloseAt
        ? new Date(dto.registrationCloseAt)
        : null;
    }
    if (dto.auctionAt !== undefined) {
      data.auctionAt = dto.auctionAt ? new Date(dto.auctionAt) : null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tournament.update({ where: { id }, data });

      if (normalizedDates !== undefined) {
        await tx.tournamentDate.deleteMany({ where: { tournamentId: id } });
        await tx.tournamentDate.createMany({
          data: normalizedDates.map((date) => ({
            tournamentId: id,
            date: new Date(`${date}T00:00:00.000Z`),
          })),
        });
      }
    });

    await this.notifyOnTournamentEdit(existing, dto, normalizedDates);

    return this.getDetail(id);
  }

  /** Edit-form payload with locked scope display and scheduling constraints. */
  async getEditForm(actor: AuthUser, id: string): Promise<TournamentEditFormData> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    assertTournamentActive(existing);

    await this.assertCenterSevakTournamentAccess(actor, existing);

    const [detail, scopeDisplay, datesWithMatches] = await Promise.all([
      this.getDetail(id),
      this.buildScopeDisplay(id, existing.type as TournamentType, existing.ballType as BallType),
      this.getDatesWithScheduledMatches(id),
    ]);

    return { ...detail, scopeDisplay, datesWithMatches };
  }

  /** Dashboard tournament rows with per-record permissions for the current user. */
  async listDashboardEntries(actor: AuthUser): Promise<TournamentDashboardEntry[]> {
    const rows = await this.prisma.tournament.findMany({
      where: withActiveTournamentWhere(
        actor.role === UserRole.ClubManager ? { type: TournamentType.APL } : {},
      ),
      include: { _count: { select: { teams: true } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(
      rows.map(async (row) => ({
        tournament: this.toSummary(row),
        permissions: await this.resolveTournamentMenuPermissions(actor, row),
      })),
    );
  }

  /**
   * Records the coarse scheduling mode chosen in the Schedule Matches modal.
   * Does not overwrite {@link TournamentFormat} from creation (§24).
   */
  async selectMatchSchedulingFormat(
    actor: AuthUser,
    tournamentId: string,
    schedulingFormat: MatchSchedulingFormat,
  ): Promise<TournamentDetail> {
    const existing = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    assertTournamentActive(existing);

    const allowed = await this.permissions.check(Permission.CREATE_MATCH, actor, { tournamentId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to schedule matches',
        error: 'FORBIDDEN',
      });
    }

    await this.assertCenterSevakTournamentAccess(actor, existing);

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { matchSchedulingFormat: schedulingFormat },
    });

    return this.getDetail(tournamentId);
  }

  /** Soft-deletes a tournament; related rows are retained (§6.4 notifications). */
  async remove(actor: AuthUser, id: string): Promise<void> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    assertTournamentActive(existing);

    await this.assertCenterSevakTournamentAccess(actor, existing);

    if (existing.state === TournamentState.RegistrationOpen) {
      await this.notifyRegistrants(id, NotificationTrigger.TournamentDeletedMidRegistration);
    }

    await this.prisma.tournament.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: actor.id,
      },
    });
  }

  /** Validates and applies a §5.1 lifecycle transition. */
  async transition(id: string, next: TournamentState): Promise<TournamentDetail> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    assertTournamentActive(existing);
    const current = existing.state as TournamentState;
    const allowedNext = TOURNAMENT_STATE_TRANSITIONS[current];
    if (!allowedNext.includes(next)) {
      throw new BadRequestException({
        message: `Cannot transition from ${current} to ${next}`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }
    await this.prisma.tournament.update({ where: { id }, data: { state: next } });
    return this.getDetail(id);
  }

  // --- helpers -------------------------------------------------------------

  /**
   * Center Sevak may edit/delete only tournaments they created or that belong to
   * one of their scoped centers (§7.4). Other roles rely on RBAC at the guard.
   */
  async assertCenterSevakTournamentAccess(
    actor: AuthUser,
    tournament: { id: string; createdByUserId: string },
  ): Promise<void> {
    if (actor.role !== UserRole.CenterSevak) {
      return;
    }
    const allowed = await this.centerSevakCanModifyTournament(actor.id, tournament);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You can only edit or delete tournaments you created or that belong to your center',
        error: 'FORBIDDEN',
      });
    }
  }

  /** Ownership check for dashboard permissions and service-layer enforcement. */
  async centerSevakCanModifyTournament(
    userId: string,
    tournament: { id: string; createdByUserId: string },
  ): Promise<boolean> {
    if (tournament.createdByUserId === userId) {
      return true;
    }
    const centerIds = await this.resolveCenterSevakCenterIds(userId);
    if (centerIds.length === 0) {
      return false;
    }
    const link = await this.prisma.tournamentCenter.findFirst({
      where: {
        tournamentId: tournament.id,
        centerId: { in: centerIds },
      },
      select: { centerId: true },
    });
    return link !== null;
  }

  async resolveCenterSevakCenterIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: { userId, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    return rows.map((row) => row.centerId).filter((id): id is string => id !== null);
  }

  /** Resolves tournament card permissions for role dashboards. */
  async resolveTournamentMenuPermissions(
    actor: AuthUser,
    tournament: { id: string; createdByUserId: string; ballType: BallType },
    targetCenterId?: string,
  ): Promise<TournamentDashboardPermissions> {
    const refs = targetCenterId
      ? { tournamentId: tournament.id, targetCenterId }
      : { tournamentId: tournament.id };

    const canManageCenterPlayers =
      tournament.ballType === BallType.Tennis &&
      actor.role === UserRole.CenterSevak &&
      targetCenterId
        ? await this.permissions.check(
            Permission.VIEW_REGISTRATIONS_OWN_CENTER,
            actor,
            refs,
          )
        : false;

    if (actor.role === UserRole.CenterSevak) {
      const canModify = await this.centerSevakCanModifyTournament(actor.id, tournament);
      return {
        canEdit: canModify,
        canDelete: canModify,
        canManageCenterPlayers,
      };
    }

    const canEdit = await this.permissions.check(Permission.EDIT_TOURNAMENT, actor, refs);
    return {
      canEdit,
      canDelete: canEdit,
      canManageCenterPlayers,
    };
  }

  /** Resolves tournament card permissions for the Center Sevak dashboard. */
  async resolveDashboardPermissions(
    actor: AuthUser,
    tournament: { id: string; createdByUserId: string; ballType: BallType },
    actionCenterId: string,
  ): Promise<TournamentDashboardPermissions> {
    return this.resolveTournamentMenuPermissions(actor, tournament, actionCenterId);
  }

  private validateDates(dto: {
    startAt: string;
    endAt: string;
    registrationOpenAt?: string | null;
    registrationCloseAt?: string | null;
    videoRequired?: boolean;
    videoUploadEndDate?: string | null;
  }): void {
    if (new Date(dto.endAt) < new Date(dto.startAt)) {
      throw new BadRequestException({
        message: 'End date must be on or after the start date',
        error: 'INVALID_DATE_RANGE',
      });
    }
    if (dto.registrationOpenAt && dto.registrationCloseAt) {
      if (new Date(dto.registrationCloseAt) <= new Date(dto.registrationOpenAt)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.registration.closeBeforeOpen,
          error: 'INVALID_REGISTRATION_WINDOW',
          fields: registrationCloseBeforeOpenFields(),
        });
      }
    }
    if (dto.videoRequired) {
      if (!dto.videoUploadEndDate) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.required,
          error: 'VIDEO_DATE_REQUIRED',
          fields: videoDateRequiredFields(),
        });
      }
      if (
        dto.registrationCloseAt &&
        new Date(dto.videoUploadEndDate) <= new Date(dto.registrationCloseAt)
      ) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.afterRegistrationClose,
          error: 'INVALID_VIDEO_DATE',
          fields: videoDateAfterRegistrationFields(),
        });
      }
    }
  }

  private validateTournamentDates(dates: string[]): void {
    if (!dates || dates.length === 0) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
        error: 'TOURNAMENT_DATES_REQUIRED',
        fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
      });
    }

    const todayUtc = formatUtcIsoDate(new Date());
    for (const raw of dates) {
      if (!isIsoDateOnly(raw)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
          error: 'INVALID_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
        });
      }
      if (compareIsoDateOnly(raw, todayUtc) < 0) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
          error: 'PAST_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
        });
      }
    }
  }

  /** Allows keeping existing past dates; only validates newly added calendar days. */
  private validateTournamentDatesForUpdate(existingDates: string[], dates: string[]): void {
    if (!dates || dates.length === 0) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
        error: 'TOURNAMENT_DATES_REQUIRED',
        fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
      });
    }

    const todayUtc = formatUtcIsoDate(new Date());
    const existingSet = new Set(existingDates);
    for (const raw of dates) {
      if (!isIsoDateOnly(raw)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
          error: 'INVALID_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
        });
      }
      if (!existingSet.has(raw) && compareIsoDateOnly(raw, todayUtc) < 0) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
          error: 'PAST_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
        });
      }
    }
  }

  private async getDatesWithScheduledMatches(tournamentId: string): Promise<string[]> {
    const rows = await this.prisma.match.findMany({
      where: { tournamentId, matchDate: { not: null } },
      select: { matchDate: true },
    });
    const unique = new Set<string>();
    for (const row of rows) {
      if (row.matchDate) {
        unique.add(formatUtcIsoDate(row.matchDate));
      }
    }
    return [...unique].sort();
  }

  private async buildScopeDisplay(
    tournamentId: string,
    type: TournamentType,
    ballType: BallType,
  ): Promise<TournamentScopeDisplay> {
    if (type === TournamentType.ACC || ballType === BallType.Leather) {
      return { citySelection: null, provinceName: null, centerNames: [] };
    }

    const links = await this.prisma.tournamentCenter.findMany({
      where: { tournamentId },
      include: { center: { include: { province: true } } },
      orderBy: { center: { name: 'asc' } },
    });

    const provinceName = links[0]?.center.province.name ?? null;
    const centerNames = links.map((link) => link.center.name);
    let citySelection: CitySelection | null = CitySelection.All;
    if (type === TournamentType.Center) {
      citySelection =
        centerNames.length === 1 ? CitySelection.Single : CitySelection.Multi;
    }

    return { citySelection, provinceName, centerNames };
  }

  private async notifyOnTournamentEdit(
    existing: Tournament,
    dto: UpdateTournamentDto,
    normalizedDates: string[] | undefined,
  ): Promise<void> {
    const tournamentId = existing.id;
    const registrationOpen = existing.state === TournamentState.RegistrationOpen;

    if (registrationOpen) {
      await this.notifyRegistrants(
        tournamentId,
        NotificationTrigger.TournamentEditedMidRegistration,
      );
    }

    if (normalizedDates !== undefined) {
      await this.notifyRegistrants(tournamentId, NotificationTrigger.TournamentDatesChanged);
    }

    if (
      dto.locationAddress !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined
    ) {
      await this.notifyRegistrants(tournamentId, NotificationTrigger.TournamentLocationChanged);
    }

    if (dto.registrationOpenAt !== undefined || dto.registrationCloseAt !== undefined) {
      await this.notifyRegistrants(
        tournamentId,
        NotificationTrigger.TournamentRegistrationWindowChanged,
      );
    }

    if (dto.videoRequired !== undefined || dto.videoUploadEndDate !== undefined) {
      await this.notifyRegistrants(tournamentId, NotificationTrigger.TournamentVideoPolicyChanged);
    }
  }

  private deriveTournamentSchedule(dates: string[]): {
    normalizedDates: string[];
    startAt: string;
    endAt: string;
  } {
    const normalizedDates = normalizeTournamentDates(dates);
    const { startAt, endAt } = deriveTournamentWindowFromDates(normalizedDates);
    return { normalizedDates, startAt, endAt };
  }

  private validateCenterParticipation(
    dto: CreateTournamentDto,
    type: TournamentType,
  ): void {
    if (type === 'ACC') {
      return;
    }

    if (!dto.provinceId) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.province.required,
        error: 'PROVINCE_REQUIRED',
        fields: { province: TOURNAMENT_FORM_MESSAGES.province.required },
      });
    }

    if (dto.citySelection === 'MULTI' || type === 'CENTER') {
      if (!dto.centerIds || dto.centerIds.length === 0) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.centers.required,
          error: 'CENTERS_REQUIRED',
          fields: { centers: TOURNAMENT_FORM_MESSAGES.centers.required },
        });
      }
    }
  }

  private async linkCenters(
    tx: Prisma.TransactionClient,
    tournamentId: string,
    type: TournamentType,
    dto: CreateTournamentDto,
    actor: AuthUser,
  ): Promise<void> {
    if (type === 'ACC') {
      return; // ACC has its four fixed teams; no per-Center participation.
    }
    if (!dto.provinceId) {
      throw new BadRequestException({
        message: 'provinceId is required for tennis-ball tournaments',
        error: 'PROVINCE_REQUIRED',
      });
    }

    const activeInProvince = await tx.center.findMany({
      where: { provinceId: dto.provinceId, isActive: true },
      select: { id: true },
    });
    const activeIds = new Set(activeInProvince.map((c) => c.id));

    let centerIds: string[];
    if (dto.citySelection === 'ALL') {
      centerIds = activeInProvince.map((c) => c.id);
    } else {
      if (!dto.centerIds || dto.centerIds.length === 0) {
        throw new BadRequestException({
          message: 'Select at least one center',
          error: 'CENTERS_REQUIRED',
        });
      }
      centerIds = dto.centerIds;
      const invalid = centerIds.filter((id) => !activeIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({
          message: 'One or more centers are invalid, inactive, or not in the selected province',
          error: 'INVALID_CENTER',
        });
      }
    }
    if (centerIds.length === 0) {
      return;
    }
    await tx.tournamentCenter.createMany({
      data: centerIds.map((centerId) => ({ tournamentId, centerId })),
      skipDuplicates: true,
    });
  }

  /**
   * Clones team NAMES only (§6.2). Players are never copied. Captain/VC/Manager
   * role assignments are copied to the matching new team when requested.
   */
  private async cloneTeams(
    tx: Prisma.TransactionClient,
    sourceTournamentId: string,
    targetTournamentId: string,
    copyRoleAssignments: boolean,
  ): Promise<void> {
    const sourceTeams = await tx.team.findMany({
      where: { tournamentId: sourceTournamentId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    for (const source of sourceTeams) {
      const newTeam = await tx.team.create({
        data: {
          tournamentId: targetTournamentId,
          name: source.name,
          nameNormalized: normalizeTeamName(source.name),
        },
      });
      if (copyRoleAssignments) {
        const assignments = await tx.roleAssignment.findMany({
          where: {
            teamId: source.id,
            role: { in: [UserRole.Captain, UserRole.ViceCaptain, UserRole.Manager] },
          },
          select: { userId: true, role: true },
        });
        if (assignments.length > 0) {
          await tx.roleAssignment.createMany({
            data: assignments.map((a) => ({
              userId: a.userId,
              role: a.role,
              tournamentId: targetTournamentId,
              teamId: newTeam.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  private async notifyRegistrants(
    tournamentId: string,
    trigger: NotificationTrigger,
  ): Promise<void> {
    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    if (registrations.length === 0) {
      return;
    }
    await this.notifications.notify(trigger, {
      recipientUserIds: registrations.map((r) => r.userId),
      data: { tournamentId },
    });
  }

  private toSummary(row: TournamentWithCounts): TournamentSummary {
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      type: row.type,
      state: row.state,
      ballType: row.ballType,
      posterUrl: row.posterUrl,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      locationAddress: row.locationAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      teamCount: row._count.teams,
    };
  }
}
