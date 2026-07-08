import 'reflect-metadata';

import { AuthErrorCode, MOBILE_NUMBER_EXISTS_MESSAGE } from '@acc/types';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { SignupDto } from './dto/signup.dto';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+15555550100',
    email: 'test@example.com',
    dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    address: null,
    postalCode: null,
    centerId: 'center-1',
    jerseyNumber: 7,
    jerseyName: null,
    jerseySize: null,
    hasHealthCard: false,
    profilePhotoUrl: null,
    emergencyContactName: 'Kin',
    emergencyContactNumber: '+15555550111',
    passwordHash: 'hashed',
    mustChangePassword: false,
    tempPasswordExpiresAt: null,
    role: 'PLAYER',
    tokenVersion: 1,
    isActive: true,
    deletedAt: null,
    passwordResetLockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseSignupDto(overrides: Partial<SignupDto> = {}): SignupDto {
  return {
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+15555550100',
    email: 'test@example.com',
    dateOfBirth: '1990-01-01',
    centerId: 'center-1',
    jerseyNumber: 7,
    profilePhotoUrl: null,
    emergencyContactName: 'Kin',
    emergencyContactNumber: '+15555550111',
    password: 'password1',
    ...overrides,
  };
}

function executionContextWithAuth(header: string | undefined): ExecutionContext {
  const request = { headers: { authorization: header } } as unknown as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    center: { findUnique: jest.Mock };
    roleAssignment: { findMany: jest.Mock };
  };
  let redis: { get: jest.Mock; incrementWithTtl: jest.Mock; del: jest.Mock; setWithTtl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      center: { findUnique: jest.fn() },
      roleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    redis = {
      get: jest.fn(),
      incrementWithTtl: jest.fn(),
      del: jest.fn(),
      setWithTtl: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed') } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'a-very-long-test-secret', get: () => '15m' },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('rejects signup when the mobile number already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    expect.assertions(3);
    try {
      await service.signup(baseSignupDto());
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const response = (err as ConflictException).getResponse() as {
        message: string;
        error: string;
      };
      expect(response.message).toBe(MOBILE_NUMBER_EXISTS_MESSAGE);
      expect(response.error).toBe(AuthErrorCode.MobileNumberExists);
    }
  });

  it('rejects signup for users under 18', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const tenYearsAgo = new Date();
    tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);
    const dateOfBirth = tenYearsAgo.toISOString().slice(0, 10);

    expect.assertions(4);
    try {
      await service.signup(baseSignupDto({ dateOfBirth }));
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        error: string;
        message: string;
      };
      expect(response.error).toBe(AuthErrorCode.Underage);
      expect(response.message).toBe('You must be at least 18 years old');
      // center lookup must never run when the age check already failed
      expect(prisma.center.findUnique).not.toHaveBeenCalled();
    }
  });

  it('rejects signup with an invalid postal code', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.center.findUnique.mockResolvedValue({ id: 'center-1', isActive: true });

    expect.assertions(3);
    try {
      await service.signup(baseSignupDto({ postalCode: 'INVALID' }));
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        message: string;
        error: string;
      };
      expect(response.message).toBe('Enter a valid postal code');
      expect(response.error).toBe('INVALID_POSTAL_CODE');
    }
  });

  it('increments tokenVersion on login so prior sessions are invalidated', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ tokenVersion: 4 }));
    prisma.user.update.mockResolvedValue(makeUser({ tokenVersion: 5 }));
    redis.get.mockResolvedValue(null);

    const jestBcrypt = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('bcrypt') as { compare: (a: string, b: string) => Promise<boolean> },
      'compare',
    );
    jestBcrypt.mockResolvedValue(true as never);

    await service.login({ mobileNumber: '+15555550100', password: 'password1' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }),
    );
    jestBcrypt.mockRestore();
  });

  it('increments tokenVersion and clears refresh on logout', async () => {
    prisma.user.update.mockResolvedValue(makeUser({ tokenVersion: 6 }));

    await service.logout('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(redis.del).toHaveBeenCalledWith('refresh:user-1');
  });
});

describe('JwtAuthGuard (tokenVersion enforcement)', () => {
  let guard: JwtAuthGuard;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { getOrThrow: () => 'secret' } },
      ],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
  });

  it('allows public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(executionContextWithAuth(undefined))).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a token whose embedded tokenVersion is stale', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 3, type: 'access' });
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 'user-1', tokenVersion: 4 }));

    expect.assertions(2);
    try {
      await guard.canActivate(executionContextWithAuth('Bearer stale-token'));
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as { error: string };
      expect(response.error).toBe(AuthErrorCode.TokenVersionMismatch);
    }
  });

  it('accepts a token whose tokenVersion matches the current user', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 4, type: 'access' });
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 'user-1', tokenVersion: 4 }));

    await expect(
      guard.canActivate(executionContextWithAuth('Bearer fresh-token')),
    ).resolves.toBe(true);
  });
});
