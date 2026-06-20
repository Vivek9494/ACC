import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { ScorecardAutoConfirmTask } from './scorecard-autoconfirm.task';
import { ScorecardConfirmationService } from './scorecard-confirmation.service';
import { ScorecardController } from './scorecard.controller';
import { ScorecardPdfService } from './scorecard-pdf.service';
import { ScorecardDisplayBuilder } from './scorecard-display.builder';
import { ScorecardReader } from './scorecard-reader';
import { ScoringController } from './scoring.controller';
import { BatsmanPickerService } from './batsman-picker.service';
import { BowlerPickerService } from './bowler-picker.service';
import { FielderPickerService } from './fielder-picker.service';
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
    BatsmanPickerService,
    BowlerPickerService,
    FielderPickerService,
    ScorecardReader,
    ScorecardDisplayBuilder,
    ScorecardConfirmationService,
    ScorecardPdfService,
    ScorecardAutoConfirmTask,
  ],
  exports: [ScorecardReader, ScoringService],
})
export class ScoringModule {}
