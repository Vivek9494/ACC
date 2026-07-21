import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TournamentTypeDefinitionsController } from './tournament-type-definitions.controller';
import { TournamentTypeDefinitionsService } from './tournament-type-definitions.service';

@Module({
  imports: [AuthModule],
  controllers: [TournamentTypeDefinitionsController],
  providers: [TournamentTypeDefinitionsService],
  exports: [TournamentTypeDefinitionsService],
})
export class TournamentTypeDefinitionsModule {}
