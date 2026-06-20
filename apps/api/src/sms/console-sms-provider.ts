import { Logger } from '@nestjs/common';

import type { SmsProvider } from './sms-provider';

/**
 * Dev/test OTP sender — logs the code to the API console so the forgot-password
 * flow is testable without a real SMS provider. Never used in production builds
 * when Twilio credentials are configured.
 */
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SmsProvider');

  sendOtp(e164Number: string, code: string): Promise<void> {
    this.logger.log(`[DEV OTP] to=${e164Number} code=${code}`);
    return Promise.resolve();
  }
}
