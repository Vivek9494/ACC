import {
  type AuthUser,
  BallType,
  type CloneSuggestion,
  Permission,
  TournamentState,
  TOURNAMENT_STATE_TRANSITIONS,
  type TournamentDashboardPermissions,
  type TournamentDetail,
  type TournamentSummary,
  type TournamentType,
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
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';

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
  ) {}

  /** Creates a tournament (§6.1), deriving the type via §1.1 and RBAC-gating it. */
  async create(actor: AuthUser, dto: CreateTournamentDto): Promise<TournamentDetail> {
    const creatorRole = await this.resolveCreatorRole(actor);
    const allProvinceCentersSelected =
      dto.ballType === BallType.Tennis
        ? await this.resolveAllProvinceCentersSelected(dto, actor)
        : false;

    const type = this.typeResolver.resolve({
      ballType: dto.ballType,
      creatorRole,
      citySelection: dto.citySelection,
      allProvinceCentersSelected,
    });

    const allowed = await this.permissions.check(CREATE_PERMISSION[type], actor, {});
    if (!allowed) {
      throw new ForbiddenException({
        message: `You do not have permission to create a ${type} tournament`,
        error: 'FORBIDDEN',
      });
    }

    this.validateDates(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: dto.name,
          year: dto.year,
          posterUrl: dto.posterUrl ?? null,
          oversPerInnings: dto.oversPerInnings,
          maxOversPerBowler: dto.maxOversPerBowler,
          location: dto.location ?? null,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
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
          createdByUserId: actor.id,
        },
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

  /** Lists tournaments newest-first for the dashboard list. */
  async list(): Promise<TournamentSummary[]> {
    const rows = await this.prisma.tournament.findMany({
      include: { _count: { select: { teams: true } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getDetail(id: string): Promise<TournamentDetail> {
    const row = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { teams: true } },
        teams: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    return {
      ...this.toSummary(row),
      oversPerInnings: row.oversPerInnings,
      maxOversPerBowler: row.maxOversPerBowler,
      location: row.location,
      format: row.format,
      impactPlayerEnabled: row.impactPlayerEnabled,
      videoRequired: row.videoRequired,
      videoUploadEndDate: row.videoUploadEndDate?.toISOString() ?? null,
      youtubeUrl: row.youtubeUrl,
      registrationOpenAt: row.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: row.registrationCloseAt?.toISOString() ?? null,
      teams: row.teams,
    };
  }

  /**
   * Suggests cloning team names from a past tournament with the same name
   * (§6.2). Only names are ever suggested — players are never copied.
   */
  async cloneSuggestion(name: string): Promise<CloneSuggestion | null> {
    const past = await this.prisma.tournament.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
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

  /** Applies mid-tournament edits (§6.4) and notifies if registration is open. */
  async update(actor: AuthUser, id: string, dto: UpdateTournamentDto): Promise<TournamentDetail> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    await this.assertCenterSevakTournamentAccess(actor, existing);

    const data: Prisma.TournamentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.posterUrl !== undefined) data.posterUrl = dto.posterUrl;
    if (dto.oversPerInnings !== undefined) data.oversPerInnings = dto.oversPerInnings;
    if (dto.maxOversPerBowler !== undefined) data.maxOversPerBowler = dto.maxOversPerBowler;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.startAt !== undefined) data.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) data.endAt = new Date(dto.endAt);
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

    await this.prisma.tournament.update({ where: { id }, data });

    // §6.4: editing a tournament with open registration notifies all registrants.
    if (existing.state === TournamentState.RegistrationOpen) {
      await this.notifyRegistrants(id, NotificationTrigger.TournamentEditedMidRegistration);
    }

    return this.getDetail(id);
  }

  /** Deletes a tournament; notifies registrants if registration was open (§6.4). */
  async remove(actor: AuthUser, id: string): Promise<void> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    await this.assertCenterSevakTournamentAccess(actor, existing);

    if (existing.state === TournamentState.RegistrationOpen) {
      await this.notifyRegistrants(id, NotificationTrigger.TournamentDeletedMidRegistration);
    }
    await this.prisma.tournament.delete({ where: { id } });
  }

  /** Validates and applies a §5.1 lifecycle transition. */
  async transition(id: string, next: TournamentState): Promise<TournamentDetail> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
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

  /** Resolves tournament card permissions for the Center Sevak dashboard. */
  async resolveDashboardPermissions(
    actor: AuthUser,
    tournament: { id: string; createdByUserId: string },
    actionCenterId: string,
  ): Promise<TournamentDashboardPermissions> {
    const refs = { tournamentId: tournament.id, targetCenterId: actionCenterId };
    const canManageCenterPlayers = await this.permissions.check(
      Permission.VIEW_REGISTRATIONS_OWN_CENTER,
      actor,
      refs,
    );

    if (actor.role !== UserRole.CenterSevak) {
      const canEdit = await this.permissions.check(Permission.EDIT_TOURNAMENT, actor, refs);
      return {
        canEdit,
        canDelete: canEdit,
        canManageCenterPlayers,
      };
    }

    const canModify = await this.centerSevakCanModifyTournament(actor.id, tournament);
    return {
      canEdit: canModify,
      canDelete: canModify,
      canManageCenterPlayers,
    };
  }

  /** Maps the actor to the effective creator role for §1.1 resolution. */
  private async resolveCreatorRole(actor: AuthUser): Promise<UserRole> {
    if (actor.role === UserRole.Admin || actor.role === UserRole.ClubManager) {
      return actor.role;
    }
    const sevak = await this.prisma.roleAssignment.findFirst({
      where: { userId: actor.id, role: UserRole.CenterSevak },
      select: { id: true },
    });
    return sevak ? UserRole.CenterSevak : UserRole.Player;
  }

  private validateDates(dto: CreateTournamentDto): void {
    if (new Date(dto.endAt) < new Date(dto.startAt)) {
      throw new BadRequestException({
        message: 'End date must be on or after the start date',
        error: 'INVALID_DATE_RANGE',
      });
    }
    // §19: when videos are required the upload end date must be after reg close.
    if (dto.videoRequired) {
      if (!dto.videoUploadEndDate) {
        throw new BadRequestException({
          message: 'Video Upload End Date is required when Video Required is checked',
          error: 'VIDEO_DATE_REQUIRED',
        });
      }
      if (dto.registrationCloseAt && new Date(dto.videoUploadEndDate) <= new Date(dto.registrationCloseAt)) {
        throw new BadRequestException({
          message: 'Video Upload End Date must be after the registration close date',
          error: 'INVALID_VIDEO_DATE',
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
      centerIds = dto.centerIds && dto.centerIds.length > 0 ? dto.centerIds : [actor.centerId];
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

  private async resolveAllProvinceCentersSelected(
    dto: CreateTournamentDto,
    actor: AuthUser,
  ): Promise<boolean> {
    if (!dto.provinceId) {
      throw new BadRequestException({
        message: 'provinceId is required for tennis-ball tournaments',
        error: 'PROVINCE_REQUIRED',
      });
    }

    const province = await this.prisma.province.findUnique({
      where: { id: dto.provinceId },
      select: { id: true, isActive: true },
    });
    if (!province || !province.isActive) {
      throw new BadRequestException({
        message: 'Province not found or inactive',
        error: 'INVALID_PROVINCE',
      });
    }

    const activeInProvince = await this.prisma.center.findMany({
      where: { provinceId: dto.provinceId, isActive: true },
      select: { id: true },
    });
    if (dto.citySelection === 'ALL') {
      return activeInProvince.length > 0;
    }

    const selected =
      dto.centerIds && dto.centerIds.length > 0 ? dto.centerIds : [actor.centerId];
    if (selected.length !== activeInProvince.length) {
      return false;
    }
    const activeSet = new Set(activeInProvince.map((c) => c.id));
    return selected.every((id) => activeSet.has(id));
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
        data: { tournamentId: targetTournamentId, name: source.name },
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
      location: row.location,
      teamCount: row._count.teams,
    };
  }
}
