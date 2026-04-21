import { Injectable } from '@nestjs/common';
import { NoteTargetType } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

interface CreateNoteInput {
  accountId: string;
  targetType: NoteTargetType;
  targetId: string;
  text: string;
  tags?: string[];
  authorId?: string;
}

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotes(accountId: string, targetType?: NoteTargetType, targetId?: string) {
    return this.prisma.note.findMany({
      where: {
        accountId,
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
      },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getById(noteId: string) {
    return this.prisma.note.findUnique({
      where: { id: noteId },
      include: { author: true },
    });
  }

  async createNote(input: CreateNoteInput) {
    const relationData = {
      chatId: input.targetType === NoteTargetType.CHAT ? input.targetId : null,
      userId: input.targetType === NoteTargetType.USER ? input.targetId : null,
      messageId: input.targetType === NoteTargetType.MESSAGE ? input.targetId : null,
    };

    return this.prisma.note.create({
      data: {
        accountId: input.accountId,
        targetType: input.targetType,
        targetId: input.targetId,
        text: input.text,
        tags: input.tags || [],
        authorId: input.authorId,
        ...relationData,
      },
    });
  }
}
