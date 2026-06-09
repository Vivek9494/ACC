import {
  AuthErrorCode,
  type AuthResponse,
  type AuthTokens,
  type AuthUser,
  LOGIN_RATE_LIMIT,
  MIN_SIGNUP_AGE,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  REFRESH_IDLE_DAYS,
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

import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { mobileNumber: dto.mobileNumber },
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
        message: `You must be at least ${MIN_SIGNUP_AGE} years old to register`,
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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobileNumber: dto.mobileNumber,
        email: dto.email,
        dateOfBirth: dob,
        centerId: dto.centerId,
        jerseyNumber: dto.jerseyNumber ?? 0,
        profilePhotoUrl: dto.profilePhotoUrl ?? null,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactNumber: dto.emergencyContactNumber,
        passwordHash,
      },
    });

    const tokens = await this.startSession(user);
    return { user: toAuthUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const attemptsKey = loginAttemptsKey(dto.mobileNumber);
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
      where: { mobileNumber: dto.mobileNumber },
    });

    const passwordOk = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !passwordOk || !user.isActive) {
      await this.redis.incrementWithTtl(attemptsKey, LOGIN_RATE_LIMIT.windowSeconds);
      throw new UnauthorizedException({
        message: 'Invalid mobile number or password',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    await this.redis.del(attemptsKey);

    // Single-device enforcement (§3.2): bumping tokenVersion on every login
    // invalidates any token still held by a previously logged-in device.
    const tokens = await this.startSession(user);
    return { user: toAuthUser(user), tokens };
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
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException({
        message: 'Session is no longer valid',
        error: AuthErrorCode.TokenVersionMismatch,
      });
    }

    // Rotate the refresh token id (keeps tokenVersion) and slide the window.
    return this.rotateTokens(user);
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
      '15m',
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
}

export function toAuthUser(user: User): AuthUser {
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
  };
}
