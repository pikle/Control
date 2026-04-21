import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { NoteTargetType } from '@prisma/client';
import { NotesService } from './notes.service';

class CreateNoteDto {
  @IsString()
  accountId!: string;

  @IsEnum(NoteTargetType)
  targetType!: NoteTargetType;

  @IsString()
  targetId!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  authorId?: string;
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  getNotes(
    @Query('accountId') accountId: string,
    @Query('targetType') targetType?: NoteTargetType,
    @Query('targetId') targetId?: string,
  ) {
    return this.notesService.getNotes(accountId, targetType, targetId);
  }

  @Post()
  createNote(@Body() dto: CreateNoteDto) {
    return this.notesService.createNote(dto);
  }

  @Get(':noteId')
  getById(@Param('noteId') noteId: string) {
    return this.notesService.getById(noteId);
  }
}
