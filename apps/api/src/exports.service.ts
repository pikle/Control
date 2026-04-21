import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportChat(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          include: {
            user: true,
            attachments: true,
            reactions: true,
          },
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return { chatId, messages: [] };
    }

    return {
      chat: {
        id: chat.id,
        telegramChatId: chat.telegramChatId,
        title: chat.title,
      },
      exportedAt: new Date().toISOString(),
      messages: chat.messages.map((message) => ({
        messageId: message.telegramMessageId,
        user: message.user
          ? {
              telegramUserId: message.user.telegramUserId,
              username: message.user.username,
            }
          : null,
        text: message.text,
        type: message.messageType,
        sentAt: message.sentAt,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
        attachments: message.attachments,
        reactions: message.reactions,
      })),
    };
  }
}
