import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { ConsoleSmsProvider } from './console-sms-provider';
import { SMS_PROVIDER, type SmsProvider } from './sms-provider';
import { TwilioSmsProvider } from './twilio-sms-provider';

/**
 * Wires the {@link SMS_PROVIDER} token. Uses Twilio when all credentials are
 * present; otherwise falls back to the console stub (local dev).
 */
@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsProvider => {
        const sid = config.get<string>('TWILIO_ACCOUNT_SID');
        const token = config.get<string>('TWILIO_AUTH_TOKEN');
        const from = config.get<string>('TWILIO_FROM_NUMBER');

        if (sid && token && from) {
          return new TwilioSmsProvider(new Twilio(sid, token), from);
        }
        new Logger('SmsModule').warn(
          'Twilio credentials not set — using console SMS provider (OTPs logged, not sent).',
        );
        return new ConsoleSmsProvider();
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
