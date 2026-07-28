import {
  type AuthUser,
  BallType,
  type CloneSuggestion,
  compareIsoDateOnly,
  DEFAULT_PLAYERS_PER_TEAM,
  deriveTournamentDisplayStatus,
  deriveTournamentWindowFromDates,
  formatUtcIsoDate,
  formatTodayDateOnlyInZone,
  isDateWithinLeatherSpan,
  isIsoDateOnly,
  isTournamentRegistrationOpen,
  hasRegistrationOpened,
  isRegistrationVerificationComplete,
  type MatchSchedulingFormat,
  normalizeTournamentDates,
  normalizeTeamName,
  Permission,
  RegistrationStatus,
  selectDashboardTournaments,
  serverVenueTimezone,
  TOURNAMENT_FORM_MESSAGES,
  TournamentState,
  TOURNAMENT_STATE_TRANSITIONS,
  tournamentHasRegistrationWindow,
  type TournamentDashboardPermissions,
  type TournamentDashboardEntry,
  type TournamentBrowseEntry,
  type TournamentDetail,
  type TournamentEditFormData,
  type TournamentSummary,
  CitySelection,
  TournamentType,
  UserRole,
  canManageLeatherInvites,
} from '@acc/types';
import { decimalToNumberOrNull, numberToDecimalOrNull } from '../common/decimal.util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Tournament } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { resolveOrHealCenterSevakCenterIds } from '../authz/center-sevak-assignment';
import {
  assertCanScheduleTournamentMatches,
  canActorScheduleTournamentMatches,
  viewerLeaderTeamIdsInTournament,
} from '../matches/create-match-auth.util';
import { TournamentTypeResolverService } from '../authz/tournament-type-resolver.service';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { S3StorageService } from '../storage/s3-storage.service';
import { PlayerSkillVideosService } from '../player-videos/player-skill-videos.service';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import {
  activeTournamentWhere,
  assertTournamentActive,
  withActiveTournamentWhere,
} from './tournament-query';
import { resolveGroupBlockingLiveMatchCounts } from '../groups/group-match-query';
import {
  activeTeamCountSelect,
  activeTeamWhere,
  resolveTeamHasMatches,
} from '../teams/team-query';
import { activeTeamMembershipCountSelect } from '../teams/team-membership-query';
import {
  assertCreateTournamentFormValid,
  assertTennisTournamentLocationValid,
  registrationCloseBeforeOpenFields,
  videoDateAfterRegistrationFields,
  videoDateAfterStartFields,
  videoDateRequiredFields,
} from './tournament-create-validation';
import { resolveTournamentTimezone } from './tournament-timezone.utils';
import { LeatherTournamentVisibilityService } from './leather-tournament-visibility.service';
import { TennisTournamentVisibilityService } from './tennis-tournament-visibility.service';
import { TournamentScorersService } from './tournament-scorers.service';
import {
  buildTournamentScopeDisplay,
} from './tournament-scope-display';
import {
  assertKnockoutTeamCountOnCreate,
  assertKnockoutTeamCountOnUpdate,
} from './tournament-knockout-team-count.validation';
import { KnockoutBracketService } from '../knockout-bracket/knockout-bracket.service';

const CREATE_PERMISSION: Record<TournamentType, Permission> = {
  ACC: Permission.CREATE_ACC_TOURNAMENT,
  APL: Permission.CREATE_APL_TOURNAMENT,
  CENTER: Permission.CREATE_CENTER_TOURNAMENT,
};

/** Type-appropriate body copy for the §17 new-tournament announcement. */
function newTournamentBody(name: string, type: TournamentType): string {
  switch (type) {
    case TournamentType.APL:
      return `${name} (APL) has been announced. Tap to view details.`;
    case TournamentType.Center:
      return `${name} has been announced in your area. Tap to view details.`;
    case TournamentType.ACC:
    default:
      return `${name} has been announced. Tap to view details.`;
  }
}

