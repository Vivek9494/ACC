import 'reflect-metadata';

import {
  AuthErrorCode,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@acc/types';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SMS_PROVIDER } from '../sms/sms-provider';
import { PasswordResetService } from './password-reset.service';
import type { ResetPasswordDto } from './dto/reset-password.dto';

function errorCode(err: unknown): string {
  const response = (err as HttpException).getResponse() as { error: string };
  return response.error;
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let redis: {
    get: jest.Mock;
    incrementWithTtl: jest.Mock;
    setWithTtl: jest.Mock;
    del: jest.Mock;
  };
  let sms: { sendOtp: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
    redis = {
      get: jest.fn(),
      incrementWithTtl: jest.fn().mockResolvedValue(1),
      setWithTtl: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: AuditService, useValue: audit },
        { provide: SMS_PROVIDER, useValue: sms },
      ],
    }).compile();

    service = moduleRef.get(PasswordResetService);
  });

  const mobile = '+15555550100';
  const ip = '127.0.0.1';

  const resetDto = (overrides: Partial<ResetPasswordDto> = {}): ResetPasswordDto => ({
    resetToken: 'reset-token-abc',
    newPassword: 'Password1!',
    ...overrides,
  });

  describe('OTP send', () => {
    it('silently succeeds for unknown numbers (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestOtp(mobile, ip);

      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('stores a hashed OTP and sends via the SMS provider', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(null);

      await service.requestOtp(mobile, ip);

      expect(redis.setWithTtl).toHaveBeenCalledWith(
        expect.stringContaining('otp:code:'),
        expect.not.stringMatching(/^\d{4}$/),
        expect.any(Number),
      );
      expect(sms.sendOtp).toHaveBeenCalledWith(mobile, expect.stringMatching(/^\d{4}$/));
    });

    it(`rejects resend during the ${OTP_RESEND_COOLDOWN_SECONDS}s cooldown`, async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue('1');

      expect.assertions(3);
      try {
        await service.requestOtp(mobile, ip);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it(`rejects the request that exceeds ${OTP_MAX_REQUESTS_PER_DAY} per day`, async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(null);
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_REQUESTS_PER_DAY + 1);

      expect.assertions(3);
      try {
        await service.requestOtp(mobile, ip);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(sms.sendOtp).not.toHaveBeenCalled();
      }
    });
  });

  describe('OTP verify', () => {
    it('issues a reset token when the OTP matches', async () => {
      const otp = '1234';
      const hash = await bcrypt.hash(otp, 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);

      const result = await service.verifyOtp(mobile, otp, ip);

      expect(result.resetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:code:'));
    });

    it('rejects a wrong OTP and counts toward the attempt limit', async () => {
      const hash = await bcrypt.hash('1234', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);
      redis.incrementWithTtl.mockResolvedValue(2);

      await expect(service.verifyOtp(mobile, '0000', ip)).rejects.toMatchObject({
        response: expect.objectContaining({ error: AuthErrorCode.OtpInvalid }),
      });
    });

    it(`invalidates the OTP on the ${OTP_MAX_FAILED_ATTEMPTS}th failed attempt`, async () => {
      const hash = await bcrypt.hash('1234', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_FAILED_ATTEMPTS);

      expect.assertions(2);
      try {
        await service.verifyOtp(mobile, '0000', ip);
      } catch (err) {
        expect(errorCode(err)).toBe(AuthErrorCode.OtpAttemptsExceeded);
        expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:code:'));
      }
    });

    it('rejects verify when no OTP is stored (expired)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(null);

      await expect(service.verifyOtp(mobile, '1234', ip)).rejects.toMatchObject({
        response: expect.objectContaining({ error: AuthErrorCode.OtpInvalid }),
      });
    });
  });

  describe('reset password', () => {
    it('rejects an unknown or expired reset token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto())).rejects.toMatchObject({
        response: expect.objectContaining({ error: AuthErrorCode.ResetTokenInvalid }),
      });
    });

    it('updates the password and consumes the reset token', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'u1', mobileNumber: mobile }));
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        mobileNumber: mobile,
        passwordResetLockedAt: null,
      });

      await service.resetPassword(resetDto());

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('reset:token:'));
    });

    it('cannot reuse a consumed reset token', async () => {
      redis.get.mockResolvedValueOnce(JSON.stringify({ userId: 'u1', mobileNumber: mobile }));
      redis.get.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        mobileNumber: mobile,
        passwordResetLockedAt: null,
      });

      await service.resetPassword(resetDto());
      await expect(service.resetPassword(resetDto())).rejects.toMatchObject({
        response: expect.objectContaining({ error: AuthErrorCode.ResetTokenInvalid }),
      });
    });

    it('rejects reset when the account is locked', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'u1', mobileNumber: mobile }));
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        mobileNumber: mobile,
        passwordResetLockedAt: new Date(),
      });

      await expect(service.resetPassword(resetDto())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
