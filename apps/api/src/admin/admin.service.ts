import {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE_MAX,
  type AdminOverview,
  type AdminPasswordResetOtpDailySeries,
  type AdminPasswordResetOtpDayUsers,
  type AdminUsersByGeography,
  type AdminUserDetail,
  type AdminUserPlayerStatsView,
  type AdminUsersPage,
  type AuthUser,
  type CreateAdminUserResponse,
  type TodayBirthdayUserSummary,
  type BirthdayUserSummary,
  BallType,
  EMAIL_EXISTS_MESSAGE,
  type GenerateTemporaryPasswordResponse,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  MIN_SIGNUP_AGE,
  normalizeCanadianMobile,
  PLAYER_PROFILE_BALL_TYPE_LABELS,
  PLAYER_REGISTRATION_ROLE_LABELS,
  type PlayerRegistrationRole,
  RegistrationStatus,
  SIGNUP_VALIDATION_MESSAGES,
  TEMP_PASSWORD_TTL_HOURS,
  TournamentState,
  UserRole,
  canViewAdminUserFullMobile,
  type UpdateAdminUserStatusResponse,
  AuthErrorCode,
  isAdminPlayingRole,
  DEFAULT_VENUE_TIMEZONE,
  getTodayCalendarPartsInZone,
  formatUtcIsoDate,
} from '@acc/types';
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS, refreshKey } from '../auth/auth.constants';
import { generateSecureTemporaryPassword } from '../auth/password.util';
import { AuditService } from '../audit/audit.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { ScorerDashboardMatchService } from '../matches/scorer-dashboard-match.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { adminDirectoryUserWhere } from '../users/user-query';
import { activeTournamentWhere, activeTournamentRelationWhere } from '../tournaments/tournament-query';
import {
  buildAdminUserListWhere,
  toAdminUserDetail,
  toAdminUserSummary,
} from './admin.mapper';
import { syncCenterSevakRoleAssignment } from '../authz/center-sevak-assignment';
import type { ListAdminUsersDto } from './dto/list-admin-users.dto';
import type { CreateAdminUserDto } from './dto/create-admin-user.dto';
import type { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly playerStats: PlayerStatsService,
    private readonly redis: RedisService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly scorerDashboardMatch: ScorerDashboardMatchService,
  ) {}

  async listUsers(actor: AuthUser, query: ListAdminUsersDto): Promise<AdminUsersPage> {
    const limit = Math.min(query.limit ?? ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE_MAX);
    const includeFullMobile = canViewAdminUserFullMobile(actor.role);

    if (query.centerId && query.provinceId) {
      await this.assertCenterInProvince(query.centerId, query.provinceId);
    }

    const where = buildAdminUserListWhere({
      q: query.q,
      provinceId: query.provinceId,
      centerId: query.centerId,
    });

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
        passwordResetLockedAt: true,
        roleAssignments: { select: { role: true } },
      },
    });

    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;

    return {
      items: await this.mediaUrls.resolveProfilePhotoUrls(
        page.map((user) => toAdminUserSummary(user, { includeFullMobile })),
      ),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  /** Users with birthdays in the present UTC month or later — excludes past calendar months. */
  async listBirthdayDirectory(): Promise<BirthdayUserSummary[]> {
    const presentMonth = new Date().getUTCMonth() + 1;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: Date;
        profilePhotoUrl: string | null;
        centerName: string | null;
      }>
    >`
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u."dateOfBirth",
        u."profilePhotoUrl",
        c.name AS "centerName"
      FROM "User" u
      LEFT JOIN "Center" c ON c.id = u."centerId"
      WHERE u."deletedAt" IS NULL
        AND EXTRACT(MONTH FROM u."dateOfBirth") >= ${presentMonth}
      ORDER BY
        EXTRACT(MONTH FROM u."dateOfBirth"),
        EXTRACT(DAY FROM u."dateOfBirth"),
        u."lastName",
        u."firstName"
    `;

    return this.mediaUrls.resolveProfilePhotoUrls(
      rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        dateOfBirth: row.dateOfBirth.toISOString().slice(0, 10),
        centerName: row.centerName,
        profilePhotoUrl: row.profilePhotoUrl,
      })),
    );
  }

  /**
   * Active users whose DOB month+day is today in America/Toronto (Eastern).
   * Used by the header cake badge — same calendar rule as birthday push jobs.
   */
  async countTodayBirthdays(now: Date = new Date()): Promise<number> {
    const today = getTodayCalendarPartsInZone(DEFAULT_VENUE_TIMEZONE, now);
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "User" u
      WHERE u."deletedAt" IS NULL
        AND u."isActive" = true
        AND EXTRACT(MONTH FROM u."dateOfBirth") = ${today.month}
        AND EXTRACT(DAY FROM u."dateOfBirth") = ${today.day}
    `;
    return rows[0]?.count ?? 0;
  }

  /** @deprecated Use {@link listBirthdayDirectory}. */
  async listTodayBirthdays(): Promise<TodayBirthdayUserSummary[]> {
    const today = new Date();
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();
    const all = await this.listBirthdayDirectory();
    return all.filter((user) => {
      const iso = user.dateOfBirth;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!match) {
        return false;
      }
      return Number(match[2]) === month && Number(match[3]) === day;
    });
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
        passwordResetLockedAt: true,
        email: true,
        dateOfBirth: true,
        jerseyNumber: true,
        jerseyName: true,
        jerseySize: true,
        mustChangePassword: true,
        tempPasswordExpiresAt: true,
        center: {
          select: {
            id: true,
            name: true,
            provinceId: true,
            province: { select: { id: true, name: true } },
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

    const [centers, tournaments, teams, latestRegistration] = await Promise.all([
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
      this.prisma.registration.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          battingRating: true,
          bowlingRating: true,
          fieldingRating: true,
          playerRole: true,
        },
      }),
    ]);

    const centerNameById = new Map(centers.map((center) => [center.id, center.name]));
    const tournamentNameById = new Map(tournaments.map((row) => [row.id, row.name]));
    const teamNameById = new Map(teams.map((row) => [row.id, row.name]));

    const playerRole = latestRegistration?.playerRole ?? null;
    const playerRoleLabel =
      playerRole && playerRole in PLAYER_REGISTRATION_ROLE_LABELS
        ? PLAYER_REGISTRATION_ROLE_LABELS[playerRole as PlayerRegistrationRole]
        : null;

    return this.mediaUrls.resolveProfilePhoto({
      ...toAdminUserDetail(
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
      ),
      battingRating: latestRegistration?.battingRating ?? null,
      bowlingRating: latestRegistration?.bowlingRating ?? null,
      fieldingRating: latestRegistration?.fieldingRating ?? null,
      playerRoleLabel,
    });
  }

  async updateUser(
    actor: AuthUser,
    userId: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserDetail> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        deletedAt: true,
        firstName: true,
        lastName: true,
        email: true,
        mobileNumber: true,
        centerId: true,
        dateOfBirth: true,
        jerseyNumber: true,
        jerseyName: true,
        role: true,
      },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('User not found.');
    }

    const normalizedMobile = normalizeCanadianMobile(dto.mobileNumber);
    if (normalizedMobile !== existing.mobileNumber) {
      const taken = await this.prisma.user.findUnique({
        where: { mobileNumber: normalizedMobile },
        select: { id: true },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictException({
          message: MOBILE_NUMBER_EXISTS_MESSAGE,
          error: AuthErrorCode.MobileNumberExists,
        });
      }
    }

    await this.assertCenterInProvince(dto.centerId, dto.provinceId);
    const center = await this.prisma.center.findUnique({
      where: { id: dto.centerId },
      select: { id: true, isActive: true, provinceId: true },
    });
    if (!center || !center.isActive) {
      throw new BadRequestException({
        message: 'Invalid or inactive center',
        error: AuthErrorCode.InvalidCenter,
      });
    }

    const dateOfBirth = new Date(dto.dateOfBirth);
    const mobileChanged = normalizedMobile !== existing.mobileNumber;
    const roleChanged = dto.platformRole !== existing.role;
    const email = dto.email?.trim() ?? '';

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          mobileNumber: normalizedMobile,
          centerId: dto.centerId,
          dateOfBirth,
          jerseyNumber: dto.jerseyNumber,
          jerseyName: dto.jerseyName ?? null,
          role: dto.platformRole,
          ...(mobileChanged || roleChanged ? { tokenVersion: { increment: 1 } } : {}),
        },
      });

      const latestRegistration = await tx.registration.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (
        latestRegistration &&
        (dto.battingRating !== undefined ||
          dto.bowlingRating !== undefined ||
          dto.fieldingRating !== undefined)
      ) {
        await tx.registration.update({
          where: { id: latestRegistration.id },
          data: {
            ...(dto.battingRating !== undefined ? { battingRating: dto.battingRating } : {}),
            ...(dto.bowlingRating !== undefined ? { bowlingRating: dto.bowlingRating } : {}),
            ...(dto.fieldingRating !== undefined ? { fieldingRating: dto.fieldingRating } : {}),
          },
        });
      }

      await syncCenterSevakRoleAssignment(tx, userId, dto.platformRole, dto.centerId);
    });

    if (mobileChanged) {
      await this.audit.record({
        action: 'USER_MOBILE_CHANGED',
        actorUserId: actor.id,
        targetUserId: userId,
        targetEntityType: 'user',
        targetEntityId: userId,
        before: { mobileNumber: existing.mobileNumber },
        after: { mobileNumber: normalizedMobile },
      });
    }

    await this.audit.record({
      action: 'USER_PROFILE_UPDATED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'user',
      targetEntityId: userId,
      before: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        centerId: existing.centerId,
        dateOfBirth: existing.dateOfBirth.toISOString().slice(0, 10),
        jerseyNumber: existing.jerseyNumber,
        jerseyName: existing.jerseyName,
        platformRole: existing.role,
      },
      after: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        centerId: dto.centerId,
        dateOfBirth: dto.dateOfBirth,
        jerseyNumber: dto.jerseyNumber,
        jerseyName: dto.jerseyName ?? null,
        platformRole: dto.platformRole,
      },
    });

    return this.getUser(userId);
  }

  async createUser(actor: AuthUser, dto: CreateAdminUserDto): Promise<CreateAdminUserResponse> {
    const normalizedMobile = normalizeCanadianMobile(dto.mobileNumber);
    const existingMobile = await this.prisma.user.findUnique({
      where: { mobileNumber: normalizedMobile },
      select: { id: true, deletedAt: true },
    });
    if (existingMobile && !existingMobile.deletedAt) {
      throw new ConflictException({
        message: MOBILE_NUMBER_EXISTS_MESSAGE,
        error: AuthErrorCode.MobileNumberExists,
      });
    }

    const email = dto.email?.trim() ?? '';
    if (email.length > 0) {
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictException({
          message: EMAIL_EXISTS_MESSAGE,
          error: AuthErrorCode.EmailExists,
        });
      }
    }

    const resolvedCenterId = await this.resolveCreateCenterId(dto.centerId, dto.provinceId);

    const dateOfBirthRaw = dto.dateOfBirth ?? '1990-01-01';
    const dateOfBirth = new Date(dateOfBirthRaw);
    if (dto.dateOfBirth && this.ageInYears(dateOfBirth, new Date()) < MIN_SIGNUP_AGE) {
      throw new BadRequestException({
        message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.underage,
        error: AuthErrorCode.Underage,
      });
    }

    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        mobileNumber: normalizedMobile,
        email,
        dateOfBirth,
        centerId: resolvedCenterId,
        jerseyNumber: dto.jerseyNumber ?? 0,
        jerseyName: dto.jerseyName?.trim() || null,
        role: dto.platformRole,
        emergencyContactName: '',
        emergencyContactNumber: '',
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
      },
    });

    await syncCenterSevakRoleAssignment(
      this.prisma,
      user.id,
      dto.platformRole,
      resolvedCenterId,
    );

    const skillDetails = isAdminPlayingRole(dto.platformRole)
      ? {
          playerRole: dto.playerRole ?? null,
          playerType: dto.playerType ?? null,
          battingRating: dto.battingRating ?? null,
          bowlingRating: dto.bowlingRating ?? null,
          fieldingRating: dto.fieldingRating ?? null,
        }
      : null;

    await this.audit.record({
      action: 'USER_CREATED',
      actorUserId: actor.id,
      targetUserId: user.id,
      targetEntityType: 'user',
      targetEntityId: user.id,
      after: {
        firstName: user.firstName,
        lastName: user.lastName,
        mobileNumber: normalizedMobile,
        email,
        centerId: resolvedCenterId,
        dateOfBirth: dateOfBirthRaw,
        platformRole: dto.platformRole,
        jerseyNumber: dto.jerseyNumber ?? 0,
        jerseyName: dto.jerseyName?.trim() || null,
        centerAssignedByDefault: false,
      },
      ...(skillDetails ? { details: skillDetails } : {}),
    });

    await this.audit.record({
      action: 'USER_TEMP_PASSWORD_GENERATED',
      actorUserId: actor.id,
      targetUserId: user.id,
      targetEntityType: 'user',
      targetEntityId: user.id,
      details: { expiresAt: expiresAt.toISOString(), issuedOnCreate: true },
    });

    return {
      user: await this.getUser(user.id),
      temporaryPassword,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async generateTemporaryPassword(
    actor: AuthUser,
    userId: string,
  ): Promise<GenerateTemporaryPasswordResponse> {
    if (actor.id === userId) {
      throw new BadRequestException({
        message: 'You cannot generate a temporary password for your own account',
        error: 'CANNOT_MODIFY_SELF',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, isActive: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('User not found.');
    }

    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
        tokenVersion: { increment: 1 },
      },
    });
    await this.redis.del(refreshKey(userId));

    await this.audit.record({
      action: 'USER_TEMP_PASSWORD_GENERATED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'user',
      targetEntityId: userId,
      details: { expiresAt: expiresAt.toISOString() },
    });

    return {
      temporaryPassword,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getUserStats(userId: string, ballType: BallType): Promise<AdminUserPlayerStatsView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found.');
    }

    const [statsBundle, wicketkeeperRegistration, hasLeatherParticipation] = await Promise.all([
      this.playerStats.buildCareerStats(userId, ballType),
      this.prisma.registration.findFirst({
        where: { userId, fieldingPosition: 'Wicketkeeper' },
        select: { id: true },
      }),
      this.playerStats.hasLeatherParticipation(userId),
    ]);

    return {
      ballType,
      ballTypeLabel: PLAYER_PROFILE_BALL_TYPE_LABELS[ballType],
      hasLeatherParticipation:
        hasLeatherParticipation ||
        (ballType === BallType.Leather && statsBundle.career.matches > 0),
      career: statsBundle.career,
      byYear: statsBundle.byYear,
      byTournament: statsBundle.byTournament,
      showStumpingsCard:
        wicketkeeperRegistration !== null && statsBundle.career.stumpings > 0,
    };
  }

  async setUserStatus(
    actor: AuthUser,
    userId: string,
    isActive: boolean,
  ): Promise<UpdateAdminUserStatusResponse> {
    if (actor.id === userId) {
      throw new BadRequestException({
        message: 'You cannot change your own account status',
        error: 'CANNOT_MODIFY_SELF',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('User not found.');
    }
    if (existing.isActive === isActive) {
      return { id: userId, isActive };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        ...(isActive ? {} : { tokenVersion: { increment: 1 } }),
      },
      select: { id: true, isActive: true },
    });

    await this.audit.record({
      action: 'USER_STATUS_CHANGED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'user',
      targetEntityId: userId,
      before: { isActive: existing.isActive },
      after: { isActive },
    });

    return updated;
  }

  async softDeleteUser(actor: AuthUser, userId: string): Promise<void> {
    if (actor.id === userId) {
      throw new BadRequestException({
        message: 'You cannot delete your own account',
        error: 'CANNOT_MODIFY_SELF',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, isActive: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('User not found.');
    }

    const deletedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt,
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    });

    await this.audit.record({
      action: 'USER_SOFT_DELETED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'user',
      targetEntityId: userId,
      before: { deletedAt: null, isActive: existing.isActive },
      after: { deletedAt: deletedAt.toISOString(), isActive: false },
    });
  }

  private async resolveCreateCenterId(centerId: string, provinceId: string): Promise<string> {
    await this.assertCenterInProvince(centerId, provinceId);
    const center = await this.prisma.center.findUnique({
      where: { id: centerId },
      select: { id: true, isActive: true },
    });
    if (!center || !center.isActive) {
      throw new BadRequestException({
        message: 'Invalid or inactive center',
        error: AuthErrorCode.InvalidCenter,
      });
    }
    return centerId;
  }

  private async assertCenterInProvince(centerId: string, provinceId: string): Promise<void> {
    const center = await this.prisma.center.findUnique({
      where: { id: centerId },
      select: { provinceId: true },
    });
    if (!center) {
      throw new NotFoundException('Center not found.');
    }
    if (center.provinceId !== provinceId) {
      throw new BadRequestException({
        message: 'Selected center does not belong to the selected province',
        error: 'CENTER_PROVINCE_MISMATCH',
      });
    }
  }

  /** Whole years between `dob` and `now`, computed in UTC. */
  private ageInYears(dob: Date, now: Date): number {
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
      age -= 1;
    }
    return age;
  }

  /**
   * Password-reset OTP sends per UTC day for an inclusive date range.
   * Days with zero sends are included so the Admin graph has a continuous series.
   */
  async getPasswordResetOtpDailySeries(
    fromDate: string,
    toDate: string,
  ): Promise<AdminPasswordResetOtpDailySeries> {
    const range = this.parseInclusiveUtcDateRange(fromDate, toDate);
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT (("createdAt" AT TIME ZONE 'UTC')::date) AS day,
             COUNT(*)::bigint AS count
      FROM "PasswordResetOtpSend"
      WHERE "createdAt" >= ${range.fromStart}
        AND "createdAt" < ${range.toExclusive}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const countByDay = new Map<string, number>();
    for (const row of rows) {
      const key =
        row.day instanceof Date
          ? formatUtcIsoDate(row.day)
          : String(row.day).slice(0, 10);
      countByDay.set(key, Number(row.count));
    }

    const days: AdminPasswordResetOtpDailySeries['days'] = [];
    const cursor = new Date(range.fromStart);
    while (cursor < range.toExclusive) {
      const date = formatUtcIsoDate(cursor);
      days.push({ date, count: countByDay.get(date) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      fromDate: formatUtcIsoDate(range.fromStart),
      toDate: formatUtcIsoDate(new Date(range.toExclusive.getTime() - 1)),
      days,
    };
  }

  /** Users who received password-reset OTPs on a single UTC calendar day. */
  async getPasswordResetOtpDayUsers(date: string): Promise<AdminPasswordResetOtpDayUsers> {
    const dayStart = this.parseUtcDateOnly(date);
    if (!dayStart) {
      throw new BadRequestException({
        message: 'date must be YYYY-MM-DD',
        error: 'INVALID_DATE',
      });
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const grouped = await this.prisma.passwordResetOtpSend.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
    });

    if (grouped.length === 0) {
      return { date: formatUtcIsoDate(dayStart), users: [] };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((row) => row.userId) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        mobileNumber: true,
      },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    const items = await this.mediaUrls.resolveProfilePhotoUrls(
      grouped.flatMap((row) => {
        const user = byId.get(row.userId);
        if (!user) {
          return [];
        }
        return [
          {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePhotoUrl: user.profilePhotoUrl,
            mobileNumber: user.mobileNumber,
            count: row._count._all,
          },
        ];
      }),
    );

    return { date: formatUtcIsoDate(dayStart), users: items };
  }

  /**
   * All non-deleted users grouped by province → center (includes inactive accounts).
   * Provinces/centers with zero users are included so the Admin accordion is complete.
   */
  async getUsersByGeography(): Promise<AdminUsersByGeography> {
    const [provinces, centers, counts] = await Promise.all([
      this.prisma.province.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.center.findMany({
        select: { id: true, name: true, provinceId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.groupBy({
        by: ['centerId'],
        where: adminDirectoryUserWhere,
        _count: { _all: true },
      }),
    ]);

    const countByCenterId = new Map(
      counts.map((row) => [row.centerId, row._count._all] as const),
    );

    return {
      provinces: provinces.map((province) => {
        const provinceCenters = centers
          .filter((center) => center.provinceId === province.id)
          .map((center) => ({
            centerId: center.id,
            name: center.name,
            userCount: countByCenterId.get(center.id) ?? 0,
          }));
        return {
          provinceId: province.id,
          name: province.name,
          userCount: provinceCenters.reduce((sum, center) => sum + center.userCount, 0),
          centers: provinceCenters,
        };
      }),
    };
  }

  private parseUtcDateOnly(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private parseInclusiveUtcDateRange(
    fromDate: string,
    toDate: string,
  ): { fromStart: Date; toExclusive: Date } {
    const fromStart = this.parseUtcDateOnly(fromDate);
    const toStart = this.parseUtcDateOnly(toDate);
    if (!fromStart || !toStart) {
      throw new BadRequestException({
        message: 'fromDate and toDate must be YYYY-MM-DD',
        error: 'INVALID_DATE_RANGE',
      });
    }
    if (fromStart.getTime() > toStart.getTime()) {
      throw new BadRequestException({
        message: 'fromDate must be on or before toDate',
        error: 'INVALID_DATE_RANGE',
      });
    }
    const spanDays =
      Math.floor((toStart.getTime() - fromStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays > 90) {
      throw new BadRequestException({
        message: 'Date range cannot exceed 90 days',
        error: 'INVALID_DATE_RANGE',
      });
    }
    const toExclusive = new Date(toStart);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return { fromStart, toExclusive };
  }

  async getOverview(actor: AuthUser): Promise<AdminOverview> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [
      provinceCount,
      centerCount,
      completedTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
      liveMatchesRaw,
      upcomingMatchesRaw,
      scorerMatch,
    ] = await Promise.all([
      this.prisma.province.count({ where: { isActive: true } }),
      this.prisma.center.count({ where: { isActive: true } }),
      this.prisma.tournament.count({
        where: { ...activeTournamentWhere, state: TournamentState.Completed },
      }),
      this.prisma.user.count({ where: { ...adminDirectoryUserWhere, isActive: true } }),
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
      this.dashboardFeaturedMatches.loadLiveMatches(actor),
      this.dashboardFeaturedMatches.loadUpcomingMatches(actor),
      this.scorerDashboardMatch.loadStartableMatch(actor.id),
    ]);

    const excludeScorer = <T extends { matchId: string }>(matches: T[]) =>
      scorerMatch ? matches.filter((match) => match.matchId !== scorerMatch.matchId) : matches;

    return {
      provinceCount,
      centerCount,
      completedTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
      liveMatches: excludeScorer(liveMatchesRaw),
      upcomingMatches: excludeScorer(upcomingMatchesRaw),
      scorerMatch,
    };
  }
}
