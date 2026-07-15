import { PushPlatform } from '@acc/types';
import { ConfigService } from '@nestjs/config';

import { ApnsFcmTokenConverter } from './apns-fcm-token.converter';
import { PushTokenService } from './push-token.service';

describe('ApnsFcmTokenConverter.looksLikeApnsToken', () => {
  const converter = new ApnsFcmTokenConverter({
    get: () => undefined,
  } as unknown as ConfigService);

  it('accepts classic 64-char hex APNs tokens', () => {
    expect(converter.looksLikeApnsToken('a'.repeat(64))).toBe(true);
  });

  it('rejects FCM registration tokens (contain a colon)', () => {
    expect(
      converter.looksLikeApnsToken('dXyza:APA91bExampleFcmRegistrationTokenValueHere'),
    ).toBe(false);
  });

  it('rejects short hex strings', () => {
    expect(converter.looksLikeApnsToken('abcd')).toBe(false);
  });
});

describe('PushTokenService.register', () => {
  it('converts iOS APNs tokens to FCM before upsert', async () => {
    const prisma = {
      pushDeviceToken: {
        upsert: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const apnsFcm = {
      looksLikeApnsToken: jest.fn().mockReturnValue(true),
      toFcmRegistrationToken: jest.fn().mockResolvedValue('fcm:converted-token'),
    };
    const service = new PushTokenService(prisma as never, apnsFcm as never);

    await service.register('user-1', 'a'.repeat(64), PushPlatform.Ios);

    expect(apnsFcm.toFcmRegistrationToken).toHaveBeenCalled();
    expect(prisma.pushDeviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'fcm:converted-token' },
        create: expect.objectContaining({ token: 'fcm:converted-token' }),
      }),
    );
    expect(prisma.pushDeviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'a'.repeat(64) },
    });
  });

  it('stores Android tokens as-is', async () => {
    const prisma = {
      pushDeviceToken: {
        upsert: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn(),
      },
    };
    const apnsFcm = {
      looksLikeApnsToken: jest.fn().mockReturnValue(false),
      toFcmRegistrationToken: jest.fn(),
    };
    const service = new PushTokenService(prisma as never, apnsFcm as never);
    const androidToken = 'dXyza:APA91bAndroidFcmToken';

    await service.register('user-1', androidToken, PushPlatform.Android);

    expect(apnsFcm.toFcmRegistrationToken).not.toHaveBeenCalled();
    expect(prisma.pushDeviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: androidToken },
      }),
    );
    expect(prisma.pushDeviceToken.deleteMany).not.toHaveBeenCalled();
  });
});
