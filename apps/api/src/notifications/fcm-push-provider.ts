import { Logger } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';

import type { PushMessage, PushProvider, PushSendResult } from './push-provider';

/** FCM caps a multicast at 500 tokens per request. */
const FCM_MULTICAST_LIMIT = 500;

/** FCM error codes that mean the token is permanently dead and should be pruned. */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Production adapter delivering push via Firebase Cloud Messaging (stack §29). */
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);

  constructor(private readonly firebase: App) {}

  async sendToTokens(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    const result: PushSendResult = {
      successTokens: [],
      invalidTokens: [],
      failedTokens: [],
    };
    if (tokens.length === 0) {
      return result;
    }

    const messaging = getMessaging(this.firebase);

    for (const batch of chunk(tokens, FCM_MULTICAST_LIMIT)) {
      const multicast: MulticastMessage = {
        tokens: batch,
        notification: { title: message.title, body: message.body },
        ...(message.data ? { data: message.data } : {}),
      };

      try {
        const response = await messaging.sendEachForMulticast(multicast);
        response.responses.forEach((res, index) => {
          const token = batch[index]!;
          if (res.success) {
            result.successTokens.push(token);
          } else if (res.error && INVALID_TOKEN_CODES.has(res.error.code)) {
            this.logger.warn(
              `FCM rejected token as invalid (${res.error.code}): ${res.error.message}`,
            );
            result.invalidTokens.push(token);
          } else {
            this.logger.warn(
              `FCM send failed (${res.error?.code ?? 'unknown'}): ${res.error?.message ?? 'no message'}`,
            );
            result.failedTokens.push(token);
          }
        });
      } catch (err) {
        // Whole-batch failure (network/auth): treat as transient, keep tokens.
        this.logger.error('FCM multicast batch failed', err as Error);
        result.failedTokens.push(...batch);
      }
    }

    return result;
  }
}
