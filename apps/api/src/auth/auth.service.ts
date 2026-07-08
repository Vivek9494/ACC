import {
  AuthErrorCode,
  type AuthResponse,
  type AuthTokens,
  type AuthUser,
  CHANGE_PASSWORD_MESSAGES,
  type TeamLeadAssignment,
  INVALID_POSTAL_CODE_MESSAGE,
  isPasswordPolicyCompliant,
  isValidCanadianPostalCode,
  LOGIN_RATE_LIMIT,
  MIN_SIGNUP_AGE,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  normalizeCanadianPostalCode,
  normalizeCanadianMobile,
  profileMobileForStorage,
  PASSWORD_POLICY_INVALID_MESSAGE,
  REFRESH_IDLE_DAYS,
  SIGNUP_VALIDATION_MESSAGES,
  TEMP_PASSWORD_EXPIRED_MESSAGE,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { RedisService } from '../redis/redis.service';
import {
  type AccessTokenPayload,
  BCRYPT_SALT_ROUNDS,
  loginAttemptsKey,
  type RefreshTokenPayload,
  refreshKey,
} from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';

const REFRESH_IDLE_SECONDS = REFRESH_IDLE_DAYS * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const mobileNumber = profileMobileForStorage(dto.mobileNumber);
    const emergencyContactNumber = profileMobileForStorage(dto.emergencyContactNumber);
    const existing = await this.prisma.user.findUnique({
      where: { mobileNumber },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: MOBILE_NUMBER_EXISTS_MESSAGE,
        error: AuthErrorCode.MobileNumberExists,
      });
    }

    const dob = new Date(dto.dateOfBirth);
    if (this.ageInYears(dob, new Date()) < MIN_SIGNUP_AGE) {
      throw new BadRequestException({
        message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.underage,
        error: AuthErrorCode.Underage,
      });
    }

    const center = await this.prisma.center.findUnique({
      where: { id: dto.centerId },
      select: { id: true, isActive: true },
    });
    if (!center || !center.isActive) {
      throw new BadRequestException({
        message: 'Invalid or inactive center',
        error: AuthErrorCode.InvalidCenter,
      });
    }

    const address = dto.address?.trim() || null;
    const postalCodeRaw = dto.postalCode?.trim() ?? '';
    let postalCode: string | null = null;
    if (postalCodeRaw) {
      if (!isValidCanadianPostalCode(postalCodeRaw)) {
        throw new BadRequestException({
          message: INVALID_POSTAL_CODE_MESSAGE,
          error: 'INVALID_POSTAL_CODE',
        });
      }
      postalCode = normalizeCanadianPostalCode(postalCodeRaw);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobileNumber,
        email: dto.email?.trim() || '',
        dateOfBirth: dob,
        address,
        postalCode,
        centerId: dto.centerId,
        jerseyNumber: dto.jerseyNumber ?? 0,
        profilePhotoUrl: dto.profilePhotoUrl ?? null,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactNumber,
        passwordHash,
      },
    });

    const tokens = await this.startSession(user);
    return { user: await loadAuthUser(this.prisma, user, this.mediaUrls), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const mobileNumber = normalizeCanadianMobile(dto.mobileNumber);
    const attemptsKey = loginAttemptsKey(mobileNumber);
    const attempts = Number((await this.redis.get(attemptsKey)) ?? 0);
    if (attempts >= LOGIN_RATE_LIMIT.maxAttempts) {
      throw new HttpException(
        {
          message: 'Too many login attempts. Please try again later.',
          error: AuthErrorCode.TooManyAttempts,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    const passwordOk = user
      ? await bcrypt.compare(dto.password.trim(), user.passwordHash)
      : false;
    if (!user || !passwordOk || !user.isActive || user.deletedAt) {
      await this.redis.incrementWithTtl(attemptsKey, LOGIN_RATE_LIMIT.windowSeconds);
      throw new UnauthorizedException({
        message: 'Invalid mobile number or password',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    if (
      user.mustChangePassword &&
      user.tempPasswordExpiresAt &&
      user.tempPasswordExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException({
        message: TEMP_PASSWORD_EXPIRED_MESSAGE,
        error: AuthErrorCode.TempPasswordExpired,
      });
    }

    await this.redis.del(attemptsKey);

    // Single-device enforcement (§3.2): bumping tokenVersion on every login
    // invalidates any token still held by a previously logged-in device.
    const tokens = await this.startSession(user);
    return { user: await loadAuthUser(this.prisma, user, this.mediaUrls), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        error: AuthErrorCode.RefreshExpired,
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        error: AuthErrorCode.RefreshExpired,
      });
    }

    // Idle timeout (§3.2): the active token id lives in Redis with a sliding
    // 10-day TTL. Missing => unused for 10 days (or superseded) => expired.
    const activeJti = await this.redis.getAndSlideTtl(refreshKey(payload.sub), REFRESH_IDLE_SECONDS);
    if (activeJti === null || activeJti !== payload.jti) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        error: AuthErrorCode.RefreshExpired,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException({
        message: 'Session is no longer valid',
        error: AuthErrorCode.TokenVersionMismatch,
      });
    }

    // Rotate the refresh token id (keeps tokenVersion) and slide the window.
    return this.rotateTokens(user);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return loadAuthUser(this.prisma, user, this.mediaUrls);
  }

  /** Invalidates the current session (§3.2 single-device logout). */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.redis.del(refreshKey(userId));
  }

  /**
   * Verifies the current password, enforces the shared policy, bumps tokenVersion, and
   * clears the refresh session — invalidating every device including the caller.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new UnauthorizedException({
        message: CHANGE_PASSWORD_MESSAGES.currentIncorrect,
        error: AuthErrorCode.CurrentPasswordIncorrect,
      });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        message: CHANGE_PASSWORD_MESSAGES.sameAsCurrent,
        error: AuthErrorCode.SamePassword,
      });
    }

    if (!isPasswordPolicyCompliant(newPassword)) {
      throw new BadRequestException({
        message: PASSWORD_POLICY_INVALID_MESSAGE,
        error: 'INVALID_PASSWORD',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await this.redis.del(refreshKey(userId));
  }

  /**
   * Completes a forced password change after an admin-issued temporary password.
   * Clears the must-change flag without invalidating the current session.
   */
  async completeForcedPasswordChange(userId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    if (!user.mustChangePassword) {
      throw new BadRequestException({
        message: 'No password change is required for this account',
        error: 'PASSWORD_CHANGE_NOT_REQUIRED',
      });
    }

    if (!isPasswordPolicyCompliant(newPassword)) {
      throw new BadRequestException({
        message: PASSWORD_POLICY_INVALID_MESSAGE,
        error: 'INVALID_PASSWORD',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });
  }

  /** Bumps tokenVersion, then mints a fresh token pair (login/signup entry). */
  private async startSession(user: User): Promise<AuthTokens> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    // Keep the caller's in-memory copy in sync for the response projection.
    user.tokenVersion = updated.tokenVersion;
    return this.rotateTokens(updated);
  }

  /** Signs a new pair without touching tokenVersion; records the active jti. */
  private async rotateTokens(user: User): Promise<AuthTokens> {
    const jti = randomUUID();

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
      jti,
      type: 'refresh',
    };

    // jsonwebtoken types `expiresIn` as a template-literal duration; the env
    // value is a plain string so assert it to the option's own type.
    const expiresIn = this.config.get<string>(
      'JWT_ACCESS_TTL',
      '1h',
    ) as JwtSignOptions['expiresIn'];
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });

    await this.redis.setWithTtl(refreshKey(user.id), jti, REFRESH_IDLE_SECONDS);

    return { accessToken, refreshToken };
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

  /** Resolves the viewer on public routes when a valid Bearer token is sent. */
  async resolveOptionalUser(request: Request): Promise<AuthUser | null> {
    const token = this.extractBearer(request);
    if (!token) {
      return null;
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }

    if (payload.type !== 'access') {
      return null;
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    return toAuthUser(user);
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}

export function toAuthUser(
  user: User,
  teamLeadAssignments: TeamLeadAssignment[] = [],
  centerSevakCenterIds: string[] = [],
): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber,
    email: user.email,
    centerId: user.centerId,
    jerseyNumber: user.jerseyNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    role: user.role,
    isActive: user.isActive,
    teamLeadAssignments,
    centerSevakCenterIds,
    ...(user.mustChangePassword ? { mustChangePassword: true as const } : {}),
  };
}

