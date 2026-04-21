import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook/:webhookPath')
  async handleWebhook(
    @Param('webhookPath') webhookPath: string,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.telegramService.processWebhook(webhookPath, secretToken, payload);
  }
}
