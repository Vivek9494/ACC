import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CentersController } from './centers.controller';
import { CentersService } from './centers.service';
import { ProvincesController } from './provinces.controller';
import { ProvincesService } from './provinces.service';

@Module({
  imports: [AuthModule],
  controllers: [ProvincesController, CentersController],
  providers: [ProvincesService, CentersService],
  exports: [CentersService, ProvincesService],
})
export class CentersModule {}
