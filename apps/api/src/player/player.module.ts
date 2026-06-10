import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ScoringModule } from '../scoring/scoring.module';
import { PlayerController } from './player.controller';
import { PlayerRoleGuard } from './player-role.guard';
import { PlayerService } from './player.service';

@Module({
  imports: [AuthModule, ScoringModule],
  controllers: [PlayerController],
  providers: [PlayerService, PlayerRoleGuard],
})
export class PlayerModule {}
