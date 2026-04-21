import { Controller, Get, Param } from '@nestjs/common';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('chat/:chatId')
  exportChat(@Param('chatId') chatId: string) {
    return this.exportsService.exportChat(chatId);
  }
}
