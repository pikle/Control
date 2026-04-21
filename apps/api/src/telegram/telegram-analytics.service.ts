import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Получить статистику подписчиков для канала менеджера
  async getChannelStats(botToken: string, channelUsername: string) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: `@${channelUsername}` })
      });

      const data = await response.json();

      if (data.ok) {
        return {
          subscriberCount: data.result,
          channelUsername,
          lastUpdated: new Date()
        };
      }

      return { error: data.description };
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Получить статистику для всех каналов менеджеров
  async getAllChannelsStats(accountId: string) {
    const bots = await this.prisma.bot.findMany({
      where: { accountId, isActive: true },
      include: { chats: true }
    });

    const stats = [];

    for (const bot of bots) {
      // Если у бота есть канал (username начинается с @)
      if (bot.username && bot.username.startsWith('@')) {
        const channelStats = await this.getChannelStats(bot.token, bot.username.substring(1));
        stats.push({
          managerId: bot.id,
          managerName: bot.name,
          channelUsername: bot.username,
          ...channelStats
        });
      }
    }

    return stats;
  }

  // Получить количество участников в группах (не каналах)
  async getGroupMembers(botToken: string, chatId: string) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMembersCount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
      });

      const data = await response.json();

      if (data.ok) {
        return { memberCount: data.result };
      }

      return { error: data.description };
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}