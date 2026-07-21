import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TournamentTypeDefinitionsController } from './tournament-type-definitions.controller';
import { TournamentTypeDefinitionsService } from './tournament-type-definitions.service';
import { TournamentTypesCatalogController } from './tournament-types-catalog.controller';

@Module({
  imports: [AuthModule],
  controllers: [TournamentTypeDefinitionsController, TournamentTypesCatalogController],
  providers: [TournamentTypeDefinitionsService],
  exports: [TournamentTypeDefinitionsService],
})
export class TournamentTypeDefinitionsModule {}
