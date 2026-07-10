import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

import { ConsolePushProvider } from './console-push-provider';
import {
  NodeEnv,
  StubbableIntegration,
  parseStubbedIntegrations,
} from '../config/env.validation';
import { FcmPushProvider } from './fcm-push-provider';
import { NotificationAudienceService } from './notification-audience.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationScheduler } from './notification-scheduler';
import { NotificationTimedJobsService } from './notification-timed-jobs.service';
import { NotificationsService } from './notifications.service';
import { PUSH_PROVIDER, type PushProvider } from './push-provider';
import { PushTokenController } from './push-token.controller';
import { PushTokenService } from './push-token.service';

/**
 * Push delivery (§17). Wires the {@link PUSH_PROVIDER} to Firebase Cloud
 * Messaging when service-account credentials are present; otherwise falls back
 * to the console stub (local dev). Global so any trigger can inject the shared
 * {@link NotificationsService} / {@link NotificationAudienceService}.
 */
@Global()
@Module({
  controllers: [PushTokenController],
  providers: [
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushProvider => {
        const projectId = config.get<string>('FCM_PROJECT_ID');
        const clientEmail = config.get<string>('FCM_CLIENT_EMAIL');
        const privateKeyRaw = config.get<string>('FCM_PRIVATE_KEY');
        const nodeEnv = config.get<NodeEnv>('NODE_ENV', NodeEnv.Development);

        if (projectId && clientEmail && privateKeyRaw) {
          // Env values escape newlines as \n; restore them for the PEM parser.
          const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
          const existing = getApps();
          const app =
            existing.length > 0 && existing[0]
              ? existing[0]
              : initializeApp({
                  credential: cert({ projectId, clientEmail, privateKey }),
                });
          return new FcmPushProvider(app);
        }

        const fcmStubbed = parseStubbedIntegrations(
          config.get<string>('ALLOW_STUBBED_INTEGRATIONS'),
        ).has(StubbableIntegration.Fcm);

        if (nodeEnv === NodeEnv.Production && !fcmStubbed) {
          throw new Error(
            'FCM credentials (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY) are required in production.',
          );
        }

        new Logger('NotificationsModule').warn(
          nodeEnv === NodeEnv.Production
            ? 'FCM STUBBED in production (ALLOW_STUBBED_INTEGRATIONS) — pushes logged, not sent.'
            : 'FCM credentials not set — using console push provider (pushes logged, not sent).',
        );
        return new ConsolePushProvider();
      },
    },
    PushTokenService,
    NotificationLogService,
    NotificationAudienceService,
    NotificationsService,
    NotificationTimedJobsService,
    NotificationScheduler,
  ],
  exports: [NotificationsService, NotificationAudienceService, PushTokenService],
})
export class NotificationsModule {}
