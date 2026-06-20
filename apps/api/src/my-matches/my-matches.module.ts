import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MyMatchesController } from './my-matches.controller';
import { MyMatchesService } from './my-matches.service';

@Module({
  imports: [AuthModule, ScoringModule],
  controllers: [MyMatchesController],
  providers: [MyMatchesService],
})
export class MyMatchesModule {}
