import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { ScorecardAutoConfirmTask } from './scorecard-autoconfirm.task';
import { ScorecardConfirmationService } from './scorecard-confirmation.service';
import { ScorecardController } from './scorecard.controller';
import { ScorecardPdfService } from './scorecard-pdf.service';
import { ScorecardReader } from './scorecard-reader';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

/**
 * Scoring engine (spec §12, §14, §32) and the scorecard confirmation / post-
 * match flow (spec §13, §16). Append-only delivery log; all totals derived by
 * folding via {@link ScorecardReader}. Relies on the global AuthzModule for the
 * PermissionGuard; imports AuthModule for JwtAuthGuard and LiveModule to push
 * real-time updates.
 */
@Module({
  imports: [AuthModule, LiveModule],
  controllers: [ScoringController, ScorecardController],
  providers: [
    ScoringService,
    ScorecardReader,
    ScorecardConfirmationService,
    ScorecardPdfService,
    ScorecardAutoConfirmTask,
  ],
})
export class ScoringModule {}
