import {
  AuthErrorCode,
  type AuthUser,
  OTP_LENGTH,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_TTL_SECONDS,
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
import { randomInt } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  BCRYPT_SALT_ROUNDS,
  otpCodeKey,
  otpFailedCountKey,
  otpRequestCountKey,
} from './auth.constants';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { SMS_SENDER, type SmsSender } from '../sms/sms-sender';

const ONE_DAY_SECONDS = 24 * 60 * 60;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  /**
   * Generates and sends an OTP (§3.3). Silent when the mobile number is
   * unknown so we don't leak which numbers are registered.
   */
  async requestOtp(mobileNumber: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
      select: { id: true },
    });
    if (!user) {
      return;
    }

    // Daily send cap (§3.4): the counter resets 24h after the first request.
    const requestCount = await this.redis.incrementWithTtl(
      otpRequestCountKey(mobileNumber),
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
    await this.redis.setWithTtl(otpCodeKey(mobileNumber), otp, OTP_TTL_SECONDS);
    await this.sms.sendSms(
      mobileNumber,
      `Your ACC password reset code is ${otp}. It expires in 5 minutes.`,
    );
  }

  /** Verifies the OTP and sets a new password (§3.3, §3.4). */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { mobileNumber: dto.mobileNumber } });
    if (!user) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    if (user.passwordResetLockedAt) {
      throw this.lockedError();
    }

    const storedOtp = await this.redis.get(otpCodeKey(dto.mobileNumber));
    if (storedOtp === null) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    if (storedOtp !== dto.otp) {
      const failed = await this.redis.incrementWithTtl(
        otpFailedCountKey(dto.mobileNumber),
        ONE_DAY_SECONDS,
      );
      if (failed >= OTP_MAX_FAILED_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordResetLockedAt: new Date() },
        });
        await this.redis.del(otpCodeKey(dto.mobileNumber));
        throw this.lockedError();
      }
      throw new BadRequestException({
        message: 'Invalid or expired code',
        error: AuthErrorCode.OtpInvalid,
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      // Bumping tokenVersion logs out any existing sessions after a reset.
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    await Promise.all([
      this.redis.del(otpCodeKey(dto.mobileNumber)),
      this.redis.del(otpFailedCountKey(dto.mobileNumber)),
      this.redis.del(otpRequestCountKey(dto.mobileNumber)),
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
    ]);

    await this.audit.record({
      action: 'PASSWORD_RESET_UNLOCK',
      actorUserId: actor.id,
      targetUserId: userId,
      details: { unlockedAt: new Date().toISOString(), actorRole: actor.role },
    });
  }

  private lockedError(): ForbiddenException {
    return new ForbiddenException({
      message: 'Account is locked from password reset. Contact an administrator.',
      error: AuthErrorCode.PasswordResetLocked,
    });
  }

  private generateOtp(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }
}
