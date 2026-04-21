import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('overview')
  overview(@Query('accountId') accountId: string) {
    return this.metricsService.getOverview(accountId);
  }
}
