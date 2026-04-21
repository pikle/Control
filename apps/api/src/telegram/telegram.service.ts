import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramService {
  constructor(private readonly prisma: PrismaService) {}

  async processWebhook(
    webhookPath: string,
    secretToken: string,
    payload: Record<string, unknown>,
  ) {
    const bot = await this.prisma.bot.findUnique({
      where: { webhookPath },
    });

    if (!bot || !bot.isActive) {
      throw new BadRequestException('Bot not found or inactive');
    }

    if (bot.webhookSecret !== secretToken) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const message = (payload.message ||
      payload.edited_message ||
      payload.business_message ||
      payload.edited_business_message) as Record<string, unknown> | undefined;
    const deletedMessage =
      (payload.deleted_message as Record<string, unknown> | undefined) ||
      (payload.deleted_business_messages as Record<string, unknown> | undefined);
    const reaction =
      (payload.message_reaction as Record<string, unknown> | undefined) ||
      (payload.business_message_reaction as Record<string, unknown> | undefined);

    if (message) {
      await this.handleMessageEvent(bot.id, bot.accountId, payload, message);
    }

    if (deletedMessage) {
      await this.handleDeletedEvent(bot.accountId, deletedMessage);
    }

    if (reaction) {
      await this.handleReactionEvent(bot.accountId, reaction);
    }

    await this.prisma.bot.update({
      where: { id: bot.id },
      data: { lastActivityAt: new Date() },
    });

    return { ok: true };
  }

  private detectMessageType(message: Record<string, unknown>): MessageType {
    if (typeof message.text === 'string') return MessageType.TEXT;
    if (message.photo) return MessageType.PHOTO;
    if (message.video) return MessageType.VIDEO;
    if (message.audio) return MessageType.AUDIO;
    if (message.document) return MessageType.DOCUMENT;
    if (message.sticker) return MessageType.STICKER;
    if (message.location) return MessageType.LOCATION;
    if (message.contact) return MessageType.CONTACT;
    if (message.new_chat_members || message.left_chat_member) return MessageType.SERVICE;
    return MessageType.OTHER;
  }

  private async handleMessageEvent(
    botId: string,
    accountId: string,
    payload: Record<string, unknown>,
    message: Record<string, unknown>,
  ) {
    const rawChat = (message.chat || {}) as Record<string, unknown>;
    const rawUser = (message.from || {}) as Record<string, unknown>;
    const telegramChatId = String(rawChat.id || '');
    const telegramUserId = String(rawUser.id || '');

    if (!telegramChatId) {
      throw new BadRequestException('Missing chat id');
    }

    const chat = await this.prisma.chat.upsert({
      where: {
        accountId_telegramChatId: {
          accountId,
          telegramChatId,
        },
      },
      update: {
        botId,
        title: (rawChat.title as string | undefined) || null,
        username: (rawChat.username as string | undefined) || null,
        type: (rawChat.type as string | undefined) || null,
        lastMessageAt: new Date(),
      },
      create: {
        accountId,
        botId,
        telegramChatId,
        title: (rawChat.title as string | undefined) || null,
        username: (rawChat.username as string | undefined) || null,
        type: (rawChat.type as string | undefined) || null,
        lastMessageAt: new Date(),
      },
    });

    let userId: string | undefined;

    if (telegramUserId) {
      const user = await this.prisma.user.upsert({
        where: {
          accountId_telegramUserId: {
            accountId,
            telegramUserId,
          },
        },
        update: {
          username: (rawUser.username as string | undefined) || null,
          firstName: (rawUser.first_name as string | undefined) || null,
          lastName: (rawUser.last_name as string | undefined) || null,
          chatId: chat.id,
        },
        create: {
          accountId,
          telegramUserId,
          username: (rawUser.username as string | undefined) || null,
          firstName: (rawUser.first_name as string | undefined) || null,
          lastName: (rawUser.last_name as string | undefined) || null,
          chatId: chat.id,
        },
      });
      userId = user.id;
    }

    const isEdited = Boolean(payload.edited_message || payload.edited_business_message);
    const isBusiness = Boolean(payload.business_message || payload.edited_business_message);
    const eventType = isEdited
      ? isBusiness
        ? 'business_message_edited'
        : 'message_edited'
      : isBusiness
        ? 'business_message_new'
        : 'message_new';
    const telegramMessageId = String(message.message_id);
    const sentAt = message.date
      ? new Date(Number(message.date) * 1000)
      : new Date();

    const messageRecord = await this.prisma.message.upsert({
      where: {
        chatId_telegramMessageId: {
          chatId: chat.id,
          telegramMessageId,
        },
      },
      update: {
        text: (message.text as string | undefined) || (message.caption as string | undefined) || null,
        isEdited,
        editedAt: isEdited ? new Date() : null,
        messageType: this.detectMessageType(message),
        eventType,
        metadata: message as Prisma.JsonObject,
      },
      create: {
        accountId,
        chatId: chat.id,
        userId,
        telegramMessageId,
        replyToMessageId: message.reply_to_message
          ? String((message.reply_to_message as Record<string, unknown>).message_id)
          : null,
        text: (message.text as string | undefined) || (message.caption as string | undefined) || null,
        messageType: this.detectMessageType(message),
        eventType,
        sentAt,
        isEdited,
        editedAt: isEdited ? new Date() : null,
        metadata: message as Prisma.JsonObject,
      },
    });

    await this.saveAttachments(messageRecord.id, message);
  }

  private async saveAttachments(messageId: string, message: Record<string, unknown>) {
    const attachments: Prisma.AttachmentCreateManyInput[] = [];

    if (Array.isArray(message.photo)) {
      const biggest = message.photo[message.photo.length - 1] as Record<string, unknown>;
      attachments.push({
        messageId,
        telegramFileId: (biggest.file_id as string | undefined) || null,
        mimeType: 'image/jpeg',
        size: (biggest.file_size as number | undefined) || null,
        metadata: biggest as Prisma.JsonObject,
      });
    }

    if (message.document) {
      const doc = message.document as Record<string, unknown>;
      attachments.push({
        messageId,
        telegramFileId: (doc.file_id as string | undefined) || null,
        fileName: (doc.file_name as string | undefined) || null,
        mimeType: (doc.mime_type as string | undefined) || null,
        size: (doc.file_size as number | undefined) || null,
        metadata: doc as Prisma.JsonObject,
      });
    }

    if (message.video) {
      const video = message.video as Record<string, unknown>;
      attachments.push({
        messageId,
        telegramFileId: (video.file_id as string | undefined) || null,
        mimeType: (video.mime_type as string | undefined) || 'video/mp4',
        size: (video.file_size as number | undefined) || null,
        metadata: video as Prisma.JsonObject,
      });
    }

    if (attachments.length) {
      await this.prisma.attachment.deleteMany({ where: { messageId } });
      await this.prisma.attachment.createMany({ data: attachments });
    }
  }

  private async handleDeletedEvent(accountId: string, event: Record<string, unknown>) {
    const deletedChat = (event.chat || {}) as Record<string, unknown>;
    const chatIdRaw = String(deletedChat.id || '');
    const messageIdRaw = String(event.message_id || '');
    const messageIds = Array.isArray(event.message_ids)
      ? event.message_ids.map((id) => String(id))
      : messageIdRaw
        ? [messageIdRaw]
        : [];

    if (!chatIdRaw || !messageIds.length) return;

    const chat = await this.prisma.chat.findUnique({
      where: {
        accountId_telegramChatId: {
          accountId,
          telegramChatId: chatIdRaw,
        },
      },
    });

    if (!chat) return;

    await this.prisma.message.updateMany({
      where: {
        chatId: chat.id,
        telegramMessageId: { in: messageIds },
      },
      data: {
        deletedAt: new Date(),
        eventType: Array.isArray(event.message_ids) ? 'business_message_deleted' : 'message_deleted',
      },
    });
  }

  private async handleReactionEvent(accountId: string, event: Record<string, unknown>) {
    const chatRaw = (event.chat || {}) as Record<string, unknown>;
    const telegramChatId = String(chatRaw.id || '');
    const telegramMessageId = String(event.message_id || '');

    if (!telegramChatId || !telegramMessageId) return;

    const chat = await this.prisma.chat.findUnique({
      where: {
        accountId_telegramChatId: {
          accountId,
          telegramChatId,
        },
      },
    });

    if (!chat) return;

    const message = await this.prisma.message.findUnique({
      where: {
        chatId_telegramMessageId: {
          chatId: chat.id,
          telegramMessageId,
        },
      },
    });

    if (!message) return;

    const reactions = (event.new_reaction as Array<Record<string, unknown>> | undefined) || [];

    await this.prisma.reaction.deleteMany({ where: { messageId: message.id } });

    if (reactions.length) {
      await this.prisma.reaction.createMany({
        data: reactions.map((reaction) => ({
          messageId: message.id,
          emoji: (reaction.emoji as string | undefined) || '👍',
          count: 1,
          users: [event.user_id] as Prisma.JsonArray,
        })),
      });
    }

    await this.prisma.message.update({
      where: { id: message.id },
      data: { eventType: 'message_reaction' },
    });
  }
}
