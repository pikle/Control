import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  getChats(
    @Query('accountId') accountId: string,
    @Query('q') q?: string,
    @Query('managerBotId') managerBotId?: string,
  ) {
    return this.chatsService.getChats(accountId, q, managerBotId);
  }

  @Get(':chatId/messages')
  getMessages(
    @Param('chatId') chatId: string,
    @Query('limit') limit = '100',
  ) {
    return this.chatsService.getMessages(chatId, Number(limit));
  }

  @Get(':chatId/sidebar')
  getSidebar(@Param('chatId') chatId: string) {
    return this.chatsService.getSidebar(chatId);
  }
}
