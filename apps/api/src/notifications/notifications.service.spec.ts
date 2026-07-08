import 'reflect-metadata';

import type { PushProvider, PushSendResult } from './push-provider';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let push: { sendToTokens: jest.Mock };
  let tokens: { getTokensForUsers: jest.Mock; pruneTokens: jest.Mock };
  let log: { reserve: jest.Mock; finalize: jest.Mock };
  let service: NotificationsService;

  const content = {
    triggerKey: 'TEST',
    title: 'Hello',
    body: 'World',
  };

  beforeEach(() => {
    push = { sendToTokens: jest.fn() };
    tokens = { getTokensForUsers: jest.fn(), pruneTokens: jest.fn() };
    log = { reserve: jest.fn(), finalize: jest.fn() };
    service = new NotificationsService(
      push as unknown as PushProvider,
      tokens as never,
      log as never,
    );
  });

  it('sends to all of a user’s tokens and prunes the invalid ones', async () => {
    log.reserve.mockResolvedValue('log-1');
    tokens.getTokensForUsers.mockResolvedValue(['t1', 't2', 't3']);
    const sendResult: PushSendResult = {
      successTokens: ['t1'],
      invalidTokens: ['t2'],
      failedTokens: ['t3'],
    };
    push.sendToTokens.mockResolvedValue(sendResult);

    const result = await service.sendNotification({
      userIds: ['u1', 'u1', 'u2'],
      ...content,
    });

    // De-duped recipient user ids.
    expect(tokens.getTokensForUsers).toHaveBeenCalledWith(['u1', 'u2']);
    expect(push.sendToTokens).toHaveBeenCalledWith(['t1', 't2', 't3'], {
      title: 'Hello',
      body: 'World',
      data: undefined,
    });
    // Only FCM-rejected tokens are pruned.
    expect(tokens.pruneTokens).toHaveBeenCalledWith(['t2']);
    expect(log.finalize).toHaveBeenCalledWith('log-1', {
      recipientCount: 2,
      successCount: 1,
      failureCount: 2,
    });
    expect(result).toEqual({
      sent: true,
      recipientUserCount: 2,
      tokenCount: 3,
      successCount: 1,
      failureCount: 2,
    });
  });

  it('de-dups: skips dispatch when the dedupeKey was already used', async () => {
    log.reserve.mockResolvedValue(null); // reservation collided → already sent

    const result = await service.sendNotification({
      userIds: ['u1'],
      ...content,
      dedupeKey: 'TEST:match-1:2026-07-07',
    });

    expect(result.sent).toBe(false);
    expect(result.deduped).toBe(true);
    expect(tokens.getTokensForUsers).not.toHaveBeenCalled();
    expect(push.sendToTokens).not.toHaveBeenCalled();
    expect(log.finalize).not.toHaveBeenCalled();
  });

  it('records the send even when the audience has no device tokens', async () => {
    log.reserve.mockResolvedValue('log-2');
    tokens.getTokensForUsers.mockResolvedValue([]);

    const result = await service.sendNotification({ userIds: ['u1'], ...content });

    expect(push.sendToTokens).not.toHaveBeenCalled();
    expect(tokens.pruneTokens).not.toHaveBeenCalled();
    expect(log.finalize).toHaveBeenCalledWith('log-2', {
      recipientCount: 1,
      successCount: 0,
      failureCount: 0,
    });
    expect(result.sent).toBe(true);
    expect(result.tokenCount).toBe(0);
  });

  it('sendToAudience delegates to sendNotification', async () => {
    log.reserve.mockResolvedValue('log-3');
    tokens.getTokensForUsers.mockResolvedValue([]);

    const result = await service.sendToAudience(['u9'], content);

    expect(result.sent).toBe(true);
    expect(result.recipientUserCount).toBe(1);
  });
});
