import { Logger } from '@nestjs/common';

import type { SmsSender } from './sms-sender';

/**
 * Dev/test SMS sender that logs the message instead of sending it, so OTPs are
 * visible in the API console without Twilio credentials.
 */
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SmsSender');

  sendSms(to: string, body: string): Promise<void> {
    this.logger.log(`[DEV SMS] to=${to} :: ${body}`);
    return Promise.resolve();
  }
}
