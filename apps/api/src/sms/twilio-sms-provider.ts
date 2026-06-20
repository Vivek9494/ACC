import type { Twilio } from 'twilio';

import type { SmsProvider } from './sms-provider';

/** Production Twilio adapter for password-reset and profile OTP delivery. */
export class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly client: Twilio,
    private readonly fromNumber: string,
  ) {}

  async sendOtp(e164Number: string, code: string): Promise<void> {
    await this.client.messages.create({
      to: e164Number,
      from: this.fromNumber,
      body: `Your ACC verification code is ${code}. It expires in 5 minutes.`,
    });
  }
}