type TournamentWithCounts = Tournament & { _count: { teams: number } };

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly typeResolver: TournamentTypeResolverService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationsService,
    private readonly notificationAudience: NotificationAudienceService,
    private readonly storage: S3StorageService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly playerSkillVideos: PlayerSkillVideosService,
    private readonly leatherVisibility: LeatherTournamentVisibilityService,
    private readonly tennisVisibility: TennisTournamentVisibilityService,
    private readonly tournamentScorers: TournamentScorersService,
    private readonly knockoutBracket: KnockoutBracketService,
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
    assertKnockoutTeamCountOnCreate(type, dto.knockoutTeamCount);
    await this.assertActiveProvince(dto.provinceId);

    if (dto.ballType === BallType.Leather) {
      this.validateLeatherTournamentSpan(dto.dates, { timezone: dto.timezone });
    } else {
      this.validateTournamentDates(dto.dates);
    }
    const { startAt, endAt, normalizedDates } = this.deriveTournamentSchedule(dto.dates);
    const dtoWithWindow = { ...dto, startAt, endAt };

    this.validateDates(dtoWithWindow);
    this.validateCenterParticipation(dto, type);
    await this.assertCenterSevakMultiCenterIncludesOwn(actor, dto);

    const playersPerTeam = dto.playersPerTeam ?? null;
    const fees = this.resolveTournamentFees(dto.ballType, dto.feeFullTime, dto.feePartTime);
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
          posterUrl: this.normalizePosterUrlForStorage(dto.posterUrl),
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
          videoUploadStartAt: dto.videoUploadStartAt ? new Date(dto.videoUploadStartAt) : null,
          videoUploadEndDate: dto.videoUploadEndDate ? new Date(dto.videoUploadEndDate) : null,
          youtubeUrl: dto.youtubeUrl ?? null,
          registrationOpenAt: dto.registrationOpenAt ? new Date(dto.registrationOpenAt) : null,
          registrationCloseAt: dto.registrationCloseAt ? new Date(dto.registrationCloseAt) : null,
          auctionAt: dto.auctionAt ? new Date(dto.auctionAt) : null,
          feeFullTime: fees.feeFullTime,
          feePartTime: fees.feePartTime,
          provinceId: dto.provinceId,
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

    await this.notifyNewTournament(created, dto.name, type);

    return this.getDetail(created);
  }

  /**
   * §17 Phase B: announce a newly created tournament to its resolved audience
   * (APL/CENTER → selected centers' users; ACC/Leather → past leather players).
   * Best-effort — never fails the create if push/log has an issue.
   */
  private async notifyNewTournament(
    tournamentId: string,
    name: string,
    type: TournamentType,
  ): Promise<void> {
    try {
      const userIds = await this.notificationAudience.resolveTournamentAudience(tournamentId);
      if (userIds.length === 0) {
        return;
      }
      await this.notifications.sendToAudience(userIds, {
        triggerKey: NotificationTrigger.NewTournamentCreated,
        dedupeKey: `${NotificationTrigger.NewTournamentCreated}:${tournamentId}`,
        title: `New tournament: ${name}`,
        body: newTournamentBody(name, type),
        data: { tournamentId, screen: 'tournament' },
        audienceSummary: `New ${type} tournament ${tournamentId}`,
      });
    } catch (err) {
      this.logger.error(`Failed to send new-tournament notification for ${tournamentId}`, err as Error);
    }
  }

  /** Lists tournaments newest-first for the dashboard list. */
  async list(viewer: AuthUser | null = null): Promise<TournamentSummary[]> {
    const centerScope = this.tennisVisibility.centerTournamentListWhere(viewer);
    const rows = await this.prisma.tournament.findMany({
      where: centerScope
        ? { AND: [activeTournamentWhere, centerScope] }
        : activeTournamentWhere,
      include: { _count: { select: activeTeamCountSelect } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });

    const visible = await this.filterLeatherVisibleTournaments(viewer, rows);
    return Promise.all(visible.map((row) => this.toSummary(row)));
  }

  async getDetail(id: string, viewer: AuthUser | null = null): Promise<TournamentDetail> {
    const row = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { ...activeTeamCountSelect, groups: true } },
        groups: {
          orderBy: { name: 'asc' },
          include: {
            teams: {
              where: activeTeamWhere,
              orderBy: { name: 'asc' },
              include: {
                _count: { select: { memberships: activeTeamMembershipCountSelect } },
              },
            },
          },
        },
        teams: {
          where: activeTeamWhere,
          select: {
            id: true,
            name: true,
            logoUrl: true,
            groupId: true,
            group: { select: { name: true } },
            _count: { select: { memberships: activeTeamMembershipCountSelect } },
          },
          orderBy: { name: 'asc' },
        },
        scheduledDates: { select: { date: true }, orderBy: { date: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, {
      id: row.id,
      type: row.type,
    });
    const isCancelled = row.isDeleted;
    if (isCancelled && !viewer) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    if (!isCancelled) {
      assertTournamentActive(row);
    }

    let canEditForView = false;
    if (viewer && !isCancelled) {
      const menuPermissions = await this.resolveTournamentMenuPermissions(viewer, {
        id: row.id,
        createdByUserId: row.createdByUserId,
        ballType: row.ballType as BallType,
      });
      canEditForView = menuPermissions.canEdit;
    }

    if (!isCancelled) {
      await this.leatherVisibility.assertCanViewLeatherTournament(
        viewer,
        id,
        row.ballType as BallType,
        {
          allowClubManagerManagement: viewer?.role === UserRole.ClubManager,
          allowEditor: canEditForView,
        },
      );
    }

    let myTeamId: string | null = null;
    if (viewer) {
      // Roster membership in this tournament — role-independent (Admin/Club Manager may also play).
      const membership = await this.prisma.teamMembership.findUnique({
        where: {
          tournamentId_userId: { tournamentId: id, userId: viewer.id },
        },
        select: { teamId: true, isDeleted: true },
      });
      myTeamId = membership?.isDeleted === false ? membership.teamId : null;
      if (myTeamId && !row.teams.some((team) => team.id === myTeamId)) {
        myTeamId = null;
      }
    }

    const teamIds = row.teams.map((team) => team.id);
    const hasMatchesByTeamId = await resolveTeamHasMatches(this.prisma, id, teamIds);

    const scopeDisplay = await buildTournamentScopeDisplay(
      this.prisma,
      id,
      row.type as TournamentType,
      row.ballType as BallType,
      row.provinceId,
    );

    const summaryFields = await this.toSummaryFields(row);

    const teamLogoKeys = row.teams.map((team) => team.logoUrl);
    const resolvedTeamLogos = await this.mediaUrls.resolveReadUrls(teamLogoKeys);
    const logoByTeamId = new Map(
      row.teams.map((team, index) => [team.id, resolvedTeamLogos[index] ?? null]),
    );

    const groupBlockingMatchCounts = await resolveGroupBlockingLiveMatchCounts(
      this.prisma,
      id,
      row.groups.map((group) => group.id),
    );

    const detailBase = {
      ...summaryFields,
      scopeDisplay,
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
      videoUploadStartAt: row.videoUploadStartAt?.toISOString() ?? null,
      videoUploadEndDate: row.videoUploadEndDate?.toISOString() ?? null,
      youtubeUrl: row.youtubeUrl,
      registrationOpenAt: row.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: row.registrationCloseAt?.toISOString() ?? null,
      auctionAt: row.auctionAt?.toISOString() ?? null,
      feeFullTime: decimalToNumberOrNull(row.feeFullTime),
      feePartTime: decimalToNumberOrNull(row.feePartTime),
      groupCount: row._count.groups,
      knockoutTeamCount: row.knockoutTeamCount,
      groups: row.groups.map((group) => ({
        id: group.id,
        tournamentId: row.id,
        name: group.name,
        liveMatchCount: groupBlockingMatchCounts.get(group.id) ?? 0,
        hasLiveMatches: (groupBlockingMatchCounts.get(group.id) ?? 0) > 0,
        teams: group.teams.map((team) => ({
          id: team.id,
          name: team.name,
          logoUrl: logoByTeamId.get(team.id) ?? null,
          memberCount: team._count.memberships,
        })),
      })),
      teams: row.teams.map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: logoByTeamId.get(team.id) ?? null,
        memberCount: team._count.memberships,
        groupId: team.groupId,
        groupName: team.group?.name ?? null,
        hasMatches: hasMatchesByTeamId.get(team.id) ?? false,
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
    if (viewer) {
      if (
        row.ballType === BallType.Leather &&
        hasRegistrationWindow &&
        hasRegistrationOpened(detailBase)
      ) {
        canViewRegisteredPlayersList = await this.permissions.check(
          Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
          viewer,
          { tournamentId: id },
        );
      } else if (
        row.ballType === BallType.Tennis &&
        hasRegistrationWindow &&
        hasRegistrationOpened(detailBase)
      ) {
        canViewRegisteredPlayersList = await this.permissions.check(
          Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
          viewer,
          { tournamentId: id },
        );
        if (registrationVerificationComplete) {
          canViewFavouritePlayers = await this.permissions.check(
            Permission.FAVOURITE_PLAYERS,
            viewer,
            { tournamentId: id },
          );
        }
      }
    }

    const videoFlags = await this.playerSkillVideos.viewerUploadFlags(viewer, {
      id,
      ballType: row.ballType,
      hasRegistrationWindow,
      registrationOpenAt: detailBase.registrationOpenAt,
      registrationCloseAt: detailBase.registrationCloseAt,
      registrationVerificationComplete,
      videoRequired: detailBase.videoRequired,
      videoUploadStartAt: detailBase.videoUploadStartAt,
      videoUploadEndDate: detailBase.videoUploadEndDate,
    });

    let canEdit = false;
    let canRegisterForLeatherTournament = false;
    let canRegisterForTennisTournament = false;
    let canManageLeatherInvitesFlag = false;
    let canScheduleMatches = false;
    let viewerLeaderTeamIds: string[] = [];
    if (viewer && !isCancelled) {
      const activeTeamIds = new Set(row.teams.map((team) => team.id));
      viewerLeaderTeamIds = await viewerLeaderTeamIdsInTournament(
        this.prisma,
        viewer.id,
        id,
        activeTeamIds,
      );
      canScheduleMatches = await canActorScheduleTournamentMatches(
        this.permissions,
        this.prisma,
        viewer,
        { id, ballType: row.ballType as BallType },
      );

      const menuPermissions = await this.resolveTournamentMenuPermissions(viewer, {
        id: row.id,
        createdByUserId: row.createdByUserId,
        ballType: row.ballType as BallType,
      });
      canEdit = menuPermissions.canEdit;
      if (row.ballType === BallType.Leather) {
        canRegisterForLeatherTournament =
          await this.leatherVisibility.canRegisterForLeatherTournament(viewer.id, id, viewer);
        canManageLeatherInvitesFlag = canManageLeatherInvites(viewer, {
          ballType: BallType.Leather,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt.toISOString(),
          timezone: row.timezone,
          cancelled: isCancelled,
        });
      } else if (row.ballType === BallType.Tennis) {
        canRegisterForTennisTournament =
          await this.tennisVisibility.canRegisterForTennisTournament(viewer, {
            id,
            type: row.type,
            ballType: row.ballType,
          });
      }
    }

    const participatingCenterIds = await this.tournamentScorers.loadParticipatingCenterIds(id);
    const hasKnockoutBracket = await this.knockoutBracket.hasKnockoutBracket(id);
    const scorerFlags = await this.tournamentScorers.buildViewerFlags(
      viewer,
      id,
      row.ballType as BallType,
      scopeDisplay,
      participatingCenterIds,
    );

    return {
      ...detailBase,
      hasKnockoutBracket,
      myTeamId,
      hasRegistrationWindow,
      registrationIsOpen: isTournamentRegistrationOpen(detailBase),
      registrationVerificationComplete,
      canViewRegisteredPlayersList,
      canViewFavouritePlayers,
      canRegisterForLeatherTournament,
      canRegisterForTennisTournament,
      canManageLeatherInvites: canManageLeatherInvitesFlag,
      canEdit,
      canScheduleMatches,
      viewerLeaderTeamIds,
      canUploadSkillVideo: videoFlags.canUploadSkillVideo,
      hasSkillVideo: videoFlags.hasSkillVideo,
      canUploadPlayerVideo: videoFlags.canUploadSkillVideo,
      hasPlayerVideo: videoFlags.hasSkillVideo,
      canManageTournamentScorers: scorerFlags.canManageTournamentScorers,
      tournamentScorerCount: scorerFlags.tournamentScorerCount,
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
        _count: { select: { ...activeTeamCountSelect, groups: true } },
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
      videoUploadStartAt:
        dto.videoUploadStartAt !== undefined
          ? dto.videoUploadStartAt
          : existing.videoUploadStartAt?.toISOString() ?? null,
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

    if (existing.ballType === BallType.Tennis) {
      assertTennisTournamentLocationValid(
        dto.locationAddress !== undefined ? dto.locationAddress : existing.locationAddress,
        dto.latitude !== undefined ? dto.latitude : existing.latitude,
        dto.longitude !== undefined ? dto.longitude : existing.longitude,
      );
    }

    let normalizedDates: string[] | undefined;
    if (dto.dates !== undefined) {
      if (existing.ballType === BallType.Leather) {
        this.validateLeatherTournamentSpan(dto.dates, {
          timezone: existing.timezone,
          existingSpanDates: existingDates,
        });
        normalizedDates = normalizeTournamentDates(dto.dates);
        const spanStart = normalizedDates[0] as string;
        const spanEnd = normalizedDates[normalizedDates.length - 1] as string;
        const datesWithMatches = await this.getDatesWithScheduledMatches(id);
        for (const matchDate of datesWithMatches) {
          if (!isDateWithinLeatherSpan(matchDate, spanStart, spanEnd)) {
            throw new BadRequestException({
              message: TOURNAMENT_FORM_MESSAGES.tournamentDates.matchOutsideSpan(matchDate),
              error: 'DATE_HAS_SCHEDULED_MATCH',
              fields: {
                tournamentDates:
                  TOURNAMENT_FORM_MESSAGES.tournamentDates.matchOutsideSpan(matchDate),
              },
            });
          }
        }
        const { startAt, endAt } = deriveTournamentWindowFromDates(normalizedDates);
        merged.startAt = startAt;
        merged.endAt = endAt;
      } else {
        this.validateTournamentDatesForUpdate(existingDates, dto.dates, existing.timezone);
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
    }

    this.validateDates(merged);

    const data: Prisma.TournamentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.posterUrl !== undefined) {
      const nextPosterKey =
        dto.posterUrl === null ? null : this.normalizePosterUrlForStorage(dto.posterUrl);
      const existingPosterKey =
        existing.posterUrl != null
          ? (this.storage.resolveObjectKey(existing.posterUrl) ?? existing.posterUrl)
          : null;
      if (existingPosterKey && existingPosterKey !== nextPosterKey) {
        await this.storage.deleteObject(existing.posterUrl);
      }
      data.posterUrl = nextPosterKey;
    }
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
    if (dto.videoRequired === false) {
      data.videoUploadStartAt = null;
      data.videoUploadEndDate = null;
    } else {
      if (dto.videoUploadStartAt !== undefined) {
        data.videoUploadStartAt = dto.videoUploadStartAt
          ? new Date(dto.videoUploadStartAt)
          : null;
      }
      if (dto.videoUploadEndDate !== undefined) {
        data.videoUploadEndDate = dto.videoUploadEndDate
          ? new Date(dto.videoUploadEndDate)
          : null;
      }
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
    if (dto.feeFullTime !== undefined || dto.feePartTime !== undefined) {
      const fees = this.resolveTournamentFees(
        existing.ballType as BallType,
        dto.feeFullTime !== undefined ? dto.feeFullTime : decimalToNumberOrNull(existing.feeFullTime),
        dto.feePartTime !== undefined ? dto.feePartTime : decimalToNumberOrNull(existing.feePartTime),
      );
      data.feeFullTime = fees.feeFullTime;
      data.feePartTime = fees.feePartTime;
    }
    if (dto.provinceId !== undefined) {
      await this.assertActiveProvince(dto.provinceId);
      data.province = { connect: { id: dto.provinceId } };
    }

    if (dto.knockoutTeamCount !== undefined) {
      const nextNumberOfTeams =
        dto.numberOfTeams !== undefined ? dto.numberOfTeams : existing.numberOfTeams;
      const hasKnockoutBracket = await this.knockoutBracket.hasKnockoutBracket(id);
      await assertKnockoutTeamCountOnUpdate(
        existing.type as TournamentType,
        existing._count.groups,
        nextNumberOfTeams,
        existing.knockoutTeamCount,
        dto.knockoutTeamCount,
        hasKnockoutBracket,
      );
      data.knockoutTeamCount = dto.knockoutTeamCount;
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

    return this.getDetail(id, actor);
  }

  /** Edit-form payload with locked scope display and scheduling constraints. */
  async getEditForm(actor: AuthUser, id: string): Promise<TournamentEditFormData> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    assertTournamentActive(existing);

    await this.assertCenterSevakTournamentAccess(actor, existing);

    const [detail, scopeDisplay, datesWithMatches] = await Promise.all([
      this.getDetail(id, actor),
      buildTournamentScopeDisplay(
        this.prisma,
        id,
        existing.type as TournamentType,
        existing.ballType as BallType,
        existing.provinceId,
      ),
      this.getDatesWithScheduledMatches(id),
    ]);

    return { ...detail, scopeDisplay, datesWithMatches };
  }

  /** Dashboard tournament rows with per-record permissions for the current user. */
  async listDashboardEntries(actor: AuthUser): Promise<TournamentDashboardEntry[]> {
    const browse = await this.listBrowseEntries(actor);
    return selectDashboardTournaments(browse);
  }

  /** Dashboard tournament summaries (no permissions) — same priority selection as browse. */
  async listDashboardSummaries(actor: AuthUser): Promise<TournamentSummary[]> {
    const entries = await this.listDashboardEntries(actor);
    return entries.map((entry) => entry.tournament);
  }

  /**
   * Browse tab — Tennis APL/CENTER visible to all (actions gated separately);
   * Leather by the same access rule as detail.
   * Admin / Club Manager see all leather. Includes soft-deleted rows as cancelled.
   */
  async listBrowseEntries(actor: AuthUser): Promise<TournamentBrowseEntry[]> {
    const centerScope = this.tennisVisibility.centerTournamentListWhere(actor);
    const rows = await this.prisma.tournament.findMany({
      ...(centerScope ? { where: centerScope } : {}),
      include: { _count: { select: activeTeamCountSelect } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });

    const visible = await this.filterLeatherVisibleTournaments(actor, rows, {
      includeSoftDeleted: true,
    });

    return Promise.all(
      visible.map(async (row) => ({
        tournament: await this.toSummary(row),
        cancelled: row.isDeleted,
        permissions: row.isDeleted
          ? { canEdit: false, canDelete: false, canManageCenterPlayers: false }
          : await this.resolveTournamentMenuPermissions(actor, row),
      })),
    );
  }

  /**
   * Drops leather tournaments the viewer cannot open (same rule as detail).
   * Guests never receive leather rows.
   */
  private async filterLeatherVisibleTournaments<T extends { id: string; ballType: string }>(
    viewer: AuthUser | null | undefined,
    rows: T[],
    options: { includeSoftDeleted?: boolean } = {},
  ): Promise<T[]> {
    const leatherRows = rows.filter((row) => row.ballType === BallType.Leather);
    if (leatherRows.length === 0) {
      return rows;
    }
    if (!viewer) {
      return rows.filter((row) => row.ballType !== BallType.Leather);
    }
    const visibleIds = new Set(
      await this.leatherVisibility.getVisibleLeatherTournamentIds(viewer, options),
    );
    return rows.filter(
      (row) => row.ballType !== BallType.Leather || visibleIds.has(row.id),
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

    await assertCanScheduleTournamentMatches(this.permissions, this.prisma, actor, {
      id: existing.id,
      ballType: existing.ballType as BallType,
    });

    await this.assertCenterSevakTournamentAccess(actor, existing);

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { matchSchedulingFormat: schedulingFormat },
    });

    return this.getDetail(tournamentId, actor);
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
    return resolveOrHealCenterSevakCenterIds(this.prisma, userId);
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

  private resolveTournamentFees(
    ballType: BallType,
    feeFullTime: number | null | undefined,
    feePartTime: number | null | undefined,
  ): { feeFullTime: ReturnType<typeof numberToDecimalOrNull>; feePartTime: ReturnType<typeof numberToDecimalOrNull> } {
    return {
      feeFullTime: numberToDecimalOrNull(feeFullTime ?? null),
      feePartTime:
        ballType === BallType.Leather
          ? numberToDecimalOrNull(feePartTime ?? null)
          : null,
    };
  }

  private validateDates(dto: {
    startAt: string;
    endAt: string;
    registrationOpenAt?: string | null;
    registrationCloseAt?: string | null;
    videoRequired?: boolean;
    videoUploadStartAt?: string | null;
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
      if (!dto.videoUploadStartAt) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.videoUploadStartDate.required,
          error: 'VIDEO_WINDOW_REQUIRED',
          fields: {
            videoUploadStartDate: TOURNAMENT_FORM_MESSAGES.videoUploadStartDate.required,
          },
        });
      }
      if (!dto.videoUploadEndDate) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.required,
          error: 'VIDEO_DATE_REQUIRED',
          fields: videoDateRequiredFields(),
        });
      }
      if (new Date(dto.videoUploadEndDate) <= new Date(dto.videoUploadStartAt)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.afterStart,
          error: 'INVALID_VIDEO_WINDOW',
          fields: videoDateAfterStartFields(),
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

  private validateLeatherTournamentSpan(
    dates: string[],
    options?: {
      timezone?: string | null;
      existingSpanDates?: string[];
    },
  ): void {
    if (!dates || dates.length === 0) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherFromRequired,
        error: 'TOURNAMENT_DATES_REQUIRED',
        fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherFromRequired },
      });
    }

    const timeZone = serverVenueTimezone(options?.timezone);
    const todayOnly = formatTodayDateOnlyInZone(timeZone);
    const unchangedDates = new Set(options?.existingSpanDates ?? []);

    for (const raw of dates) {
      if (!isIsoDateOnly(raw)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherFromRequired,
          error: 'INVALID_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherFromRequired },
        });
      }
      const isUnchanged = unchangedDates.has(raw);
      if (compareIsoDateOnly(raw, todayOnly) < 0 && !isUnchanged) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.past,
          error: 'PAST_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.past },
        });
      }
    }

    const normalized = normalizeTournamentDates(dates);
    const fromDate = normalized[0] as string;
    const endDate = normalized[normalized.length - 1] as string;
    if (compareIsoDateOnly(endDate, fromDate) < 0) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.tournamentDates.endBeforeFrom,
        error: 'INVALID_TOURNAMENT_DATE_RANGE',
        fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.endBeforeFrom },
      });
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
  private validateTournamentDatesForUpdate(
    existingDates: string[],
    dates: string[],
    timezone?: string | null,
  ): void {
    if (!dates || dates.length === 0) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
        error: 'TOURNAMENT_DATES_REQUIRED',
        fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
      });
    }

    const todayOnly = formatTodayDateOnlyInZone(serverVenueTimezone(timezone));
    const existingSet = new Set(existingDates);
    for (const raw of dates) {
      if (!isIsoDateOnly(raw)) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.required,
          error: 'INVALID_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.required },
        });
      }
      if (!existingSet.has(raw) && compareIsoDateOnly(raw, todayOnly) < 0) {
        throw new BadRequestException({
          message: TOURNAMENT_FORM_MESSAGES.tournamentDates.past,
          error: 'PAST_TOURNAMENT_DATE',
          fields: { tournamentDates: TOURNAMENT_FORM_MESSAGES.tournamentDates.past },
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

  private async notifyOnTournamentEdit(
    existing: Tournament & { scheduledDates: { date: Date }[] },
    dto: UpdateTournamentDto,
    normalizedDates: string[] | undefined,
  ): Promise<void> {
    const tournamentId = existing.id;
    const existingDates = existing.scheduledDates.map((entry) => formatUtcIsoDate(entry.date));

    if (normalizedDates !== undefined && !sameSortedDateList(existingDates, normalizedDates)) {
      await this.notifyRegistrants(tournamentId, NotificationTrigger.TournamentDatesChanged);
    }

    if (dtoHasLocationChange(existing, dto)) {
      await this.notifyRegistrants(tournamentId, NotificationTrigger.TournamentLocationChanged);
    }

    if (dtoHasRegistrationWindowChange(existing, dto)) {
      await this.notifyRegistrants(
        tournamentId,
        NotificationTrigger.TournamentRegistrationWindowChanged,
      );
    }

    if (dtoHasVideoPolicyChange(existing, dto)) {
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

  /**
   * Center Sevak Multi-center create: at least one of their assigned centers
   * must be among the selected centers. Admin / Club Manager are unaffected.
   */
  private async assertCenterSevakMultiCenterIncludesOwn(
    actor: AuthUser,
    dto: CreateTournamentDto,
  ): Promise<void> {
    if (actor.role !== UserRole.CenterSevak) {
      return;
    }
    if (dto.ballType !== BallType.Tennis || dto.citySelection !== CitySelection.Multi) {
      return;
    }
    const selected = dto.centerIds ?? [];
    if (selected.length === 0) {
      return;
    }
    const sevakCenterIds = await this.resolveCenterSevakCenterIds(actor.id);
    const includesOwn = selected.some((id) => sevakCenterIds.includes(id));
    if (!includesOwn) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.centers.ownCenterRequired,
        error: 'OWN_CENTER_REQUIRED',
        fields: { centers: TOURNAMENT_FORM_MESSAGES.centers.ownCenterRequired },
      });
    }
  }

  private async assertActiveProvince(provinceId: string): Promise<void> {
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      select: { id: true, isActive: true },
    });
    if (!province?.isActive) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.province.required,
        error: 'INVALID_PROVINCE',
        fields: { province: TOURNAMENT_FORM_MESSAGES.province.required },
      });
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
    if (dto.citySelection === CitySelection.Apl) {
      if (dto.tournamentTypeDefinitionId) {
        const definition = await tx.tournamentTypeDefinition.findFirst({
          where: {
            id: dto.tournamentTypeDefinitionId,
            provinceId: dto.provinceId,
            ballType: BallType.Tennis,
            isDeleted: false,
          },
          include: { centerLinks: { select: { centerId: true } } },
        });
        if (!definition) {
          throw new BadRequestException({
            message: 'Tournament type is invalid for this province',
            error: 'INVALID_TOURNAMENT_TYPE',
            fields: { citySelection: 'Select a valid tournament type for this province' },
          });
        }
        centerIds = definition.centerLinks
          .map((link) => link.centerId)
          .filter((id) => activeIds.has(id));
        if (centerIds.length === 0) {
          throw new BadRequestException({
            message: 'This tournament type has no active centers in the selected province',
            error: 'TOURNAMENT_TYPE_NO_CENTERS',
            fields: { citySelection: 'Choose another type or add centers to this type' },
          });
        }
      } else {
        // Prefer Admin-defined APL participating centers; fall back to all active
        // centers in the province when no APL type is configured yet.
        const aplDefinition = await tx.tournamentTypeDefinition.findFirst({
          where: {
            code: 'APL',
            provinceId: dto.provinceId,
            ballType: BallType.Tennis,
            isDeleted: false,
          },
          include: { centerLinks: { select: { centerId: true } } },
        });
        if (aplDefinition && aplDefinition.centerLinks.length > 0) {
          centerIds = aplDefinition.centerLinks
            .map((link) => link.centerId)
            .filter((id) => activeIds.has(id));
        } else {
          centerIds = activeInProvince.map((c) => c.id);
        }
      }
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
    try {
      const tournament = await this.prisma.tournament.findFirst({
        where: { id: tournamentId, isDeleted: false },
        select: { id: true, name: true },
      });
      if (!tournament) {
        return;
      }

      const userIds = await this.notificationAudience.resolveTournamentRegisteredPlayers(
        tournamentId,
      );
      if (userIds.length === 0) {
        return;
      }

      const copy = midTournamentNotifyCopy(trigger, tournament.name);
      await this.notifications.sendToAudience(userIds, {
        triggerKey: trigger,
        // Each edit should notify again — include a time slice for uniqueness.
        dedupeKey: `${trigger}:${tournamentId}:${Date.now()}`,
        title: copy.title,
        body: copy.body,
        data: { tournamentId, screen: 'tournament' },
        audienceSummary: `Registered players of tournament ${tournamentId}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to notify registrants for ${trigger} on tournament ${tournamentId}`,
        err as Error,
      );
    }
  }

  private normalizePosterUrlForStorage(posterUrl: string): string {
    return this.storage.resolveObjectKey(posterUrl) ?? posterUrl;
  }

  private async toSummaryFields(row: TournamentWithCounts): Promise<Omit<TournamentSummary, 'scopeDisplay'>> {
    const posterUrl = await this.mediaUrls.resolveReadUrl(row.posterUrl);
    const startAt = row.startAt.toISOString();
    const endAt = row.endAt.toISOString();
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      type: row.type,
      state: row.state,
      displayStatus: deriveTournamentDisplayStatus({
        startAt,
        endAt,
        timezone: row.timezone,
      }),
      ballType: row.ballType,
      posterUrl,
      startAt,
      endAt,
      locationAddress: row.locationAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      provinceId: row.provinceId,
      timezone: row.timezone,
      teamCount: row._count.teams,
    };
  }

  private async toSummary(row: TournamentWithCounts): Promise<TournamentSummary> {
    const scopeDisplay = await buildTournamentScopeDisplay(
      this.prisma,
      row.id,
      row.type as TournamentType,
      row.ballType as BallType,
      row.provinceId,
    );
    return {
      ...(await this.toSummaryFields(row)),
      scopeDisplay,
    };
  }
}

