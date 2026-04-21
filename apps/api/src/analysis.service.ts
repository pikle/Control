import { Injectable } from '@nestjs/common';
import { Chat, Message } from '@prisma/client';
import Groq from 'groq-sdk';
import { PrismaService } from './prisma/prisma.service';

type TopicRule = {
  key: string;
  title: string;
  keywords: string[];
};

type QualityIssue = {
  level: 'CRITICAL' | 'WARN';
  code: string;
  text: string;
};

const TOPIC_RULES: TopicRule[] = [
  { key: 'hobby', title: 'Хобби/увлечения', keywords: ['хобби', 'увлеч', 'интерес', 'свободное время'] },
  { key: 'evening', title: 'Как проводит вечера/выходные', keywords: ['вечер', 'выходн', 'после работы'] },
  { key: 'relations', title: 'Отношения/брак/дети', keywords: ['отношен', 'женат', 'брак', 'дети', 'развод'] },
  { key: 'pets', title: 'Питомцы', keywords: ['питом', 'кошка', 'кот', 'собак'] },
  { key: 'movies', title: 'Фильмы/сериалы', keywords: ['фильм', 'сериал', 'кино'] },
  { key: 'cuisine', title: 'Кухня/еда/готовка', keywords: ['кухн', 'блюд', 'готов', 'еда'] },
  { key: 'travel', title: 'Путешествия', keywords: ['путеше', 'поездк', 'страна', 'город'] },
  { key: 'habits', title: 'Вредные привычки', keywords: ['привычк', 'кур', 'алкогол'] },
  { key: 'dreams', title: 'Мечты/страхи', keywords: ['мечт', 'страх'] },
  { key: 'finance', title: 'Финансы/кредиты', keywords: ['финанс', 'кредит', 'долг', 'зарплат'] },
  { key: 'family', title: 'Семья/детство', keywords: ['семь', 'детств', 'родит'] },
  { key: 'work', title: 'Образование/работа', keywords: ['образован', 'работ', 'професс'] },
];

@Injectable()
export class AnalysisService {
  private readonly groqClient: Groq | null;

  constructor(private readonly prisma: PrismaService) {
    const key = process.env.GROQ_API_KEY;
    this.groqClient = key ? new Groq({ apiKey: key }) : null;
  }

  private extractIdsFromMetadata(metadata: unknown): { chatId?: string; fromId?: string } {
    if (!metadata || typeof metadata !== 'object') return {};
    const data = metadata as { chat?: { id?: unknown }; from?: { id?: unknown } };
    return {
      chatId: data.chat?.id !== undefined ? String(data.chat.id) : undefined,
      fromId: data.from?.id !== undefined ? String(data.from.id) : undefined,
    };
  }

  private isIncoming(message: Message, chatTelegramId: string): boolean {
    const ids = this.extractIdsFromMetadata(message.metadata);
    if (ids.chatId && ids.fromId) return ids.chatId === ids.fromId;
    return true;
  }

  private toSeconds(ms: number): number {
    return Math.max(0, Math.round(ms / 1000));
  }

  private findTopics(messages: Message[]): string[] {
    const text = messages
      .map((m) => (m.text || '').toLowerCase())
      .join(' ');

    return TOPIC_RULES.filter((rule) =>
      rule.keywords.some((kw) => text.includes(kw.toLowerCase())),
    ).map((rule) => rule.title);
  }

  private getQualityIssues(input: {
    avgResponseTimeSec: number | null;
    topicsCount: number;
    eveningMsgCount: number;
    managerMessagesCount: number;
  }): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (input.managerMessagesCount === 0) {
      issues.push({
        level: 'CRITICAL',
        code: 'NO_MANAGER_MESSAGES',
        text: 'Менеджер не ведет диалог: нет сообщений от менеджера.',
      });
      return issues;
    }

    if (!input.avgResponseTimeSec || input.avgResponseTimeSec > 3600) {
      issues.push({
        level: 'CRITICAL',
        code: 'SLOW_RESPONSE',
        text: 'Слишком долгие ответы менеджера (в среднем более часа).',
      });
    } else if (input.avgResponseTimeSec > 1200) {
      issues.push({
        level: 'WARN',
        code: 'MEDIUM_RESPONSE',
        text: 'Ответы менеджера замедлены (в среднем более 20 минут).',
      });
    }

    if (input.topicsCount < 3) {
      issues.push({
        level: 'CRITICAL',
        code: 'LOW_TOPIC_COVERAGE',
        text: 'Слабое раскрытие тем: обсуждено менее 3 ключевых тем.',
      });
    } else if (input.topicsCount < 5) {
      issues.push({
        level: 'WARN',
        code: 'MID_TOPIC_COVERAGE',
        text: 'Есть запас по раскрытию тем: обсуждено менее 5 тем.',
      });
    }

