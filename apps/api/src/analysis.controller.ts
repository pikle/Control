import { Controller, Get, Query } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('run')
  run(@Query('accountId') accountId: string, @Query('managerBotId') managerBotId?: string) {
    return this.analysisService.runAnalysis(accountId, managerBotId);
  }
}
