import { BallType, type BroadcastPlayerStatsView } from '@acc/types';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { BroadcastPlayerStatsQueryDto } from './dto/broadcast-player-stats-query.dto';
import { PlayerStatsService } from './player-stats.service';

/**
 * Guest-readable career summary for OBS player cards.
 * Reuses {@link PlayerStatsService.buildCareerStats}; exposes only broadcast fields.
 */
@Controller('broadcast/players')
export class BroadcastPlayerStatsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerStats: PlayerStatsService,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  @Get(':userId/stats')
  @Public()
  async getStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: BroadcastPlayerStatsQueryDto,
  ): Promise<BroadcastPlayerStatsView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        deletedAt: true,
        isActive: true,
      },
    });
    if (!user || user.deletedAt != null || !user.isActive) {
      throw new NotFoundException({
        message: 'Player not found',
        error: 'NOT_FOUND',
      });
    }

    const ballType = query.ballType ?? BallType.Tennis;
    const { career } = await this.playerStats.buildCareerStats(userId, ballType);

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhotoUrl: await this.mediaUrls.resolveReadUrl(user.profilePhotoUrl),
      ballType,
      matches: career.matches,
      runs: career.runs,
      average: career.average,
      strikeRate: career.strikeRate,
      highestScore: career.highestScore,
      wickets: career.wickets,
      bowlingAverage: career.bowlingAverage,
      economy: career.economy,
      bestBowling: career.bestBowling,
    };
  }
}
