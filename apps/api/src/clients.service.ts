import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(accountId: string, q?: string) {
    if (!accountId) return [];

    const chats = await this.prisma.chat.findMany({
      where: {
        accountId,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { username: { contains: q, mode: 'insensitive' } },
                { telegramChatId: { contains: q, mode: 'insensitive' } },
                { clientProfile: { displayName: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        bot: true,
        analysis: true,
        clientProfile: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((chat) => ({
      chatId: chat.id,
      displayName: chat.clientProfile?.displayName || chat.title || chat.username || chat.telegramChatId,
      username: chat.username,
      telegramChatId: chat.telegramChatId,
      manager: chat.bot?.name || 'Не назначен',
      qualityScore: chat.analysis?.qualityScore || 0,
      hasCritical: ((chat.analysis?.qualityIssues as Array<{ level?: string }> | null) || []).some((i) => i.level === 'CRITICAL'),
      isArchived: chat.isArchived,
      archiveReason: chat.archiveReason,
      lastMessageAt: chat.lastMessageAt,
    }));
  }

  async details(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        bot: true,
        analysis: true,
        clientProfile: true,
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 50,
          include: { user: true },
        },
      },
    });

    if (!chat) return null;

    return {
      chat,
      analysis: chat.analysis,
      clientProfile: chat.clientProfile,
      manager: chat.bot,
      recentMessages: chat.messages,
    };
  }
}
