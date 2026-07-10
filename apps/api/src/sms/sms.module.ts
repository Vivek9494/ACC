import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { ConsoleSmsProvider } from './console-sms-provider';
import {
  NodeEnv,
  StubbableIntegration,
  parseStubbedIntegrations,
} from '../config/env.validation';
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
        const nodeEnv = config.get<NodeEnv>('NODE_ENV', NodeEnv.Development);

        if (sid && token && from) {
          return new TwilioSmsProvider(new Twilio(sid, token), from);
        }

        const twilioStubbed = parseStubbedIntegrations(
          config.get<string>('ALLOW_STUBBED_INTEGRATIONS'),
        ).has(StubbableIntegration.Twilio);

        if (nodeEnv === NodeEnv.Production && !twilioStubbed) {
          throw new Error(
            'Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are required in production.',
          );
        }
        new Logger('SmsModule').warn(
          nodeEnv === NodeEnv.Production
            ? 'Twilio STUBBED in production (ALLOW_STUBBED_INTEGRATIONS) — OTPs logged, not sent.'
            : 'Twilio credentials not set — using console SMS provider (OTPs logged, not sent).',
        );
        return new ConsoleSmsProvider();
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
