import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BroadcastEntryController } from './broadcast-entry.controller';
import { BroadcastEntryService } from './broadcast-entry.service';

@Module({
  imports: [AuthModule],
  controllers: [BroadcastEntryController],
  providers: [BroadcastEntryService],
})
export class BroadcastEntryModule {}
