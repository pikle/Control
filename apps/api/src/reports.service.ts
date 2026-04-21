import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getManagers(accountId: string) {
    if (!accountId) return [];

    const bots = await this.prisma.bot.findMany({
      where: { accountId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        chats: {
          include: {
            analysis: true,
          },
        },
      },
    });

    return bots.map((bot) => {
      const chats = bot.chats;
      const archivedCount = chats.filter((c) => c.isArchived).length;
      const avgScore = chats.length
        ? chats.reduce((sum, c) => sum + (c.analysis?.qualityScore || 0), 0) / chats.length
        : 0;
      const criticalCount = chats.reduce((sum, c) => {
        const issues = (c.analysis?.qualityIssues as Array<{ level?: string }> | null) || [];
        return sum + issues.filter((i) => i.level === 'CRITICAL').length;
      }, 0);

      return {
        id: bot.id,
        name: bot.name,
        tokenMasked: bot.tokenMasked,
        clientsCount: chats.length,
        archivedCount,
        avgScore: Number(avgScore.toFixed(1)),
        criticalCount,
      };
    });
  }

  async getManagerReport(accountId: string, botId: string) {
    if (!accountId || !botId) return [];

    const chats = await this.prisma.chat.findMany({
      where: { accountId, botId },
      include: {
        analysis: true,
        clientProfile: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((chat) => {
      const analysis = chat.analysis;
      const issues = (analysis?.qualityIssues as Array<{ level: string; text: string }> | null) || [];
      const hasCritical = issues.some((i) => i.level === 'CRITICAL');

      return {
        chatId: chat.id,
        title: chat.title,
        username: chat.username,
        telegramChatId: chat.telegramChatId,
        isArchived: chat.isArchived,
        archiveReason: chat.archiveReason,
        videoNotesCount: analysis?.videoNotesCount || 0,
        photosCount: analysis?.photosCount || 0,
        voiceCount: analysis?.voiceCount || 0,
        avgResponseTimeSec: analysis?.avgResponseTimeSec || null,
        eveningMsgCount: analysis?.eveningMsgCount || 0,
        newChatsNextDay: analysis?.newChatsNextDay ?? null,
        topicsCovered: (analysis?.topicsCovered as string[] | null) || [],
        topicsCount: ((analysis?.topicsCovered as string[] | null) || []).length,
        qualityScore: analysis?.qualityScore || 0,
        qualityIssues: issues,
        hasCritical,
        clientProfile: chat.clientProfile,
        analyzedAt: analysis?.analyzedAt || null,
      };
    });
  }
}