function midTournamentNotifyCopy(
  trigger: NotificationTrigger,
  tournamentName: string,
): { title: string; body: string } {
  switch (trigger) {
    case NotificationTrigger.TournamentDeletedMidRegistration:
      return {
        title: 'Tournament cancelled',
        body: `${tournamentName} was deleted. Open the app for details.`,
      };
    case NotificationTrigger.TournamentDatesChanged:
      return {
        title: 'Tournament dates changed',
        body: `The schedule for ${tournamentName} was updated.`,
      };
    case NotificationTrigger.TournamentLocationChanged:
      return {
        title: 'Tournament location changed',
        body: `The venue for ${tournamentName} was updated.`,
      };
    case NotificationTrigger.TournamentRegistrationWindowChanged:
      return {
        title: 'Registration window changed',
        body: `Registration dates for ${tournamentName} were updated.`,
      };
    case NotificationTrigger.TournamentVideoPolicyChanged:
      return {
        title: 'Video upload policy changed',
        body: `Skill-video requirements for ${tournamentName} were updated.`,
      };
    case NotificationTrigger.TournamentEditedMidRegistration:
    default:
      return {
        title: 'Tournament updated',
        body: `${tournamentName} was updated. Open the app for details.`,
      };
  }
}

function sameSortedDateList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((date, index) => date === b[index]);
}

