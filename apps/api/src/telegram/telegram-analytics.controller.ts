import { Controller, Get, Param } from '@nestjs/common';
import { TelegramAnalyticsService } from './telegram-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('telegram-analytics')
export class TelegramAnalyticsController {
  constructor(
    private readonly analyticsService: TelegramAnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  // Получить статистику подписчиков для всех каналов менеджеров
  @Get('channels/:accountId')
  async getChannelsStats(@Param('accountId') accountId: string) {
    return await this.analyticsService.getAllChannelsStats(accountId);
  }

  // Получить статистику подписчиков для конкретного канала
  @Get('channel/:botId')
  async getChannelStats(@Param('botId') botId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId }
    });

    if (!bot || !bot.username?.startsWith('@')) {
      return { error: 'Bot not found or no channel username' };
    }

    return await this.analyticsService.getChannelStats(
      bot.token,
      bot.username.substring(1)
    );
  }
}