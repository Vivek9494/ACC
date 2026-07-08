import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnockoutBracketModule } from '../knockout-bracket/knockout-bracket.module';
import { MediaModule } from '../media/media.module';
import { PlayerSkillVideosModule } from '../player-videos/player-skill-videos.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { LeatherTournamentVisibilityService } from './leather-tournament-visibility.service';
import { TennisTournamentVisibilityService } from './tennis-tournament-visibility.service';
import { LeatherInvitesController } from './leather-invites.controller';
import { TournamentScorersController } from './tournament-scorers.controller';
import { TournamentScorersService } from './tournament-scorers.service';
import { TennisMatchScoringAuthService } from './tennis-match-scoring-auth.service';

/**
 * Tournament creation & management (§6, §24). Relies on the global AuthzModule
 * (permission engine, type resolver) and NotificationsModule.
 */
@Module({
  imports: [AuthModule, MediaModule, PlayerSkillVideosModule, KnockoutBracketModule],
  controllers: [TournamentsController, LeatherInvitesController, TournamentScorersController],
  providers: [
    TournamentsService,
    LeatherTournamentVisibilityService,
    TennisTournamentVisibilityService,
    TournamentScorersService,
    TennisMatchScoringAuthService,
  ],
  exports: [
    TournamentsService,
    LeatherTournamentVisibilityService,
    TennisTournamentVisibilityService,
    TournamentScorersService,
    TennisMatchScoringAuthService,
  ],
})
export class TournamentsModule {}
