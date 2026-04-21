import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query('accountId') accountId: string, @Query('q') q?: string) {
    return this.clientsService.list(accountId, q);
  }

  @Get(':chatId')
  details(@Param('chatId') chatId: string) {
    return this.clientsService.details(chatId);
  }
}