export async function loadAuthUser(
  prisma: PrismaService,
  user: User,
  mediaUrls?: MediaUrlResolver,
): Promise<AuthUser> {
  const [leadAssignments, sevakAssignments] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: {
        userId: user.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain, UserRole.Manager] },
      },
      select: { role: true, tournamentId: true, teamId: true },
    }),
    prisma.roleAssignment.findMany({
      where: { userId: user.id, role: UserRole.CenterSevak },
      select: { centerId: true },
    }),
  ]);

  const teamLeadAssignments: TeamLeadAssignment[] = leadAssignments.flatMap((row) => {
    if (!row.tournamentId || !row.teamId) {
      return [];
    }
    if (
      row.role !== UserRole.Captain &&
      row.role !== UserRole.ViceCaptain &&
      row.role !== UserRole.Manager
    ) {
      return [];
    }
    return [
      {
        role: row.role,
        tournamentId: row.tournamentId,
        teamId: row.teamId,
      },
    ];
  });

  const centerSevakCenterIds = sevakAssignments
    .map((row) => row.centerId)
    .filter((id): id is string => id !== null);

  const authUser = toAuthUser(user, teamLeadAssignments, centerSevakCenterIds);
  if (mediaUrls) {
    authUser.profilePhotoUrl = await mediaUrls.resolveReadUrl(authUser.profilePhotoUrl);
  }
  return authUser;
}
