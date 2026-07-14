import {
  type AuthUser,
  BallType,
  type AvailabilitySummary,
  type CustomFormRequestSummary,
  isTournamentRegistrationOpen,
  isTournamentRegistrationWindowClosed,
  isRegistrationVerificationComplete,
  Permission,
  PlayerSkillVideoStatus,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RegistrationFieldDefinitionInput,
  RegistrationPlayerType,
  RegistrationSortKey,
  RegistrationStatus,
  type RegistrationSummary,
  type RegistrationVerificationQueue,
  type CenterPlayerRosterEntry,
  RegistrationVerificationPhase,
  type TournamentFavouritePlayersView,
  type LeatherRegisteredPlayersView,
  type LateRegisterCandidatesView,
  type VerifiedRegisteredPlayersView,
  type VerifiedRegisteredPlayerRow,
  type SetRegistrationFavouriteResponse,
  tournamentHasRegistrationWindow,
  hasRegistrationOpened,
  bowlingStyleFromType,
  canSelfRegisterForTournament,
  formatVenueDateTime,
  serverVenueTimezone,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { favouritesLeadTeamIdInTournament } from '../authz/team-leader.util';
import { PermissionService } from '../authz/permission.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { selectableUserWhere } from '../users/user-query';
import { LeatherTournamentVisibilityService } from '../tournaments/leather-tournament-visibility.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import type { BuildCustomFormDto, CreateCustomFormRequestDto } from './dto/custom-form.dto';
import type { ListLeatherRegisteredPlayersDto } from './dto/list-leather-registrations.dto';
import type { ListRegistrationsDto } from './dto/list-registrations.dto';
import type { SubmitRegistrationDto, LateRegistrationDto } from './dto/submit-registration.dto';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto';
import type { UpdateRatingsDto } from './dto/update-ratings.dto';

/** Registration row with the joins the read projections need. */
type RegistrationRow = Prisma.RegistrationGetPayload<{
  include: {
    user: {
      select: {
        firstName: true;
        lastName: true;
        mobileNumber: true;
        profilePhotoUrl: true;
      };
    };
    center: { select: { name: true } };
  };
}>;

const REGISTRATION_INCLUDE = {
  user: {
    select: { firstName: true, lastName: true, mobileNumber: true, profilePhotoUrl: true },
  },
  center: { select: { name: true } },
} as const;

/**
 * Player registration flow (spec ?7): submission and the In Waitlist ��� Confirmed
 * / Declined lifecycle (?7.3), Center-scoped approval and visibility (?7.4),
 * APL ratings & availability (?7.5), late registration (?7.6) and the ?7.2/?21
 * custom-form definitions.
 */
@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly leatherVisibility: LeatherTournamentVisibilityService,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  // --- Submission (?7.1, ?7.3) ---------------------------------------------

  /** A player submits their own registration. Tennis ? In Waitlist (?7.3); leather ? Confirmed. */
  async submit(
    actor: AuthUser,
    tournamentId: string,
    dto: SubmitRegistrationDto,
  ): Promise<RegistrationDetail> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationWindowOpen(tournament);
    if (!canSelfRegisterForTournament(actor.role)) {
      throw new ForbiddenException({
        message: 'You may not register for this tournament',
        error: 'FORBIDDEN',
      });
    }

    const ballType = tournament.ballType as BallType;
    await this.leatherVisibility.assertCanRegisterForLeather(actor, tournamentId, ballType);

    const existing = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
      select: { status: true },
    });
    if (existing?.status === RegistrationStatus.Confirmed) {
      throw new BadRequestException({
        message: 'You are already registered for this tournament',
        error: 'ALREADY_REGISTERED',
      });
    }

    await this.validateCustomFields(tournamentId, dto.customFields ?? null);
    const centerId = await this.resolveRegistrationCenterForUser(actor.id, dto.centerId);
    await this.syncPlayerProfile(actor.id, dto.firstName, dto.lastName, centerId);
    const playerType = this.resolvePlayerTypeForWrite(ballType, dto.playerType);
    const detail = await this.upsertRegistration(
      tournamentId,
      actor.id,
      centerId,
      dto,
      tournament.defaultPlayerFeeCents,
      playerType,
      ballType,
    );

    if (ballType === BallType.Leather) {
      await this.notifications.notify(NotificationTrigger.RegistrationConfirmed, {
        recipientUserIds: [actor.id],
        data: { tournamentId },
      });
    }

    await this.notifyVideoUploadDeadline(actor.id, tournament);

    return detail;
  }

  /**
   * §17 Phase C #12 (event side): when a player registers for a tournament that
   * requires a skill video, inform them of the upload deadline immediately.
   * Best-effort — never blocks registration.
   */
  private async notifyVideoUploadDeadline(
    userId: string,
    tournament: {
      id: string;
      name: string;
      timezone: string | null;
      videoRequired: boolean;
      videoUploadEndDate: Date | null;
    },
  ): Promise<void> {
    if (!tournament.videoRequired || tournament.videoUploadEndDate == null) {
      return;
    }
    try {
      const zone = serverVenueTimezone(tournament.timezone);
      const deadline = formatVenueDateTime(tournament.videoUploadEndDate, zone, {
        includeWeekday: true,
        includeYear: true,
      });
      await this.notifications.sendToAudience([userId], {
        triggerKey: NotificationTrigger.VideoUploadDeadline,
        dedupeKey: `${NotificationTrigger.VideoUploadDeadline}:${tournament.id}:${userId}`,
        title: 'Skill video required',
        body: `Upload your skill video for ${tournament.name} by ${deadline}.`,
        data: { tournamentId: tournament.id, screen: 'tournament' },
        audienceSummary: `Registrant ${userId} of tournament ${tournament.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Video-upload-deadline notification failed for tournament ${tournament.id}`,
        err as Error,
      );
    }
  }

  /** Late registration of a missed player by Admin / Club Manager / Center Sevak (§7.6). */
  async lateRegister(
    actor: AuthUser,
    tournamentId: string,
    dto: LateRegistrationDto,
  ): Promise<RegistrationDetail> {
    const tournament = await this.requireTournament(tournamentId);
    const ballType = tournament.ballType as BallType;
    this.assertCenterSevakTennisOnly(actor, ballType);

    const player = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, centerId: true },
    });
    if (!player) {
      throw new NotFoundException({ message: 'Player not found', error: 'NOT_FOUND' });
    }

    const existing = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: dto.userId } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        message: 'Player is already registered for this tournament',
        error: 'ALREADY_REGISTERED',
      });
    }

    const allowed = await this.permissions.check(Permission.REGISTER_LATE_PLAYER, actor, {
      tournamentId,
      targetCenterId: dto.centerId,
      targetUserId: player.id,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You cannot register a late player here',
        error: 'FORBIDDEN',
      });
    }

    if (player.centerId !== dto.centerId) {
      throw new BadRequestException({
        message: 'Late registration must use the player\'s own center',
        error: 'INVALID_CENTER',
      });
    }

    await this.assertSevakOwnCenter(actor, player.centerId);
    await this.assertCenterParticipatesInTournament(tournamentId, ballType, player.centerId);

    await this.validateCustomFields(tournamentId, dto.customFields ?? null);
    const centerId = await this.resolveRegistrationCenterForUser(player.id, dto.centerId);
    await this.syncPlayerProfile(player.id, dto.firstName, dto.lastName, centerId);
    const playerType = this.resolvePlayerTypeForWrite(ballType, dto.playerType);

    const detail = await this.createConfirmedLateRegistration(
      tournamentId,
      player.id,
      centerId,
      dto,
      actor.id,
      tournament.defaultPlayerFeeCents,
      playerType,
    );

    await this.audit.record({
      action: 'REGISTRATION_LATE_CONFIRM',
      actorUserId: actor.id,
      targetUserId: player.id,
      targetEntityType: 'registration',
      targetEntityId: detail.id,
      after: {
        tournamentId,
        status: RegistrationStatus.Confirmed,
        centerId: detail.centerId,
        battingRating: detail.battingRating,
        bowlingRating: detail.bowlingRating,
        fieldingRating: detail.fieldingRating,
        reviewedByUserId: actor.id,
        source: 'LATE_REGISTER',
      },
    });

    await this.notifications.notify(NotificationTrigger.RegistrationConfirmed, {
      recipientUserIds: [player.id],
      data: { tournamentId },
    });

    return detail;
  }

  private async createConfirmedLateRegistration(
    tournamentId: string,
    userId: string,
    centerId: string,
    dto: SubmitRegistrationDto,
    reviewedByUserId: string,
    feeAmountCents: bigint | null,
    playerType: RegistrationPlayerType | null,
  ): Promise<RegistrationDetail> {
    const customFields =
      dto.customFields === undefined
        ? undefined
        : (dto.customFields as Prisma.InputJsonValue | null);
    const bowlingStyle =
      dto.bowlingStyle ?? bowlingStyleFromType(dto.bowlingType ?? null);
    const reviewedAt = new Date();

    const row = await this.prisma.registration.create({
      data: {
        tournamentId,
        userId,
        centerId,
        status: RegistrationStatus.Confirmed,
        reviewedByUserId,
        reviewedAt,
        battingStyle: dto.battingStyle ?? null,
        battingRating: dto.battingRating ?? null,
        battingPosition: dto.battingPosition ?? null,
        playerRole: dto.playerRole ?? null,
        bowlingStyle,
        bowlingType: dto.bowlingType ?? null,
        bowlingRating: dto.bowlingRating ?? null,
        fieldingRating: dto.fieldingRating ?? null,
        fieldingPosition: dto.fieldingPosition ?? null,
        playerType,
        customFields: customFields ?? Prisma.JsonNull,
        feeAmountCents,
      },
      include: REGISTRATION_INCLUDE,
    });
    return this.resolveSummaryPhoto(this.toDetail(row));
  }

  private async upsertRegistration(
    tournamentId: string,
    userId: string,
    centerId: string,
    dto: SubmitRegistrationDto,
    feeAmountCents: bigint | null,
    playerType: RegistrationPlayerType | null,
    ballType: BallType,
  ): Promise<RegistrationDetail> {
    const customFields =
      dto.customFields === undefined
        ? undefined
        : (dto.customFields as Prisma.InputJsonValue | null);
    const bowlingStyle =
      dto.bowlingStyle ?? bowlingStyleFromType(dto.bowlingType ?? null);
    const status = this.initialRegistrationStatus(ballType);

    const row = await this.prisma.registration.upsert({
      where: { tournamentId_userId: { tournamentId, userId } },
      create: {
        tournamentId,
        userId,
        centerId,
        status,
        battingStyle: dto.battingStyle ?? null,
        battingRating: dto.battingRating ?? null,
        battingPosition: dto.battingPosition ?? null,
        playerRole: dto.playerRole ?? null,
        bowlingStyle,
        bowlingType: dto.bowlingType ?? null,
        bowlingRating: dto.bowlingRating ?? null,
        fieldingRating: dto.fieldingRating ?? null,
        fieldingPosition: dto.fieldingPosition ?? null,
        playerType,
        customFields: customFields ?? Prisma.JsonNull,
        feeAmountCents,
      },
      update: {
        centerId,
        status,
        battingStyle: dto.battingStyle ?? null,
        battingRating: dto.battingRating ?? null,
        battingPosition: dto.battingPosition ?? null,
        playerRole: dto.playerRole ?? null,
        bowlingStyle,
        bowlingType: dto.bowlingType ?? null,
        bowlingRating: dto.bowlingRating ?? null,
        fieldingRating: dto.fieldingRating ?? null,
        fieldingPosition: dto.fieldingPosition ?? null,
        playerType,
        ...(customFields !== undefined ? { customFields: customFields ?? Prisma.JsonNull } : {}),
        ...(ballType === BallType.Tennis
          ? { reviewedByUserId: null, reviewedAt: null }
          : {}),
        feeAmountCents,
      },
      include: REGISTRATION_INCLUDE,
    });
    return this.resolveSummaryPhoto(this.toDetail(row));
  }

  // --- Review lifecycle (?7.3) ---------------------------------------------

  async approve(actor: AuthUser, registrationId: string): Promise<RegistrationDetail> {
    return this.review(actor, registrationId, RegistrationStatus.Confirmed);
  }

  async decline(actor: AuthUser, registrationId: string): Promise<RegistrationDetail> {
    return this.review(actor, registrationId, RegistrationStatus.Declined);
  }

  private async review(
    actor: AuthUser,
    registrationId: string,
    status: typeof RegistrationStatus.Confirmed | typeof RegistrationStatus.Declined,
  ): Promise<RegistrationDetail> {
    const existing = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, status: true, userId: true, tournamentId: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Registration not found', error: 'NOT_FOUND' });
    }
    const tournament = await this.requireTournament(existing.tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);
    this.assertRegistrationWindowClosed(tournament);

    const row = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { status, reviewedByUserId: actor.id, reviewedAt: new Date() },
      include: REGISTRATION_INCLUDE,
    });
    await this.audit.record({
      action: status === RegistrationStatus.Confirmed ? 'REGISTRATION_CONFIRM' : 'REGISTRATION_DECLINE',
      actorUserId: actor.id,
      targetUserId: existing.userId,
      targetEntityType: 'registration',
      targetEntityId: registrationId,
      before: { status: existing.status },
      after: { status },
    });
    // ?7.3: notify the player on confirm/decline.
    await this.notifications.notify(
      status === RegistrationStatus.Confirmed
        ? NotificationTrigger.RegistrationConfirmed
        : NotificationTrigger.RegistrationDeclined,
      { recipientUserIds: [existing.userId], data: { tournamentId: existing.tournamentId } },
    );
    return this.resolveSummaryPhoto(this.toDetail(row));
  }

  // --- Ratings & availability (?7.5, APL) ----------------------------------

  async updateRatings(
    actor: AuthUser,
    tournamentId: string,
    registrationId: string,
    dto: UpdateRatingsDto,
  ): Promise<RegistrationDetail> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);
    this.assertCenterSevakTennisOnly(actor, tournament.ballType as BallType);
    this.assertRegistrationWindowClosed(tournament);

    const existing = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        userId: true,
        tournamentId: true,
        centerId: true,
        battingRating: true,
        bowlingRating: true,
        fieldingRating: true,
      },
    });
    if (!existing || existing.tournamentId !== tournamentId) {
      throw new NotFoundException({ message: 'Registration not found', error: 'NOT_FOUND' });
    }
    await this.assertSevakOwnCenter(actor, existing.centerId);

    const data: Prisma.RegistrationUpdateInput = {};
    if (dto.battingRating !== undefined) {
      data.battingRating = dto.battingRating;
    }
    if (dto.bowlingRating !== undefined) {
      data.bowlingRating = dto.bowlingRating;
    }
    if (dto.fieldingRating !== undefined) {
      data.fieldingRating = dto.fieldingRating;
    }
    if (dto.playerType !== undefined) {
      data.playerType = this.resolvePlayerTypeForWrite(
        tournament.ballType as BallType,
        dto.playerType,
      );
    }

    const row = await this.prisma.registration.update({
      where: { id: registrationId },
      data,
      include: REGISTRATION_INCLUDE,
    });

    await this.audit.record({
      action: 'REGISTRATION_RATINGS_ADJUST',
      actorUserId: actor.id,
      targetUserId: existing.userId,
      targetEntityType: 'registration',
      targetEntityId: registrationId,
      before: {
        battingRating: existing.battingRating,
        bowlingRating: existing.bowlingRating,
        fieldingRating: existing.fieldingRating,
      },
      after: {
        battingRating: row.battingRating,
        bowlingRating: row.bowlingRating,
        fieldingRating: row.fieldingRating,
      },
    });

    return this.resolveSummaryPhoto(this.toDetail(row));
  }

  async updateAvailability(
    registrationId: string,
    dto: UpdateAvailabilityDto,
  ): Promise<RegistrationDetail> {
    await this.requireRegistration(registrationId);
    const row = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { isAvailable: dto.isAvailable, availabilityNote: dto.availabilityNote ?? null },
      include: REGISTRATION_INCLUDE,
    });
    return this.resolveSummaryPhoto(this.toDetail(row));
  }

  /** Aggregate availability of confirmed players for the ?7.5 bar-chart. */
  async availabilitySummary(tournamentId: string): Promise<AvailabilitySummary> {
    await this.requireTournament(tournamentId);
    const confirmed = await this.prisma.registration.findMany({
      where: { tournamentId, status: RegistrationStatus.Confirmed },
      select: { isAvailable: true },
    });
    const available = confirmed.filter((r) => r.isAvailable === true).length;
    const unavailable = confirmed.filter((r) => r.isAvailable === false).length;
    const pending = confirmed.filter((r) => r.isAvailable === null).length;
    return { available, unavailable, pending, total: confirmed.length };
  }

  // --- Listing & visibility (?7.4) -----------------------------------------

  /** Lists registrations honouring the ?7.4 Center-visibility rules. */
  async list(
    actor: AuthUser,
    tournamentId: string,
    query: ListRegistrationsDto,
  ): Promise<RegistrationSummary[]> {
    await this.requireTournament(tournamentId);
    const visibleCenters = await this.resolveVisibleCenters(actor, tournamentId);

    let centerFilter: string[] | undefined;
    if (query.centerId) {
      if (visibleCenters !== null && !visibleCenters.includes(query.centerId)) {
        return []; // Requested a Center outside the actor's visibility.
      }
      centerFilter = [query.centerId];
    } else if (visibleCenters !== null) {
      centerFilter = visibleCenters;
    }

    const rows = await this.prisma.registration.findMany({
      where: {
        tournamentId,
        ...(query.status ? { status: query.status } : {}),
        ...(centerFilter ? { centerId: { in: centerFilter } } : {}),
      },
      include: REGISTRATION_INCLUDE,
    });
    const summaries = this.sort(rows.map((row) => this.toSummary(row)), query.sort);
    return this.resolveSummaryPhotos(summaries);
  }

  /**
   * Verified (CONFIRMED) registrants across all centers ? Captain / VC / Club Manager
   * after Center Sevak verification completes (tennis only).
   */
  async listVerifiedRegisteredPlayers(
    actor: AuthUser,
    tournamentId: string,
    query: ListRegistrationsDto,
  ): Promise<VerifiedRegisteredPlayersView> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);

    const allowed = await this.permissions.check(
      Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
      actor,
      { tournamentId },
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view verified registered players',
        error: 'FORBIDDEN',
      });
    }

    await this.assertRegistrationVerificationComplete(tournament);

    const favouriteTeamId = await this.resolveFavouriteTeamId(actor, tournamentId);
    const favouritedUserIds = favouriteTeamId
      ? await this.loadFavouritedUserIds(tournamentId, favouriteTeamId)
      : new Set<string>();

    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, status: RegistrationStatus.Confirmed },
      include: REGISTRATION_INCLUDE,
    });
    const sorted = this.sort(rows.map((row) => this.toSummary(row)), query.sort);
    const skillVideos = await this.loadSkillVideoIdsByUser(
      tournamentId,
      sorted.map((summary) => summary.userId),
    );
    const players: VerifiedRegisteredPlayerRow[] = sorted.map((summary) => {
      const skillVideoId = skillVideos.get(summary.userId) ?? null;
      return {
        ...summary,
        isFavourited: favouritedUserIds.has(summary.userId),
        hasSkillVideo: skillVideoId != null,
        skillVideoId,
      };
    });

    return {
      players: await this.resolveSummaryPhotos(players),
      canFavourite: favouriteTeamId != null,
      favouriteTeamId,
      canLateRegister: await this.resolveCanLateRegister(actor, tournamentId),
    };
  }

  /**
   * Confirmed leather registrants — Admin / Club Manager squad-building list (ACC).
   * Available once the registration window has opened.
   */
  async listLeatherRegisteredPlayers(
    actor: AuthUser,
    tournamentId: string,
    query: ListLeatherRegisteredPlayersDto,
  ): Promise<LeatherRegisteredPlayersView> {
    const tournament = await this.requireTournament(tournamentId);
    if (tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Registered players list is only available for leather tournaments',
        error: 'NOT_LEATHER_TOURNAMENT',
      });
    }

    const allowed = await this.permissions.check(
      Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
      actor,
      { tournamentId },
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view registered players',
        error: 'FORBIDDEN',
      });
    }

    if (
      !tournamentHasRegistrationWindow({
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      }) ||
      !hasRegistrationOpened({
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
      })
    ) {
      throw new ForbiddenException({
        message: 'Registered players are available once registration opens',
        error: 'REGISTRATION_NOT_OPEN',
      });
    }

    const search = query.search?.trim();
    const page = query.page ?? 1;
    const limit = query.limit ?? 500;
    const skip = (page - 1) * limit;

    const where: Prisma.RegistrationWhereInput = {
      tournamentId,
      status: RegistrationStatus.Confirmed,
      ...(search
        ? {
            OR: [
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
              { center: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        include: REGISTRATION_INCLUDE,
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
        skip,
        take: limit,
      }),
      this.prisma.registration.count({ where }),
    ]);

    return {
      players: await this.resolveSummaryPhotos(rows.map((row) => this.toSummary(row))),
      totalCount,
      canLateRegister: await this.resolveCanLateRegister(actor, tournamentId),
    };
  }

  async setRegistrationFavourite(
    actor: AuthUser,
    tournamentId: string,
    userId: string,
    favourited: boolean,
  ): Promise<SetRegistrationFavouriteResponse> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);

    const allowed = await this.permissions.check(Permission.FAVOURITE_PLAYERS, actor, {
      tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to favourite players',
        error: 'FORBIDDEN',
      });
    }

    await this.assertRegistrationVerificationComplete(tournament);

    const teamId = await this.resolveFavouriteTeamId(actor, tournamentId);
    if (!teamId) {
      throw new ForbiddenException({
        message: 'Only team Captains, Vice-Captains, and Managers may favourite players',
        error: 'FORBIDDEN',
      });
    }

    const registration = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { status: true },
    });
    if (!registration || registration.status !== RegistrationStatus.Confirmed) {
      throw new NotFoundException({
        message: 'Verified registrant not found',
        error: 'NOT_FOUND',
      });
    }

    if (favourited) {
      await this.prisma.teamRegistrationFavourite.upsert({
        where: {
          tournamentId_teamId_userId: { tournamentId, teamId, userId },
        },
        create: {
          tournamentId,
          teamId,
          userId,
          favouritedByUserId: actor.id,
        },
        update: {
          favouritedByUserId: actor.id,
        },
      });
    } else {
      await this.prisma.teamRegistrationFavourite.deleteMany({
        where: { tournamentId, teamId, userId },
      });
    }

    return { userId, isFavourited: favourited };
  }

  /** Per-team favourites shortlist — shared by Captain, Vice-Captain, and Manager. */
  async listFavouritePlayers(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<TournamentFavouritePlayersView> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);

    const allowed = await this.permissions.check(Permission.FAVOURITE_PLAYERS, actor, {
      tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view favourite players',
        error: 'FORBIDDEN',
      });
    }

    await this.assertRegistrationVerificationComplete(tournament);

    const favouriteTeamId = await this.resolveFavouriteTeamId(actor, tournamentId);
    if (!favouriteTeamId) {
      return { favourites: [], canFavourite: false, favouriteTeamId: null };
    }

    const favouriteRows = await this.prisma.teamRegistrationFavourite.findMany({
      where: { tournamentId, teamId: favouriteTeamId },
      orderBy: [{ createdAt: 'asc' }],
      select: { userId: true },
    });
    if (favouriteRows.length === 0) {
      return { favourites: [], canFavourite: true, favouriteTeamId };
    }

    const userIds = favouriteRows.map((row) => row.userId);
    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        status: RegistrationStatus.Confirmed,
      },
      include: REGISTRATION_INCLUDE,
    });
    const byUserId = new Map(registrations.map((row) => [row.userId, row]));
    const skillVideos = await this.loadSkillVideoIdsByUser(tournamentId, userIds);
    const favourites: VerifiedRegisteredPlayerRow[] = favouriteRows.flatMap((row) => {
      const registration = byUserId.get(row.userId);
      if (!registration) {
        return [];
      }
      const summary = this.toSummary(registration);
      const skillVideoId = skillVideos.get(row.userId) ?? null;
      return [
        {
          ...summary,
          isFavourited: true,
          hasSkillVideo: skillVideoId != null,
          skillVideoId,
        },
      ];
    });

    return {
      favourites: await this.resolveSummaryPhotos(favourites),
      canFavourite: true,
      favouriteTeamId,
    };
  }

  /** ?7.3/?7.4: Center Sevak verification queue (tennis only ? leather has no verification). */
  async getVerificationQueue(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<RegistrationVerificationQueue> {
    const tournament = await this.requireTournament(tournamentId);
    this.assertRegistrationVerificationTournament(tournament.ballType as BallType);
    this.assertCenterSevakTennisOnly(actor, tournament.ballType as BallType);
    const centerIds = await this.resolveVerificationQueueCenterIds(actor, tournamentId);

    const registrationRows = await this.prisma.registration.findMany({
      where: { tournamentId, centerId: { in: centerIds } },
      include: REGISTRATION_INCLUDE,
    });

    const windowConfigured =
      tournament.registrationOpenAt !== null && tournament.registrationCloseAt !== null;
    const windowClosed =
      windowConfigured &&
      isTournamentRegistrationWindowClosed({
        registrationOpenAt: tournament.registrationOpenAt!.toISOString(),
        registrationCloseAt: tournament.registrationCloseAt!.toISOString(),
      });

    const registrationSummaries = registrationRows.map((row) => this.toSummary(row));
    const registered = windowClosed
      ? this.sortVerificationQueue(registrationSummaries)
      : this.sort(registrationSummaries, RegistrationSortKey.Name);
    const registeredUserIds = new Set(registrationRows.map((row) => row.userId));

    const centerUsers = await this.prisma.user.findMany({
      where: {
        centerId: { in: centerIds },
        ...selectableUserWhere,
        role: UserRole.Player,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        centerId: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const notRegistered: CenterPlayerRosterEntry[] = centerUsers
      .filter((user) => !registeredUserIds.has(user.id))
      .map((user) => ({
        userId: user.id,
        centerId: user.centerId,
        firstName: user.firstName,
        lastName: user.lastName,
        mobileNumber: user.mobileNumber,
        profilePhotoUrl: user.profilePhotoUrl,
      }));

    const pendingCount = registered.filter(
      (row) => row.status === RegistrationStatus.InWaitlist,
    ).length;
    const phase = windowClosed
      ? RegistrationVerificationPhase.Manage
      : RegistrationVerificationPhase.ViewOnly;
    const actionCount = windowClosed ? pendingCount : registered.length;
    const canManage = windowClosed;

    const canLateRegister = await this.resolveCanLateRegister(actor, tournamentId);

    return {
      phase,
      actionCount,
      registered: await this.resolveSummaryPhotos(registered),
      notRegistered: await this.resolveProfilePhotoUrls(notRegistered),
      registeredCount: registered.length,
      canManage,
      canLateRegister,
    };
  }

  /**
   * §7.6 picker: players who may be late-registered (tennis: tournament centers;
   * leather: existing / invited ACC players). Permission-gated.
   */
  async listLateRegisterCandidates(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<LateRegisterCandidatesView> {
    const tournament = await this.requireTournament(tournamentId);
    const ballType = tournament.ballType as BallType;
    this.assertCenterSevakTennisOnly(actor, ballType);

    const allowed = await this.resolveCanLateRegister(actor, tournamentId);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You cannot register a late player here',
        error: 'FORBIDDEN',
      });
    }

    if (ballType === BallType.Leather) {
      const players = await this.leatherVisibility.listLateRegisterCandidates(tournamentId);
      return { players: await this.resolveProfilePhotoUrls(players) };
    }

    const centerIds = await this.resolveLateRegisterCenterIds(actor, tournamentId);
    const registered = await this.prisma.registration.findMany({
      where: { tournamentId, centerId: { in: centerIds } },
      select: { userId: true },
    });
    const registeredUserIds = new Set(registered.map((row) => row.userId));

    const centerUsers = await this.prisma.user.findMany({
      where: {
        centerId: { in: centerIds },
        ...selectableUserWhere,
        role: UserRole.Player,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        centerId: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const players: CenterPlayerRosterEntry[] = centerUsers
      .filter((user) => !registeredUserIds.has(user.id))
      .map((user) => ({
        userId: user.id,
        centerId: user.centerId,
        firstName: user.firstName,
        lastName: user.lastName,
        mobileNumber: user.mobileNumber,
        profilePhotoUrl: user.profilePhotoUrl,
      }));

    return { players: await this.resolveProfilePhotoUrls(players) };
  }

  async getMine(actor: AuthUser, tournamentId: string): Promise<RegistrationDetail | null> {
    const row = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
      include: REGISTRATION_INCLUDE,
    });
    return row ? this.resolveSummaryPhoto(this.toDetail(row)) : null;
  }

  /**
   * ?7.4: Admin and Club Manager (APL/ACC) see all Centers; a Center Sevak sees only
   * their own Center(s) on tennis tournaments. Returns `null` for an unrestricted view,
   * the allowed Center ids for a scoped view, or throws for anyone else.
   */
  private async resolveVisibleCenters(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<string[] | null> {
    const tournament = await this.requireTournament(tournamentId);
    if (actor.role === UserRole.Admin) {
      return null;
    }
    const seesAll = await this.permissions.check(
      Permission.VIEW_REGISTRATIONS_ALL_CENTERS,
      actor,
      { tournamentId },
    );
    if (seesAll) {
      return null;
    }
    if ((tournament.ballType as BallType) === BallType.Leather) {
      throw new ForbiddenException({
        message: 'You do not have permission to view registrations for this tournament',
        error: 'FORBIDDEN',
      });
    }
    const sevakAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId: actor.id, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    const centerIds = sevakAssignments
      .map((a) => a.centerId)
      .filter((id): id is string => id !== null);
    if (centerIds.length > 0) {
      return centerIds;
    }
    throw new ForbiddenException({
      message: 'You do not have permission to view registrations',
      error: 'FORBIDDEN',
    });
  }

  /** Center Sevak only ? returns assigned center ids or throws. */
  private async requireCenterSevakCenterIds(actor: AuthUser): Promise<string[]> {
    const sevakAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId: actor.id, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    const centerIds = sevakAssignments
      .map((assignment) => assignment.centerId)
      .filter((id): id is string => id !== null);
    if (centerIds.length === 0) {
      throw new ForbiddenException({
        message: 'Center Sevak access is required',
        error: 'FORBIDDEN',
      });
    }
    return centerIds;
  }

  /** Leather ACC has no Center Sevak registration-management role. */
  private assertCenterSevakTennisOnly(actor: AuthUser, ballType: BallType): void {
    if (ballType !== BallType.Leather) {
      return;
    }
    if (actor.role === UserRole.CenterSevak || (actor.centerSevakCenterIds?.length ?? 0) > 0) {
      throw new ForbiddenException({
        message: 'Center Sevak cannot manage leather tournament registrations',
        error: 'FORBIDDEN',
      });
    }
  }

  /** Approve/decline, ratings review, and verification queue exist for tennis only. */
  private assertRegistrationVerificationTournament(ballType: BallType): void {
    if (ballType === BallType.Leather) {
      throw new ForbiddenException({
        message: 'Leather tournaments do not use player verification',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertRegistrationVerificationComplete(
    tournament: Awaited<ReturnType<typeof this.requireTournament>>,
  ): Promise<void> {
    const hasRegistrationWindow = tournamentHasRegistrationWindow({
      registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
    });
    const pendingWaitlistCount = await this.prisma.registration.count({
      where: {
        tournamentId: tournament.id,
        status: RegistrationStatus.InWaitlist,
      },
    });
    const complete = isRegistrationVerificationComplete(
      {
        ballType: tournament.ballType as BallType,
        hasRegistrationWindow,
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      },
      pendingWaitlistCount,
    );
    if (!complete) {
      throw new ForbiddenException({
        message: 'Player verification is not complete for this tournament',
        error: 'VERIFICATION_INCOMPLETE',
      });
    }
  }

  private initialRegistrationStatus(ballType: BallType): RegistrationStatus {
    return ballType === BallType.Leather
      ? RegistrationStatus.Confirmed
      : RegistrationStatus.InWaitlist;
  }

  /** Resolves which center ids feed the verification queue (tennis Center Sevak / Admin). */
  private async resolveVerificationQueueCenterIds(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<string[]> {
    if (actor.role === UserRole.Admin) {
      const links = await this.prisma.tournamentCenter.findMany({
        where: { tournamentId },
        select: { centerId: true },
      });
      return links.map((link) => link.centerId);
    }

    const allowed = await this.permissions.check(
      Permission.VIEW_REGISTRATIONS_OWN_CENTER,
      actor,
      { tournamentId },
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view the verification queue',
        error: 'FORBIDDEN',
      });
    }
    return this.requireCenterSevakCenterIds(actor);
  }

  /** Centers a late-registering actor may pull candidates from (tennis). */
  private async resolveLateRegisterCenterIds(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<string[]> {
    const links = await this.prisma.tournamentCenter.findMany({
      where: { tournamentId },
      select: { centerId: true },
    });
    const tournamentCenterIds = links.map((link) => link.centerId);
    if (tournamentCenterIds.length === 0) {
      return [];
    }

    if (actor.role === UserRole.Admin || actor.role === UserRole.ClubManager) {
      return tournamentCenterIds;
    }

    const sevakCenterIds = await this.findCenterSevakCenterIds(actor);
    const scoped = tournamentCenterIds.filter((id) => sevakCenterIds.includes(id));
    if (scoped.length === 0) {
      throw new ForbiddenException({
        message: 'Your center is not part of this tournament',
        error: 'FORBIDDEN',
      });
    }
    return scoped;
  }

  private async findCenterSevakCenterIds(actor: AuthUser): Promise<string[]> {
    if ((actor.centerSevakCenterIds?.length ?? 0) > 0) {
      return actor.centerSevakCenterIds ?? [];
    }
    const sevakAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId: actor.id, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    return sevakAssignments
      .map((assignment) => assignment.centerId)
      .filter((id): id is string => id !== null);
  }

  private async resolveCanLateRegister(actor: AuthUser, tournamentId: string): Promise<boolean> {
    return this.permissions.check(Permission.REGISTER_LATE_PLAYER, actor, { tournamentId });
  }

  /** Tennis: player center must be one of the tournament's selected centers. */
  private async assertCenterParticipatesInTournament(
    tournamentId: string,
    ballType: BallType,
    centerId: string,
  ): Promise<void> {
    if (ballType === BallType.Leather) {
      return;
    }
    const link = await this.prisma.tournamentCenter.findFirst({
      where: { tournamentId, centerId },
      select: { centerId: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'Player center is not part of this tournament',
        error: 'FORBIDDEN',
      });
    }
  }

  /** When the actor is a Center Sevak, the target must belong to one of their centers. */
  private async assertSevakOwnCenter(actor: AuthUser, targetCenterId: string): Promise<void> {
    const sevakAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId: actor.id, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    const centerIds = sevakAssignments
      .map((assignment) => assignment.centerId)
      .filter((id): id is string => id !== null);
    if (centerIds.length === 0) {
      return;
    }
    if (!centerIds.includes(targetCenterId)) {
      throw new ForbiddenException({
        message: 'You can only manage players from your own center',
        error: 'FORBIDDEN',
      });
    }
  }

  // --- Custom forms (?7.2, ?21) --------------------------------------------

  async listFormFields(tournamentId: string): Promise<RegistrationFieldDefinition[]> {
    const rows = await this.prisma.registrationFieldDefinition.findMany({
      where: { tournamentId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      fieldType: row.fieldType,
      required: row.required,
      options: this.parseOptions(row.options),
      position: row.position,
    }));
  }

  /** Admin builds (replaces) a tournament's custom form (?7.2). */
  async buildCustomForm(
    tournamentId: string,
    dto: BuildCustomFormDto,
  ): Promise<RegistrationFieldDefinition[]> {
    await this.requireTournament(tournamentId);
    this.assertUniqueKeys(dto.fields);
    await this.prisma.$transaction(async (tx) => {
      await tx.registrationFieldDefinition.deleteMany({ where: { tournamentId } });
      if (dto.fields.length > 0) {
        await tx.registrationFieldDefinition.createMany({
          data: dto.fields.map((field, index) => ({
            tournamentId,
            key: field.key,
            label: field.label,
            fieldType: field.fieldType,
            required: field.required ?? false,
            options:
              field.options && field.options.length > 0
                ? (field.options as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            position: field.position ?? index,
          })),
        });
      }
    });
    return this.listFormFields(tournamentId);
  }

  /** Organizer requests extra fields from Admin (?7.2). */
  async requestCustomForm(
    actor: AuthUser,
    tournamentId: string,
    dto: CreateCustomFormRequestDto,
  ): Promise<CustomFormRequestSummary> {
    await this.requireTournament(tournamentId);
    const row = await this.prisma.customFormRequest.create({
      data: {
        tournamentId,
        requestedByUserId: actor.id,
        note: dto.note ?? null,
        requestedFields:
          dto.requestedFields && dto.requestedFields.length > 0
            ? (dto.requestedFields as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
    return this.toCustomFormRequestSummary(row);
  }

  async listCustomFormRequests(tournamentId: string): Promise<CustomFormRequestSummary[]> {
    const rows = await this.prisma.customFormRequest.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toCustomFormRequestSummary(row));
  }

  // --- helpers -------------------------------------------------------------

  private async requireTournament(
    tournamentId: string,
  ): Promise<{
    id: string;
    name: string;
    state: string;
    type: string;
    ballType: string;
    timezone: string | null;
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
    videoRequired: boolean;
    videoUploadEndDate: Date | null;
    defaultPlayerFeeCents: bigint | null;
  }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        state: true,
        type: true,
        ballType: true,
        timezone: true,
        isDeleted: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
        videoRequired: true,
        videoUploadEndDate: true,
        defaultPlayerFeeCents: true,
      },
    });
    assertTournamentActive(tournament);
    return tournament;
  }

  private assertRegistrationWindowClosed(tournament: {
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
  }): void {
    if (!tournament.registrationOpenAt || !tournament.registrationCloseAt) {
      throw new BadRequestException({
        message: 'Registration window is not configured for this tournament',
        error: 'REGISTRATION_WINDOW_NOT_CONFIGURED',
      });
    }
    if (
      !isTournamentRegistrationWindowClosed({
        registrationOpenAt: tournament.registrationOpenAt.toISOString(),
        registrationCloseAt: tournament.registrationCloseAt.toISOString(),
      })
    ) {
      throw new BadRequestException({
        message: 'Ratings can only be adjusted after the registration window closes',
        error: 'REGISTRATION_WINDOW_STILL_OPEN',
      });
    }
  }

  private assertRegistrationWindowOpen(tournament: {
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
  }): void {
    if (!tournament.registrationOpenAt || !tournament.registrationCloseAt) {
      throw new BadRequestException({
        message: 'Registration window is not configured for this tournament',
        error: 'REGISTRATION_WINDOW_NOT_CONFIGURED',
      });
    }
    if (
      !isTournamentRegistrationOpen({
        registrationOpenAt: tournament.registrationOpenAt.toISOString(),
        registrationCloseAt: tournament.registrationCloseAt.toISOString(),
      })
    ) {
      throw new BadRequestException({
        message: 'Registration is not open for this tournament',
        error: 'REGISTRATION_WINDOW_CLOSED',
      });
    }
  }

  private async resolveRegistrationCenterForUser(
    userId: string,
    centerId: string,
  ): Promise<string> {
    const player = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { center: { select: { provinceId: true } } },
    });
    if (!player) {
      throw new NotFoundException({ message: 'User not found', error: 'NOT_FOUND' });
    }
    const center = await this.prisma.center.findUnique({
      where: { id: centerId },
      select: { id: true, provinceId: true },
    });
    if (!center) {
      throw new BadRequestException({ message: 'Center not found', error: 'INVALID_CENTER' });
    }
    if (center.provinceId !== player.center.provinceId) {
      throw new BadRequestException({
        message: 'Selected center must belong to your province',
        error: 'INVALID_CENTER',
      });
    }
    return center.id;
  }

  private async syncPlayerProfile(
    userId: string,
    firstName: string,
    lastName: string,
    centerId: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: firstName.trim(), lastName: lastName.trim(), centerId },
    });
  }

  private async requireRegistration(registrationId: string): Promise<void> {
    const exists = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({ message: 'Registration not found', error: 'NOT_FOUND' });
    }
  }

  /** Ensures every required custom field has an answer (?7.2). */
  private async validateCustomFields(
    tournamentId: string,
    answers: Record<string, unknown> | null,
  ): Promise<void> {
    const required = await this.prisma.registrationFieldDefinition.findMany({
      where: { tournamentId, required: true },
      select: { key: true, label: true },
    });
    const missing = required.filter((field) => {
      const value = answers?.[field.key];
      return value === undefined || value === null || value === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Missing required field(s): ${missing.map((m) => m.label).join(', ')}`,
        error: 'MISSING_CUSTOM_FIELDS',
      });
    }
  }

  private assertUniqueKeys(fields: RegistrationFieldDefinitionInput[]): void {
    const keys = new Set<string>();
    for (const field of fields) {
      if (keys.has(field.key)) {
        throw new BadRequestException({
          message: `Duplicate custom field key: ${field.key}`,
          error: 'DUPLICATE_FIELD_KEY',
        });
      }
      keys.add(field.key);
    }
  }

  private parseOptions(value: Prisma.JsonValue | null): string[] | null {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return null;
  }

  /** Post-window Verify Players list: pending ��� verified ��� declined, then name within each group. */
  private sortVerificationQueue(rows: RegistrationSummary[]): RegistrationSummary[] {
    const statusRank = (status: RegistrationStatus): number => {
      switch (status) {
        case RegistrationStatus.InWaitlist:
          return 0;
        case RegistrationStatus.Confirmed:
          return 1;
        case RegistrationStatus.Declined:
          return 2;
        default:
          return 3;
      }
    };
    const byName = (a: RegistrationSummary, b: RegistrationSummary): number =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`) ||
      a.createdAt.localeCompare(b.createdAt);
    return [...rows].sort(
      (a, b) => statusRank(a.status) - statusRank(b.status) || byName(a, b),
    );
  }

  private async loadSkillVideoIdsByUser(
    tournamentId: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.playerSkillVideo.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        status: PlayerSkillVideoStatus.Ready,
      },
      select: { id: true, userId: true },
    });
    return new Map(rows.map((row) => [row.userId, row.id]));
  }

  private sort(
    rows: RegistrationSummary[],
    key: RegistrationSortKey | undefined,
  ): RegistrationSummary[] {
    const byName = (a: RegistrationSummary, b: RegistrationSummary): number =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    // Higher rating first; null ratings sort last.
    const byRating =
      (pick: (r: RegistrationSummary) => number | null) =>
      (a: RegistrationSummary, b: RegistrationSummary): number => {
        const av = pick(a);
        const bv = pick(b);
        if (av === null && bv === null) return byName(a, b);
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av || byName(a, b);
      };
    switch (key) {
      case RegistrationSortKey.Batting:
        return [...rows].sort(byRating((r) => r.battingRating));
      case RegistrationSortKey.Bowling:
        return [...rows].sort(byRating((r) => r.bowlingRating));
      case RegistrationSortKey.Fielding:
        return [...rows].sort(byRating((r) => r.fieldingRating));
      case RegistrationSortKey.Availability:
        return [...rows].sort((a, b) => {
          const rank = (v: boolean | null): number => (v === true ? 0 : v === false ? 2 : 1);
          return rank(a.isAvailable) - rank(b.isAvailable) || byName(a, b);
        });
      default:
        return [...rows].sort(byName);
    }
  }

  /** Captain / VC / Manager team scope for shared favourites (from RoleAssignment, not JWT). */
  private resolveFavouriteTeamId(actor: AuthUser, tournamentId: string): Promise<string | null> {
    return favouritesLeadTeamIdInTournament(this.prisma, actor.id, tournamentId);
  }

  private async loadFavouritedUserIds(
    tournamentId: string,
    teamId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.teamRegistrationFavourite.findMany({
      where: { tournamentId, teamId },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  }

  private toSummary(row: RegistrationRow): RegistrationSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      userId: row.userId,
      centerId: row.centerId,
      centerName: row.center.name,
      status: row.status,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      mobileNumber: row.user.mobileNumber,
      profilePhotoUrl: row.user.profilePhotoUrl,
      battingStyle: row.battingStyle,
      battingRating: row.battingRating,
      battingPosition: row.battingPosition,
      playerRole: row.playerRole,
      bowlingStyle: row.bowlingStyle,
      bowlingType: row.bowlingType,
      bowlingRating: row.bowlingRating,
      fieldingRating: row.fieldingRating,
      fieldingPosition: row.fieldingPosition,
      playerType: this.toRegistrationPlayerType(row.playerType),
      isAvailable: row.isAvailable,
      availabilityNote: row.availabilityNote,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDetail(row: RegistrationRow): RegistrationDetail {
    return {
      ...this.toSummary(row),
      customFields: (row.customFields as Record<string, unknown> | null) ?? null,
      reviewedByUserId: row.reviewedByUserId,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private resolveProfilePhotoUrls<T extends { profilePhotoUrl: string | null }>(
    rows: T[],
  ): Promise<T[]> {
    return this.mediaUrls.resolveProfilePhotoUrls(rows);
  }

  private resolveProfilePhoto<T extends { profilePhotoUrl: string | null }>(
    row: T,
  ): Promise<T> {
    return this.mediaUrls.resolveProfilePhoto(row);
  }

  private resolveSummaryPhotos<T extends Pick<RegistrationSummary, 'profilePhotoUrl'>>(
    summaries: T[],
  ): Promise<T[]> {
    return this.resolveProfilePhotoUrls(summaries);
  }

  private resolveSummaryPhoto<T extends Pick<RegistrationSummary, 'profilePhotoUrl'>>(
    summary: T,
  ): Promise<T> {
    return this.resolveProfilePhoto(summary);
  }

  private toCustomFormRequestSummary(
    row: Prisma.CustomFormRequestGetPayload<object>,
  ): CustomFormRequestSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      requestedByUserId: row.requestedByUserId,
      note: row.note,
      requestedFields:
        (row.requestedFields as unknown as RegistrationFieldDefinitionInput[] | null) ?? null,
      status: row.status,
      resolvedByUserId: row.resolvedByUserId,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private resolvePlayerTypeForWrite(
    ballType: BallType,
    playerType: RegistrationPlayerType | null | undefined,
  ): RegistrationPlayerType | null {
    if (ballType === BallType.Tennis) {
      if (playerType) {
        throw new BadRequestException({
          message: 'Player type is not used for tennis-ball tournaments',
          error: 'PLAYER_TYPE_NOT_ALLOWED',
        });
      }
      return null;
    }
    if (!playerType) {
      throw new BadRequestException({
        message: 'Player type is required for leather-ball tournaments',
        error: 'PLAYER_TYPE_REQUIRED',
        fields: { playerType: 'Please select Full-time or Part-time' },
      });
    }
    return playerType;
  }

  private toRegistrationPlayerType(
    value: string | null,
  ): RegistrationPlayerType | null {
    if (value === RegistrationPlayerType.FullTime || value === RegistrationPlayerType.PartTime) {
      return value;
    }
    return null;
  }
}
