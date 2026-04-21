import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  private extractIdsFromMetadata(metadata: unknown): { chatId?: string; fromId?: string } {
    if (!metadata || typeof metadata !== 'object') return {};
    const data = metadata as { chat?: { id?: unknown }; from?: { id?: unknown } };
    return {
      chatId: data.chat?.id !== undefined ? String(data.chat.id) : undefined,
      fromId: data.from?.id !== undefined ? String(data.from.id) : undefined,
    };
  }

  async getChats(accountId: string, q?: string, managerBotId?: string) {
    if (!accountId) return [];

    const accountBots = await this.prisma.bot.findMany({
      where: { accountId, isActive: true },
      select: { id: true },
    });

    const allowLegacyNullBot =
      Boolean(managerBotId) && managerBotId !== 'all' && accountBots.length === 1 && accountBots[0].id === managerBotId;

    const filters: Prisma.ChatWhereInput[] = [{ accountId }];

    if (managerBotId && managerBotId !== 'all') {
      filters.push({
        OR: allowLegacyNullBot
          ? [{ botId: managerBotId }, { botId: null }]
          : [{ botId: managerBotId }],
      });
    }

    if (q) {
      filters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
          { telegramChatId: { contains: q, mode: 'insensitive' } },
          {
            messages: {
              some: {
                text: { contains: q, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    return this.prisma.chat.findMany({
      where: { AND: filters },
      include: {
        bot: true,
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        notes: {
          where: {
            targetType: 'CHAT',
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            text: true,
          },
        },
        _count: {
          select: {
            notes: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(chatId: string, limit: number) {
    return this.prisma.message.findMany({
      where: { chatId },
      include: {
        user: true,
        attachments: true,
        reactions: true,
        notes: true,
      },
      orderBy: { sentAt: 'asc' },
      take: Math.max(1, Math.min(limit, 500)),
    });
  }

  async getSidebar(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        bot: true,
        users: true,
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 20,
          include: {
            user: true,
          },
        },
        customFieldValues: {
          include: {
            customField: true,
          },
          orderBy: {
            customField: { sortOrder: 'asc' },
          },
        },
      },
    });

    if (!chat) return null;

    const fallbackBot =
      chat.bot ||
      (await this.prisma.bot.findFirst({
        where: { accountId: chat.accountId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }));

    const metadataIds = chat.messages
      .map((message) => this.extractIdsFromMetadata(message.metadata))
      .find((ids) => ids.chatId && ids.fromId);

    const chatTelegramId = chat.telegramChatId;
    const clientTelegramId = metadataIds?.chatId || chatTelegramId;
    const managerTelegramId = metadataIds?.fromId && metadataIds.fromId !== clientTelegramId ? metadataIds.fromId : undefined;

    const managerFromMessages = managerTelegramId
      ? chat.users.find((item) => item.telegramUserId === managerTelegramId) || null
      : chat.users.find((item) => item.role === UserRole.MANAGER) || null;

    const manager =
      managerFromMessages ||
      (fallbackBot
        ? {
            id: `bot:${fallbackBot.id}`,
            accountId: chat.accountId,
            telegramUserId: `bot:${fallbackBot.id}`,
            username: null,
            firstName: fallbackBot.name,
            lastName: null,
            role: UserRole.MANAGER,
            createdAt: fallbackBot.createdAt,
            updatedAt: fallbackBot.updatedAt,
            chatId: chat.id,
          }
        : null);

    const client =
      chat.users.find((item) => item.telegramUserId === clientTelegramId) ||
      (chat.username
        ? {
            id: `client:${chat.id}`,
            accountId: chat.accountId,
            telegramUserId: chat.telegramChatId,
            username: chat.username,
            firstName: chat.title || chat.username,
            lastName: null,
            role: UserRole.VIEWER,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            chatId: chat.id,
          }
        : null);

    const [chatNotes, managerNotes, clientNotes] = await Promise.all([
      this.prisma.note.findMany({
        where: {
          accountId: chat.accountId,
          targetType: 'CHAT',
          targetId: chat.id,
        },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      manager
        ? this.prisma.note.findMany({
            where: {
              accountId: chat.accountId,
              targetType: 'USER',
              targetId: manager.id,
            },
            include: { author: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      client
        ? this.prisma.note.findMany({
            where: {
              accountId: chat.accountId,
              targetType: 'USER',
              targetId: client.id,
            },
            include: { author: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    return {
      ...chat,
      manager,
      client,
      notes: chatNotes,
      managerNotes,
      clientNotes,
    };
  }
}
