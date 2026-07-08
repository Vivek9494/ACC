import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PlayerStatsModule } from '../player-stats/player-stats.module';
import { SmsModule } from '../sms/sms.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule, MediaModule, PlayerStatsModule, SmsModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
