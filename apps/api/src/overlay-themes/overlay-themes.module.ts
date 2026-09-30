import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OverlayThemesController } from './overlay-themes.controller';
import { OverlayThemesService } from './overlay-themes.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [OverlayThemesController],
  providers: [OverlayThemesService],
})
export class OverlayThemesModule {}
