import { Logger } from '@nestjs/common';

import type { PushMessage, PushProvider, PushSendResult } from './push-provider';

/**
 * Dev stub used when FCM credentials are absent: logs the push instead of
 * sending. Treats every token as a success so local flows remain observable.
 */
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger(ConsolePushProvider.name);

  async sendToTokens(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    this.logger.log(
      `[push] "${message.title}" — ${message.body} → ${tokens.length} token(s)` +
        (message.data ? ` ${JSON.stringify(message.data)}` : ''),
    );
    await Promise.resolve();
    return {
      successTokens: [...tokens],
      invalidTokens: [],
      failedTokens: [],
    };
  }
}
