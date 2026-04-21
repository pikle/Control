import { Injectable } from '@nestjs/common';
import { CustomFieldType, Prisma, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(accountId = 'demo-account', accountName = 'Demo Account') {
    const account = await this.prisma.account.upsert({
      where: { id: accountId },
      update: { name: accountName },
      create: {
        id: accountId,
        name: accountName,
      },
    });

    await this.log(account.id, 'bootstrap', 'account', account.id, { accountName });
    return account;
  }

  async getBots() {
    return this.prisma.bot.findMany({
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBot(input: {
    accountId: string;
    name: string;
    token: string;
    webhookSecret?: string;
  }) {
    const path = createHash('sha1').update(`${input.token}:${Date.now()}`).digest('hex');
    const tokenMasked = `${input.token.slice(0, 8)}...${input.token.slice(-4)}`;

    const bot = await this.prisma.bot.create({
      data: {
        accountId: input.accountId,
        name: input.name,
        token: input.token,
        tokenMasked,
        webhookPath: path,
        webhookSecret: input.webhookSecret || process.env.DEFAULT_WEBHOOK_SECRET || 'secret',
      },
    });

    await this.log(input.accountId, 'create', 'bot', bot.id, { name: bot.name });
    return bot;
  }

  async connectBotWebhook(botId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      select: {
        id: true,
        accountId: true,
        name: true,
        token: true,
        webhookPath: true,
        webhookSecret: true,
      },
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    const origin = (process.env.WEB_APP_ORIGIN || '').replace(/\/$/, '');
    if (!origin) {
      throw new Error('WEB_APP_ORIGIN is not configured');
    }

    const webhookUrl = `${origin}/telegram/webhook/${bot.webhookPath}`;
    const telegramApiUrl = `https://api.telegram.org/bot${bot.token}/setWebhook`;

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: bot.webhookSecret,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: boolean;
    };

    await this.log(bot.accountId, 'connect_webhook', 'bot', bot.id, {
      ok: data.ok,
      description: data.description,
      webhookUrl,
    });

    return {
      ok: data.ok,
      description: data.description || (data.ok ? 'Webhook connected' : 'Telegram API error'),
      webhookUrl,
      botId: bot.id,
      botName: bot.name,
    };
  }

  async getCustomFields(accountId: string) {
    return this.prisma.customField.findMany({
      where: { accountId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCustomField(input: {
    accountId: string;
    key: string;
    label: string;
    type: 'TEXT' | 'NUMBER' | 'SELECT';
    options?: string[];
    sortOrder?: number;
    isRequired?: boolean;
  }) {
    const field = await this.prisma.customField.create({
      data: {
        accountId: input.accountId,
        key: input.key,
        label: input.label,
        type: input.type as CustomFieldType,
        options: input.options || [],
        sortOrder: input.sortOrder || 0,
        isRequired: input.isRequired || false,
      },
    });

    await this.log(input.accountId, 'create', 'custom_field', field.id, {
      key: field.key,
      type: field.type,
    });

    return field;
  }

  async updateCustomField(
    fieldId: string,
    input: {
      label?: string;
      type?: 'TEXT' | 'NUMBER' | 'SELECT';
      options?: string[];
      sortOrder?: number;
      isRequired?: boolean;
    },
  ) {
    const field = await this.prisma.customField.update({
      where: { id: fieldId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.type !== undefined ? { type: input.type as CustomFieldType } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
      },
    });

    await this.log(field.accountId, 'update', 'custom_field', field.id, input);
    return field;
  }

  async deleteCustomField(fieldId: string) {
    const field = await this.prisma.customField.delete({
      where: { id: fieldId },
    });

    await this.log(field.accountId, 'delete', 'custom_field', field.id, {
      key: field.key,
    });

    return { ok: true };
  }

  async setCustomFieldValue(input: {
    accountId: string;
    customFieldId: string;
    chatId: string;
    valueText?: string;
    valueNumber?: number;
  }) {
    const value = await this.prisma.customFieldValue.upsert({
      where: {
        customFieldId_chatId: {
          customFieldId: input.customFieldId,
          chatId: input.chatId,
        },
      },
      update: {
        valueText: input.valueText,
        valueNumber: input.valueNumber,
      },
      create: {
        accountId: input.accountId,
        customFieldId: input.customFieldId,
        chatId: input.chatId,
        valueText: input.valueText,
        valueNumber: input.valueNumber,
      },
    });

    await this.log(input.accountId, 'update', 'custom_field_value', value.id, {
      customFieldId: input.customFieldId,
      chatId: input.chatId,
    });

    return value;
  }

  async getUsers(accountId: string) {
    return this.prisma.user.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        telegramUserId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  async setUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await this.log(user.accountId, 'update', 'user_role', user.id, { role });
    return user;
  }

  async getLogs(accountId: string) {
    return this.prisma.actionLog.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async log(
    accountId: string,
    action: string,
    entityType: string,
    entityId?: string,
    payload?: Record<string, unknown>,
  ) {
    await this.prisma.actionLog.create({
      data: {
        accountId,
        action,
        entityType,
        entityId,
        payload: (payload || undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
