import {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE_MAX,
  type AdminOverview,
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
} from '@acc/types';
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS, refreshKey } from '../auth/auth.constants';
import { generateSecureTemporaryPassword } from '../auth/password.util';
import { AuditService } from '../audit/audit.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
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
          ...(mobileChanged ? { tokenVersion: { increment: 1 } } : {}),
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

    const [statsBundle, wicketkeeperRegistration] = await Promise.all([
      this.playerStats.buildCareerStats(userId, ballType),
      this.prisma.registration.findFirst({
        where: { userId, fieldingPosition: 'Wicketkeeper' },
        select: { id: true },
      }),
    ]);

    return {
      ballType,
      ballTypeLabel: PLAYER_PROFILE_BALL_TYPE_LABELS[ballType],
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

  async getOverview(): Promise<AdminOverview> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
      featuredMatches,
    ] = await Promise.all([
      this.prisma.province.count({ where: { isActive: true } }),
      this.prisma.center.count({ where: { isActive: true } }),
      this.prisma.tournament.count({
        where: { ...activeTournamentWhere, state: { not: TournamentState.Completed } },
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
      this.dashboardFeaturedMatches.loadTodayMatches(),
    ]);

    return {
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
      featuredMatches,
    };
  }
}
