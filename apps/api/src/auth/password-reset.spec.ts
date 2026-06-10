import 'reflect-metadata';

import { AuthErrorCode, OTP_MAX_FAILED_ATTEMPTS, OTP_MAX_REQUESTS_PER_DAY } from '@acc/types';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SMS_SENDER } from '../sms/sms-sender';
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
  let sms: { sendSms: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
    redis = {
      get: jest.fn(),
      incrementWithTtl: jest.fn(),
      setWithTtl: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    sms = { sendSms: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: AuditService, useValue: audit },
        { provide: SMS_SENDER, useValue: sms },
      ],
    }).compile();

    service = moduleRef.get(PasswordResetService);
  });

  const dto = (overrides: Partial<ResetPasswordDto> = {}): ResetPasswordDto => ({
    mobileNumber: '+15555550100',
    otp: '000000',
    newPassword: 'Password1!',
    ...overrides,
  });

  describe('OTP expiry', () => {
    it('rejects reset when no OTP is stored (expired or never requested)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(null);

      expect.assertions(2);
      try {
        await service.resetPassword(dto({ otp: '123456' }));
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(errorCode(err)).toBe(AuthErrorCode.OtpInvalid);
      }
    });
  });

  describe('daily request cap', () => {
    it(`rejects the request that exceeds ${OTP_MAX_REQUESTS_PER_DAY} per day`, async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_REQUESTS_PER_DAY + 1);

      expect.assertions(3);
      try {
        await service.requestOtp('+15555550100');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(sms.sendSms).not.toHaveBeenCalled();
      }
    });

    it('sends an OTP while within the cap', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_REQUESTS_PER_DAY);

      await service.requestOtp('+15555550100');

      expect(redis.setWithTtl).toHaveBeenCalledTimes(1);
      expect(sms.sendSms).toHaveBeenCalledTimes(1);
    });
  });

  describe('failed-attempt lockout', () => {
    it(`locks the account on the ${OTP_MAX_FAILED_ATTEMPTS}th failed OTP`, async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue('111111');
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_FAILED_ATTEMPTS);

      expect.assertions(3);
      try {
        await service.resetPassword(dto({ otp: '000000' }));
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(errorCode(err)).toBe(AuthErrorCode.PasswordResetLocked);
        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ passwordResetLockedAt: expect.any(Date) }),
          }),
        );
      }
    });

    it('does not lock while below the failed-attempt threshold', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue('111111');
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_FAILED_ATTEMPTS - 2);

      expect.assertions(2);
      try {
        await service.resetPassword(dto({ otp: '000000' }));
      } catch (err) {
        expect(errorCode(err)).toBe(AuthErrorCode.OtpInvalid);
        expect(prisma.user.update).not.toHaveBeenCalled();
      }
    });

    it('rejects reset outright when the account is already locked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordResetLockedAt: new Date(),
      });

      expect.assertions(2);
      try {
        await service.resetPassword(dto({ otp: '123456' }));
      } catch (err) {
        expect(errorCode(err)).toBe(AuthErrorCode.PasswordResetLocked);
        expect(redis.get).not.toHaveBeenCalled();
      }
    });
  });
});
