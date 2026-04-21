import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  private extractIdsFromMetadata(metadata: unknown): { chatId?: string; fromId?: string } {
    if (!metadata || typeof metadata !== 'object') return {};
    const data = metadata as { chat?: { id?: unknown }; from?: { id?: unknown } };
    return {
      chatId: data.chat?.id !== undefined ? String(data.chat.id) : undefined,
      fromId: data.from?.id !== undefined ? String(data.from.id) : undefined,
    };
  }

  async getOverview(accountId: string) {
    if (!accountId) {
      return {
        managersCount: 0,
        activeChatsCount: 0,
        unansweredChatsCount: 0,
      };
    }

    const [managersCount, activeChatsCount, chatsWithLatestMessage] = await Promise.all([
      this.prisma.bot.count({ where: { accountId, isActive: true } }),
      this.prisma.chat.count({ where: { accountId, lastMessageAt: { not: null } } }),
      this.prisma.chat.findMany({
        where: { accountId, lastMessageAt: { not: null } },
        select: {
          id: true,
          telegramChatId: true,
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: {
              metadata: true,
            },
          },
        },
      }),
    ]);

    const unansweredChatsCount = chatsWithLatestMessage.filter((chat) => {
      const latest = chat.messages[0];
      if (!latest) return false;

      const ids = this.extractIdsFromMetadata(latest.metadata);
      const chatId = ids.chatId || chat.telegramChatId;
      const fromId = ids.fromId;

      // Chat is unanswered if the latest message came from the client.
      return !fromId || fromId === chatId;
    }).length;

    return {
      managersCount,
      activeChatsCount,
      unansweredChatsCount,
    };
  }
}
