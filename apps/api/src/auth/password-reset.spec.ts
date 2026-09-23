import 'reflect-metadata';

import {
  AuthErrorCode,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_RESEND_COOLDOWN_SECONDS,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SMS_PROVIDER } from '../sms/sms-provider';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

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
        expect.not.stringMatching(/^\d{6}$/),
        expect.any(Number),
      );
      expect(sms.sendOtp).toHaveBeenCalledWith(mobile, expect.stringMatching(/^\d{6}$/));
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
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);

      const result = await service.verifyOtp(mobile, otp, ip);

      expect(result.resetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:code:'));
    });

    it('rejects a wrong OTP and counts toward the attempt limit', async () => {
      const hash = await bcrypt.hash('123456', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);
      redis.incrementWithTtl.mockResolvedValue(2);

      await expect(service.verifyOtp(mobile, '000000', ip)).rejects.toMatchObject({
        response: expect.objectContaining({ error: AuthErrorCode.OtpInvalid }),
      });
    });

    it(`invalidates the OTP on the ${OTP_MAX_FAILED_ATTEMPTS}th failed attempt`, async () => {
      const hash = await bcrypt.hash('123456', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(hash);
      redis.incrementWithTtl.mockResolvedValue(OTP_MAX_FAILED_ATTEMPTS);

      expect.assertions(2);
      try {
        await service.verifyOtp(mobile, '000000', ip);
      } catch (err) {
        expect(errorCode(err)).toBe(AuthErrorCode.OtpAttemptsExceeded);
        expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:code:'));
      }
    });

    it('rejects verify when no OTP is stored (expired)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordResetLockedAt: null });
      redis.get.mockResolvedValue(null);

      await expect(service.verifyOtp(mobile, '123456', ip)).rejects.toMatchObject({
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

  describe('unlock', () => {
    it('clears the DB lock and OTP counters for the target user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-target',
        mobileNumber: mobile,
        passwordResetLockedAt: new Date(),
      });

      await service.unlock(
        { id: 'admin-1', role: UserRole.Admin } as never,
        'u-target',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-target' },
        data: { passwordResetLockedAt: null },
      });
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:failed:'));
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:requests:'));
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:code:'));
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('otp:resend:'));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_UNLOCK',
          actorUserId: 'admin-1',
          targetUserId: 'u-target',
        }),
      );
    });
  });
});

describe('POST /auth/unlock roles', () => {
  it('allows Admin and Club Manager only (not Captain)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PasswordResetController.prototype.unlock) as
      | UserRole[]
      | undefined;
    expect(roles).toEqual([UserRole.Admin, UserRole.ClubManager]);
    expect(roles).not.toContain(UserRole.Captain);
  });

  it('RolesGuard rejects Captain with 403', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.Admin,
      UserRole.ClubManager,
    ]);
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => PasswordResetController.prototype.unlock,
      getClass: () => PasswordResetController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'captain-1', role: UserRole.Captain },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('RolesGuard allows Admin and Club Manager', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.Admin,
      UserRole.ClubManager,
    ]);
    const guard = new RolesGuard(reflector);

    for (const role of [UserRole.Admin, UserRole.ClubManager]) {
      const context = {
        getHandler: () => PasswordResetController.prototype.unlock,
        getClass: () => PasswordResetController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'actor-1', role } }),
        }),
      } as unknown as ExecutionContext;
      expect(guard.canActivate(context)).toBe(true);
    }
  });
});
