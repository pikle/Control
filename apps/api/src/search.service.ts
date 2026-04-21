import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

interface GlobalSearchQuery {
  accountId: string;
  text?: string;
  username?: string;
  userId?: string;
  chatId?: string;
  date?: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(query: GlobalSearchQuery) {
    const { accountId, text, username, userId, chatId, date } = query;

    const filters: Prisma.MessageWhereInput[] = [{ accountId }];

    if (text) {
      filters.push({ text: { contains: text, mode: 'insensitive' } });
    }

    if (username) {
      filters.push({ user: { username: { contains: username, mode: 'insensitive' } } });
    }

    if (userId) {
      filters.push({ user: { telegramUserId: userId } });
    }

    if (chatId) {
      filters.push({ chat: { telegramChatId: chatId } });
    }

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filters.push({ sentAt: { gte: start, lt: end } });
    }

    const results = await this.prisma.message.findMany({
      where: { AND: filters },
      include: {
        chat: true,
        user: true,
      },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });

    return results.map((item) => ({
      messageId: item.id,
      text: item.text,
      date: item.sentAt,
      chatId: item.chat.id,
      chatTitle: item.chat.title || item.chat.telegramChatId,
      userId: item.user?.telegramUserId,
      username: item.user?.username,
      jumpTo: `/chats/${item.chat.id}?message=${item.id}`,
    }));
  }
}
