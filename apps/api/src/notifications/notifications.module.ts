import { Global, Module } from '@nestjs/common';

import { NotificationsService } from './notifications.service';

/** FCM push delivery (§17). Stubbed until Phase 6; global for convenience. */
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