function sameNullableInstant(
  next: string | null | undefined,
  previous: Date | null | undefined,
): boolean {
  const nextMs = next == null || next === '' ? null : Date.parse(next);
  const previousMs = previous == null ? null : previous.getTime();
  if (nextMs === null && previousMs === null) {
    return true;
  }
  if (nextMs === null || previousMs === null || Number.isNaN(nextMs)) {
    return false;
  }
  return nextMs === previousMs;
}

function sameNullableNumber(
  next: number | null | undefined,
  previous: number | null | undefined,
): boolean {
  if (next == null && previous == null) {
    return true;
  }
  if (next == null || previous == null) {
    return false;
  }
  return next === previous;
}

function dtoHasLocationChange(
  existing: Pick<Tournament, 'locationAddress' | 'latitude' | 'longitude'>,
  dto: UpdateTournamentDto,
): boolean {
  if (
    dto.locationAddress === undefined &&
    dto.latitude === undefined &&
    dto.longitude === undefined
  ) {
    return false;
  }
  const nextAddress =
    dto.locationAddress !== undefined ? dto.locationAddress : existing.locationAddress;
  const nextLat = dto.latitude !== undefined ? dto.latitude : existing.latitude;
  const nextLng = dto.longitude !== undefined ? dto.longitude : existing.longitude;
  return (
    (nextAddress ?? null) !== (existing.locationAddress ?? null) ||
    !sameNullableNumber(nextLat, existing.latitude) ||
    !sameNullableNumber(nextLng, existing.longitude)
  );
}

