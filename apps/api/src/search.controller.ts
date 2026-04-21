import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  globalSearch(
    @Query('accountId') accountId: string,
    @Query('text') text?: string,
    @Query('username') username?: string,
    @Query('userId') userId?: string,
    @Query('chatId') chatId?: string,
    @Query('date') date?: string,
  ) {
    return this.searchService.globalSearch({
      accountId,
      text,
      username,
      userId,
      chatId,
      date,
    });
  }
}
