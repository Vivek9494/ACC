import type { PlayerDashboard, ScorerStartableMatch } from '@acc/types';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PlayerRoleGuard } from './player-role.guard';
import { PlayerService } from './player.service';

@Controller('player')
@UseGuards(JwtAuthGuard, PlayerRoleGuard)
export class PlayerController {
  constructor(private readonly player: PlayerService) {}

  @Get('dashboard')
  dashboard(@Req() req: AuthenticatedRequest): Promise<PlayerDashboard> {
    return this.player.getDashboard(req.user);
  }

  @Get('scorer-match')
  scorerMatch(@Req() req: AuthenticatedRequest): Promise<ScorerStartableMatch | null> {
    return this.player.getScorerMatch(req.user.id);
  }
}