function dtoHasRegistrationWindowChange(
  existing: Pick<Tournament, 'registrationOpenAt' | 'registrationCloseAt'>,
  dto: UpdateTournamentDto,
): boolean {
  if (dto.registrationOpenAt === undefined && dto.registrationCloseAt === undefined) {
    return false;
  }
  if (
    dto.registrationOpenAt !== undefined &&
    !sameNullableInstant(dto.registrationOpenAt, existing.registrationOpenAt)
  ) {
    return true;
  }
  if (
    dto.registrationCloseAt !== undefined &&
    !sameNullableInstant(dto.registrationCloseAt, existing.registrationCloseAt)
  ) {
    return true;
  }
  return false;
}

function dtoHasVideoPolicyChange(
  existing: Pick<Tournament, 'videoRequired' | 'videoUploadStartAt' | 'videoUploadEndDate'>,
  dto: UpdateTournamentDto,
): boolean {
  if (
    dto.videoRequired === undefined &&
    dto.videoUploadStartAt === undefined &&
    dto.videoUploadEndDate === undefined
  ) {
    return false;
  }
  if (dto.videoRequired !== undefined && dto.videoRequired !== existing.videoRequired) {
    return true;
  }
  if (
    dto.videoUploadStartAt !== undefined &&
    !sameNullableInstant(dto.videoUploadStartAt, existing.videoUploadStartAt)
  ) {
    return true;
  }
  if (
    dto.videoUploadEndDate !== undefined &&
    !sameNullableInstant(dto.videoUploadEndDate, existing.videoUploadEndDate)
  ) {
    return true;
  }
  return false;
}
