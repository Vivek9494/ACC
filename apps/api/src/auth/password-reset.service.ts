import {
  AuthErrorCode,
  isPasswordPolicyCompliant,
  OTP_IP_RATE_LIMIT,
  OTP_LENGTH,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PASSWORD_POLICY_INVALID_MESSAGE,
  RESET_TOKEN_TTL_SECONDS,
  normalizeCanadianMobile,
  type AuthUser,
  type VerifyResetOtpResponse,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms-provider';
import {
  BCRYPT_SALT_ROUNDS,
  otpCodeKey,
  otpFailedCountKey,
  otpIpRateKey,
  otpRequestCountKey,
  otpResendCooldownKey,
  resetTokenKey,
} from './auth.constants';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const ONE_DAY_SECONDS = 24 * 60 * 60;

interface ResetTokenPayload {
  userId: string;
  mobileNumber: string;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /**
   * Generates and sends an OTP (§3.3). Silent when the mobile number is
   * unknown so we don't leak which numbers are registered.
   */
  async requestOtp(mobileNumber: string, clientIp: string): Promise<void> {
    const normalized = this.normalizeMobile(mobileNumber);
    await this.assertIpRateLimit(clientIp);

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber: normalized },
      select: { id: true, passwordResetLockedAt: true },
    });
    if (!user) {
      return;
    }

    if (user.passwordResetLockedAt) {
      throw this.lockedError();
    }

    const resendBlocked = await this.redis.get(otpResendCooldownKey(normalized));
    if (resendBlocked !== null) {
      throw new HttpException(
        {
          message: 'Please wait before requesting another code.',
          error: AuthErrorCode.OtpResendCooldown,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const requestCount = await this.redis.incrementWithTtl(
      otpRequestCountKey(normalized),
      ONE_DAY_SECONDS,
    );
    if (requestCount > OTP_MAX_REQUESTS_PER_DAY) {
      throw new HttpException(
        {
          message: 'Too many OTP requests. Please try again tomorrow.',
          error: AuthErrorCode.OtpRequestLimit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_SALT_ROUNDS);
    await this.sms.sendOtp(normalized, otp);
    await Promise.all([
      this.redis.setWithTtl(otpCodeKey(normalized), otpHash, OTP_TTL_SECONDS),
      this.redis.del(otpFailedCountKey(normalized)),
      this.redis.setWithTtl(otpResendCooldownKey(normalized), '1', OTP_RESEND_COOLDOWN_SECONDS),
    ]);
  }

  /** Verifies the OTP and issues a short-lived reset token. */
  async verifyOtp(
    mobileNumber: string,
    otp: string,
    clientIp: string,
  ): Promise<VerifyResetOtpResponse> {
    const normalized = this.normalizeMobile(mobileNumber);
    await this.assertIpRateLimit(clientIp);

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber: normalized },
      select: { id: true, passwordResetLockedAt: true },
    });
    if (!user) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    if (user.passwordResetLockedAt) {
      throw this.lockedError();
    }

    const storedHash = await this.redis.get(otpCodeKey(normalized));
    if (storedHash === null) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    const matches = await bcrypt.compare(otp, storedHash);
    if (!matches) {
      const failed = await this.redis.incrementWithTtl(
        otpFailedCountKey(normalized),
        OTP_TTL_SECONDS,
      );
      if (failed >= OTP_MAX_FAILED_ATTEMPTS) {
        await Promise.all([
          this.redis.del(otpCodeKey(normalized)),
          this.redis.del(otpFailedCountKey(normalized)),
        ]);
        throw new BadRequestException({
          message: 'Too many incorrect attempts. Please request a new code.',
          error: AuthErrorCode.OtpAttemptsExceeded,
        });
      }
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    const resetToken = randomBytes(32).toString('hex');
    const payload: ResetTokenPayload = { userId: user.id, mobileNumber: normalized };
    await Promise.all([
      this.redis.setWithTtl(resetTokenKey(resetToken), JSON.stringify(payload), RESET_TOKEN_TTL_SECONDS),
      this.redis.del(otpCodeKey(normalized)),
      this.redis.del(otpFailedCountKey(normalized)),
    ]);

    return { resetToken };
  }

  /** Sets a new password using a reset token issued after OTP verification. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const raw = await this.redis.get(resetTokenKey(dto.resetToken));
    if (raw === null) {
      throw new BadRequestException({
        message: 'Your reset session expired. Please start again.',
        error: AuthErrorCode.ResetTokenInvalid,
      });
    }

    const payload = JSON.parse(raw) as ResetTokenPayload;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        mobileNumber: true,
        passwordResetLockedAt: true,
      },
    });
    if (!user || user.mobileNumber !== payload.mobileNumber) {
      throw new BadRequestException({
        message: 'Your reset session expired. Please start again.',
        error: AuthErrorCode.ResetTokenInvalid,
      });
    }

    if (user.passwordResetLockedAt) {
      throw this.lockedError();
    }

    if (!isPasswordPolicyCompliant(dto.newPassword)) {
      throw new BadRequestException({
        message: PASSWORD_POLICY_INVALID_MESSAGE,
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    await Promise.all([
      this.redis.del(resetTokenKey(dto.resetToken)),
      this.redis.del(otpRequestCountKey(user.mobileNumber)),
    ]);
  }

  /**
   * Clears a password-reset lock and resets OTP counters, then audits the
   * action. Restricted to admin/captain/club-manager at the controller (§3.4).
   */
  async unlock(actor: AuthUser, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetLockedAt: null },
    });
    await Promise.all([
      this.redis.del(otpFailedCountKey(user.mobileNumber)),
      this.redis.del(otpRequestCountKey(user.mobileNumber)),
      this.redis.del(otpCodeKey(user.mobileNumber)),
      this.redis.del(otpResendCooldownKey(user.mobileNumber)),
    ]);

    await this.audit.record({
      action: 'PASSWORD_RESET_UNLOCK',
      actorUserId: actor.id,
      targetUserId: userId,
      details: { unlockedAt: new Date().toISOString(), actorRole: actor.role },
    });
  }

  private async assertIpRateLimit(clientIp: string): Promise<void> {
    const count = await this.redis.incrementWithTtl(
      otpIpRateKey(clientIp),
      OTP_IP_RATE_LIMIT.windowSeconds,
    );
    if (count > OTP_IP_RATE_LIMIT.maxAttempts) {
      throw new HttpException(
        {
          message: 'Too many requests. Please try again later.',
          error: AuthErrorCode.TooManyAttempts,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private lockedError(): ForbiddenException {
    return new ForbiddenException({
      message: 'Account is locked from password reset. Contact an administrator.',
      error: AuthErrorCode.PasswordResetLocked,
    });
  }

  private normalizeMobile(input: string): string {
    try {
      return normalizeCanadianMobile(input);
    } catch {
      throw new BadRequestException({
        message: 'Enter a valid 10-digit mobile number',
        error: AuthErrorCode.InvalidCredentials,
      });
    }
  }

  private generateOtp(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }
}
