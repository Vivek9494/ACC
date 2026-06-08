import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { ConsoleSmsSender } from './console-sms-sender';
import { SMS_SENDER, type SmsSender } from './sms-sender';
import { TwilioSmsSender } from './twilio-sms-sender';

/**
 * Wires the {@link SMS_SENDER} token. Uses Twilio when all credentials are
 * present; otherwise falls back to the console sender (local dev), which logs
 * the OTP instead of sending it.
 */
@Global()
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsSender => {
        const sid = config.get<string>('TWILIO_ACCOUNT_SID');
        const token = config.get<string>('TWILIO_AUTH_TOKEN');
        const from = config.get<string>('TWILIO_FROM_NUMBER');

        if (sid && token && from) {
          return new TwilioSmsSender(new Twilio(sid, token), from);
        }
        new Logger('SmsModule').warn(
          'Twilio credentials not set — using console SMS sender (OTPs logged, not sent).',
        );
        return new ConsoleSmsSender();
      },
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
