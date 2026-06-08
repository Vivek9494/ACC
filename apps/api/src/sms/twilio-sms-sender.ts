import { Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

import type { SmsSender } from './sms-sender';

/** Twilio-backed SMS sender (stack §29). Numbers must be Canadian +1 (E.164). */
export class TwilioSmsSender implements SmsSender {
  private readonly logger = new Logger('SmsSender');

  constructor(
    private readonly client: Twilio,
    private readonly fromNumber: string,
  ) {}

  async sendSms(to: string, body: string): Promise<void> {
    await this.client.messages.create({ to, from: this.fromNumber, body });
    this.logger.log(`Sent SMS via Twilio to ${to}`);
  }
}