    if (input.eveningMsgCount === 0) {
      issues.push({
        level: 'WARN',
        code: 'NO_EVENING_ACTIVITY',
        text: 'Нет вечерней активности (18:00-23:59).',
      });
    }

    return issues;
  }

  private parseBool(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    return null;
  }

  private async aiExtractProfile(messages: Message[]) {
    if (!this.groqClient) return null;

    const transcript = messages
      .slice(-80)
      .map((m) => m.text || '')
      .filter(Boolean)
      .join('\n');

    if (!transcript.trim()) return null;

    const prompt = [
      'Извлеки профиль клиента из диалога. Верни только JSON без markdown.',
      'Поля: displayName, hobbies[], hometown, maritalStatus, hasKids, hasPets, favoriteCuisine, canCook, favoriteMovies[], travelPlaces[], education, currentJob, badHabits[], dreams, fears, financialInfo.',
      'Если данных нет, ставь null или пустой массив.',
      'Диалог:',
      transcript,
    ].join('\n');

    try {
      const result = await this.groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = result.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async aiQualitySummary(messages: Message[], topics: string[], avgResponseTimeSec: number | null, issues: QualityIssue[]) {
    if (!this.groqClient) return null;

    const transcript = messages
      .slice(-120)
      .map((m) => m.text || '')
      .filter(Boolean)
      .join('\n');

    const prompt = [
      'Оцени качество диалога менеджера с клиентом. Верни только JSON без markdown.',
      'Поля: score(0-100), summary, misses[] (строки с проблемами), strengths[] (строки с плюсами).',
      `Темы: ${topics.join(', ') || 'нет'}`,
      `Среднее время ответа: ${avgResponseTimeSec ?? 'нет данных'} сек`,
      `Базовые проблемы: ${issues.map((i) => i.text).join(' | ') || 'нет'}`,
      'Диалог:',
      transcript,
    ].join('\n');

    try {
      const result = await this.groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = result.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async runAnalysis(accountId: string, managerBotId?: string) {
    if (!accountId) return { processed: 0 };

    const chats = await this.prisma.chat.findMany({
      where: {
        accountId,
        ...(managerBotId && managerBotId !== 'all' ? { botId: managerBotId } : {}),
      },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    let processed = 0;
    for (const chat of chats) {
      await this.analyzeChat(chat);
      processed += 1;
    }

    return { processed };
  }

  private async analyzeChat(chat: Chat & { messages: Message[] }) {
    const chatTelegramId = chat.telegramChatId;
    const messages = chat.messages;

    const videoNotesCount = messages.filter((m) => m.messageType === 'VIDEO').length;
    const photosCount = messages.filter((m) => m.messageType === 'PHOTO').length;
    const voiceCount = messages.filter((m) => m.messageType === 'AUDIO').length;

    const eveningMsgCount = messages.filter((m) => {
      const h = new Date(m.sentAt).getHours();
      return h >= 18 && h <= 23;
    }).length;

    let managerMessagesCount = 0;
    const responseSamples: number[] = [];
    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      const incoming = this.isIncoming(msg, chatTelegramId);
      if (!incoming) managerMessagesCount += 1;

      if (!incoming) continue;
      const nextManagerReply = messages.slice(i + 1).find((candidate) => !this.isIncoming(candidate, chatTelegramId));
      if (!nextManagerReply) continue;
      responseSamples.push(this.toSeconds(new Date(nextManagerReply.sentAt).getTime() - new Date(msg.sentAt).getTime()));
    }

    const avgResponseTimeSec = responseSamples.length
      ? responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length
      : null;

    const topicsCovered = this.findTopics(messages);
    const issues = this.getQualityIssues({
      avgResponseTimeSec,
      topicsCount: topicsCovered.length,
      eveningMsgCount,
      managerMessagesCount,
    });

    const qualityScore = Math.max(
      0,
      100 - issues.reduce((sum, issue) => sum + (issue.level === 'CRITICAL' ? 25 : 10), 0),
    );

    const now = new Date();
    const lastActive = chat.lastMessageAt ? new Date(chat.lastMessageAt) : null;
    const noActivity24h =
      Boolean(lastActive) && now.getTime() - (lastActive as Date).getTime() > 24 * 60 * 60 * 1000;

    const hasDeleted = messages.some((m) => Boolean(m.deletedAt) || m.eventType.includes('deleted'));

    const isArchived = noActivity24h || hasDeleted;
    const archiveReason = hasDeleted ? 'messages_deleted' : noActivity24h ? 'no_activity_24h' : null;

    const createdDay = new Date(chat.createdAt);
    createdDay.setHours(0, 0, 0, 0);
    const nextDayStart = new Date(createdDay);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    const dayAfterStart = new Date(createdDay);
    dayAfterStart.setDate(dayAfterStart.getDate() + 2);

    const newChatsNextDay = messages.some((m) => {
      const sent = new Date(m.sentAt);
      return sent >= nextDayStart && sent < dayAfterStart;
    });

    const aiProfile = await this.aiExtractProfile(messages);
    const aiQuality = await this.aiQualitySummary(messages, topicsCovered, avgResponseTimeSec, issues);

    await this.prisma.chat.update({
      where: { id: chat.id },
      data: {
        isArchived,
        archiveReason,
      },
    });

    await this.prisma.chatAnalysis.upsert({
      where: { chatId: chat.id },
      create: {
        chatId: chat.id,
        videoNotesCount,
        photosCount,
        voiceCount,
        avgResponseTimeSec,
        eveningMsgCount,
        newChatsNextDay,
        topicsCovered,
        qualityScore,
        qualityIssues: issues,
        archiveReason,
        analyzedAt: new Date(),
        rawAiResult: aiQuality,
      },
      update: {
        videoNotesCount,
        photosCount,
        voiceCount,
        avgResponseTimeSec,
        eveningMsgCount,
        newChatsNextDay,
        topicsCovered,
        qualityScore,
        qualityIssues: issues,
        archiveReason,
        analyzedAt: new Date(),
        rawAiResult: aiQuality,
      },
    });

    const profileData = aiProfile || {};
    const firstMessageMeta = messages.find((m) => m.metadata && typeof m.metadata === 'object')?.metadata as
      | { from?: { id?: string | number; username?: string; first_name?: string } }
      | undefined;

    await this.prisma.clientProfile.upsert({
      where: { chatId: chat.id },
      create: {
        chatId: chat.id,
        telegramUserId: firstMessageMeta?.from?.id ? String(firstMessageMeta.from.id) : chat.telegramChatId,
        displayName:
          typeof profileData.displayName === 'string'
            ? profileData.displayName
            : chat.title || (chat.username ? `@${chat.username}` : chat.telegramChatId),
        hobbies: Array.isArray(profileData.hobbies) ? profileData.hobbies.map(String) : [],
        hometown: typeof profileData.hometown === 'string' ? profileData.hometown : null,
        maritalStatus: typeof profileData.maritalStatus === 'string' ? profileData.maritalStatus : null,
        hasKids: this.parseBool(profileData.hasKids),
        hasPets: this.parseBool(profileData.hasPets),
        favoriteCuisine: typeof profileData.favoriteCuisine === 'string' ? profileData.favoriteCuisine : null,
        canCook: this.parseBool(profileData.canCook),
        favoriteMovies: Array.isArray(profileData.favoriteMovies) ? profileData.favoriteMovies.map(String) : [],
        travelPlaces: Array.isArray(profileData.travelPlaces) ? profileData.travelPlaces.map(String) : [],
        education: typeof profileData.education === 'string' ? profileData.education : null,
        currentJob: typeof profileData.currentJob === 'string' ? profileData.currentJob : null,
        badHabits: Array.isArray(profileData.badHabits) ? profileData.badHabits.map(String) : [],
        dreams: typeof profileData.dreams === 'string' ? profileData.dreams : null,
        fears: typeof profileData.fears === 'string' ? profileData.fears : null,
        financialInfo: typeof profileData.financialInfo === 'string' ? profileData.financialInfo : null,
        rawProfile: profileData,
        extractedAt: new Date(),
      },
      update: {
        displayName:
          typeof profileData.displayName === 'string'
            ? profileData.displayName
            : chat.title || (chat.username ? `@${chat.username}` : chat.telegramChatId),
        hobbies: Array.isArray(profileData.hobbies) ? profileData.hobbies.map(String) : [],
        hometown: typeof profileData.hometown === 'string' ? profileData.hometown : null,
        maritalStatus: typeof profileData.maritalStatus === 'string' ? profileData.maritalStatus : null,
        hasKids: this.parseBool(profileData.hasKids),
        hasPets: this.parseBool(profileData.hasPets),
        favoriteCuisine: typeof profileData.favoriteCuisine === 'string' ? profileData.favoriteCuisine : null,
        canCook: this.parseBool(profileData.canCook),
        favoriteMovies: Array.isArray(profileData.favoriteMovies) ? profileData.favoriteMovies.map(String) : [],
        travelPlaces: Array.isArray(profileData.travelPlaces) ? profileData.travelPlaces.map(String) : [],
        education: typeof profileData.education === 'string' ? profileData.education : null,
        currentJob: typeof profileData.currentJob === 'string' ? profileData.currentJob : null,
        badHabits: Array.isArray(profileData.badHabits) ? profileData.badHabits.map(String) : [],
        dreams: typeof profileData.dreams === 'string' ? profileData.dreams : null,
        fears: typeof profileData.fears === 'string' ? profileData.fears : null,
        financialInfo: typeof profileData.financialInfo === 'string' ? profileData.financialInfo : null,
        rawProfile: profileData,
        extractedAt: new Date(),
      },
    });
  }
}
