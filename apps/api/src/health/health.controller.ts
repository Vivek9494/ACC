import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { HealthService, type HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthStatus> {
    const status = await this.healthService.check();
    this.healthService.assertHealthy(status);
    return status;
  }
}
