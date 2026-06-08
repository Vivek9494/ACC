import {
  type AuthUser,
  type AvailabilitySummary,
  type CustomFormRequestSummary,
  Permission,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RegistrationFieldDefinitionInput,
  RegistrationSortKey,
  RegistrationStatus,
  type RegistrationSummary,
  TournamentState,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BuildCustomFormDto, CreateCustomFormRequestDto } from './dto/custom-form.dto';
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
 * Player registration flow (spec §7): submission and the In Waitlist → Confirmed
 * / Declined lifecycle (§7.3), Center-scoped approval and visibility (§7.4),
 * APL ratings & availability (§7.5), late registration (§7.6) and the §7.2/§21
 * custom-form definitions.
 */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // --- Submission (§7.1, §7.3) ---------------------------------------------

  /** A player submits their own registration; status starts In Waitlist (§7.3). */
  async submit(
    actor: AuthUser,
    tournamentId: string,
    dto: SubmitRegistrationDto,
  ): Promise<RegistrationDetail> {
    const tournament = await this.requireTournament(tournamentId);
    if (tournament.state !== TournamentState.RegistrationOpen) {
      throw new BadRequestException({
        message: 'Registration is not open for this tournament',
        error: 'REGISTRATION_NOT_OPEN',
      });
    }
    await this.validateCustomFields(tournamentId, dto.customFields ?? null);
    return this.upsertRegistration(tournamentId, actor.id, actor.centerId, dto);
  }

  /** Late registration of a missed player by Organizer / Center Sevak (§7.6). */
  async lateRegister(
    actor: AuthUser,
    tournamentId: string,
    dto: LateRegistrationDto,
  ): Promise<RegistrationDetail> {
    const tournament = await this.requireTournament(tournamentId);
    if (tournament.state !== TournamentState.RegistrationClosed) {
      throw new BadRequestException({
        message: 'Late registration is only allowed after Registration Closed',
        error: 'NOT_REGISTRATION_CLOSED',
      });
    }
    const player = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, centerId: true },
    });
    if (!player) {
      throw new NotFoundException({ message: 'Player not found', error: 'NOT_FOUND' });
    }
    // §7.6: Organizer (CM/CS-organizer) anywhere, or a Center Sevak for own Center.
    const allowed = await this.permissions.check(Permission.REGISTER_LATE_PLAYER, actor, {
      tournamentId,
      targetCenterId: player.centerId,
      targetUserId: player.id,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You cannot register a late player here',
        error: 'FORBIDDEN',
      });
    }
    const detail = await this.upsertRegistration(tournamentId, player.id, player.centerId, dto);
    await this.audit.record({
      action: 'REGISTRATION_LATE_ADD',
      actorUserId: actor.id,
      targetUserId: player.id,
      targetEntityType: 'registration',
      targetEntityId: detail.id,
      after: { tournamentId, status: detail.status },
    });
    return detail;
  }

  private async upsertRegistration(
    tournamentId: string,
    userId: string,
    centerId: string,
    dto: SubmitRegistrationDto,
  ): Promise<RegistrationDetail> {
    const customFields =
      dto.customFields === undefined
        ? undefined
        : (dto.customFields as Prisma.InputJsonValue | null);

    const row = await this.prisma.registration.upsert({
      where: { tournamentId_userId: { tournamentId, userId } },
      create: {
        tournamentId,
        userId,
        centerId,
        status: RegistrationStatus.InWaitlist,
        battingStyle: dto.battingStyle ?? null,
        battingRating: dto.battingRating ?? null,
        bowlingStyle: dto.bowlingStyle ?? null,
        bowlingRating: dto.bowlingRating ?? null,
        fieldingRating: dto.fieldingRating ?? null,
        fieldingPosition: dto.fieldingPosition ?? null,
        customFields: customFields ?? Prisma.JsonNull,
      },
      // Re-submitting before review updates the answers and resets to waitlist.
      update: {
        status: RegistrationStatus.InWaitlist,
        battingStyle: dto.battingStyle ?? null,
        battingRating: dto.battingRating ?? null,
        bowlingStyle: dto.bowlingStyle ?? null,
        bowlingRating: dto.bowlingRating ?? null,
        fieldingRating: dto.fieldingRating ?? null,
        fieldingPosition: dto.fieldingPosition ?? null,
        ...(customFields !== undefined ? { customFields: customFields ?? Prisma.JsonNull } : {}),
        reviewedByUserId: null,
        reviewedAt: null,
      },
      include: REGISTRATION_INCLUDE,
    });
    return this.toDetail(row);
  }

  // --- Review lifecycle (§7.3) ---------------------------------------------

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
    // §7.3: notify the player on confirm/decline.
    await this.notifications.notify(
      status === RegistrationStatus.Confirmed
        ? NotificationTrigger.RegistrationConfirmed
        : NotificationTrigger.RegistrationDeclined,
      { recipientUserIds: [existing.userId], data: { tournamentId: existing.tournamentId } },
    );
    return this.toDetail(row);
  }

  // --- Ratings & availability (§7.5, APL) ----------------------------------

  async updateRatings(registrationId: string, dto: UpdateRatingsDto): Promise<RegistrationDetail> {
    await this.requireRegistration(registrationId);
    const data: Prisma.RegistrationUpdateInput = {};
    if (dto.battingRating !== undefined) data.battingRating = dto.battingRating;
    if (dto.bowlingRating !== undefined) data.bowlingRating = dto.bowlingRating;
    if (dto.fieldingRating !== undefined) data.fieldingRating = dto.fieldingRating;
    const row = await this.prisma.registration.update({
      where: { id: registrationId },
      data,
      include: REGISTRATION_INCLUDE,
    });
    return this.toDetail(row);
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
    return this.toDetail(row);
  }

  /** Aggregate availability of confirmed players for the §7.5 bar-chart. */
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

  // --- Listing & visibility (§7.4) -----------------------------------------

  /** Lists registrations honouring the §7.4 Center-visibility rules. */
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
    return this.sort(rows.map((row) => this.toSummary(row)), query.sort);
  }

  async getMine(actor: AuthUser, tournamentId: string): Promise<RegistrationDetail | null> {
    const row = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
      include: REGISTRATION_INCLUDE,
    });
    return row ? this.toDetail(row) : null;
  }

  /**
   * §7.4: Admin and Club Manager (APL) see all Centers; a Center Sevak sees only
   * their own Center(s). Returns `null` for an unrestricted view, the allowed
   * Center ids for a scoped view, or throws for anyone else.
   */
  private async resolveVisibleCenters(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<string[] | null> {
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

  // --- Custom forms (§7.2, §21) --------------------------------------------

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

  /** Admin builds (replaces) a tournament's custom form (§7.2). */
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

  /** Organizer requests extra fields from Admin (§7.2). */
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
  ): Promise<{ id: string; state: string; type: string }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, state: true, type: true },
    });
    if (!tournament) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    return tournament;
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

  /** Ensures every required custom field has an answer (§7.2). */
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
      bowlingStyle: row.bowlingStyle,
      bowlingRating: row.bowlingRating,
      fieldingRating: row.fieldingRating,
      fieldingPosition: row.fieldingPosition,
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
}
