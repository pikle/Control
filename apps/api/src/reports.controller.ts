import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('managers')
  managers(@Query('accountId') accountId: string) {
    return this.reportsService.getManagers(accountId);
  }

  @Get('manager/:botId')
  managerReport(@Query('accountId') accountId: string, @Param('botId') botId: string) {
    return this.reportsService.getManagerReport(accountId, botId);
  }
}
