import { AUDIT_REDACTED_VALUE } from '@acc/types';
import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { isSecretAuditKey, redactAuditPayload } from './audit-redaction';
import { AuditService } from './audit.service';

function prismaMock() {
  const create = jest.fn().mockResolvedValue({});
  return { create, prisma: { auditLog: { create } } as unknown as PrismaService };
}

describe('isSecretAuditKey', () => {
  it.each([
    'password',
    'newPassword',
    'temporaryPassword',
    'passwordHash',
    'otpHash',
    'otp',
    'otpCode',
    'resetToken',
    'refreshToken',
    'access_token',
    'awsSecretAccessKey',
    'googleMapsApiKey',
    'Authorization',
  ])('treats %s as secret', (key) => {
    expect(isSecretAuditKey(key)).toBe(true);
  });

  it.each(['tokenVersion', 'awsKeyConfigured', 'googleMapsApiKeyUpdated', 'expiresAt', 'mobileNumber', 'hasImage'])(
    'keeps %s',
    (key) => {
      expect(isSecretAuditKey(key)).toBe(false);
    },
  );
});

describe('redactAuditPayload', () => {
  it('redacts nested secret keys and keeps everything else', () => {
    const payload: Prisma.InputJsonValue = {
      name: 'ACC 9',
      user: { id: 'u1', passwordHash: '$2b$12$abc', tokenVersion: 3 },
      attempts: [{ otp: '1234', at: '2026-09-30T10:00:00.000Z' }],
      nothing: null,
    };
    expect(redactAuditPayload(payload)).toEqual({
      name: 'ACC 9',
      user: { id: 'u1', passwordHash: AUDIT_REDACTED_VALUE, tokenVersion: 3 },
      attempts: [{ otp: AUDIT_REDACTED_VALUE, at: '2026-09-30T10:00:00.000Z' }],
      nothing: null,
    });
  });

  it('does not mutate the caller object', () => {
    const payload = { temporaryPassword: 'Secret!23' };
    redactAuditPayload(payload);
    expect(payload.temporaryPassword).toBe('Secret!23');
  });
});

describe('AuditService.record', () => {
  it('redacts, lower-cases the entity type and labels System entries', async () => {
    const { create, prisma } = prismaMock();
    await new AuditService(prisma).record({
      action: 'USER_CREATED',
      targetEntityType: 'User',
      targetEntityId: 'u1',
      after: { firstName: 'Dev', password: 'hunter2' },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: null,
        actorLabel: 'System',
        targetEntityType: 'user',
        after: { firstName: 'Dev', password: AUDIT_REDACTED_VALUE },
      }),
    });
  });

  it('writes through the transaction client when given one', async () => {
    const { create, prisma } = prismaMock();
    const txCreate = jest.fn().mockResolvedValue({});
    const tx = { auditLog: { create: txCreate } } as unknown as Prisma.TransactionClient;
    await new AuditService(prisma).record({ action: 'TEAM_DELETED', actorUserId: 'admin-1' }, tx);
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(txCreate.mock.calls[0][0].data.actorLabel).toBeNull();
  });
});
