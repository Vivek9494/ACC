import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { VideoStorageModule } from '../video-storage/video-storage.module';
import { PlayerSkillVideosController } from './player-skill-videos.controller';
import { PlayerSkillVideosService } from './player-skill-videos.service';

@Module({
  imports: [AuthModule, VideoStorageModule],
  controllers: [PlayerSkillVideosController],
  providers: [PlayerSkillVideosService],
  exports: [PlayerSkillVideosService],
})
export class PlayerSkillVideosModule {}
