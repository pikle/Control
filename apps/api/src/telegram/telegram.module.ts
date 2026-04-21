import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramAnalyticsController } from './telegram-analytics.controller';
import { TelegramAnalyticsService } from './telegram-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [TelegramController, TelegramAnalyticsController],
  providers: [TelegramService, TelegramAnalyticsService],
})
export class TelegramModule {}
