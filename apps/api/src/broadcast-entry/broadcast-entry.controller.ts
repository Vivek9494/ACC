import type {
  AuthUser,
  BroadcastEntryMatch,
  BroadcastEntryTournamentsResponse,
} from '@acc/types';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BroadcastEntryService } from './broadcast-entry.service';

/** ASC Broadcast (Electron) entry: scoped tournament → match picker. */
@Controller('broadcast-entry')
@UseGuards(JwtAuthGuard)
export class BroadcastEntryController {
  constructor(private readonly entry: BroadcastEntryService) {}

  @Get('tournaments')
  listTournaments(@CurrentUser() user: AuthUser): Promise<BroadcastEntryTournamentsResponse> {
    return this.entry.listTournaments(user);
  }

  @Get('tournaments/:tournamentId/matches')
  listMatches(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<BroadcastEntryMatch[]> {
    return this.entry.listMatches(user, tournamentId);
  }
}
