import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { AdminModule } from './admin/admin.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { RedisService } from './common/redis.service';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { MetricsController } from './metrics.controller';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    TelegramModule,
    AdminModule,
  ],
  controllers: [
    ChatsController,
    SearchController,
    NotesController,
    ExportsController,
    MetricsController,
    HealthController,
    AnalysisController,
    ReportsController,
    ClientsController,
  ],
  providers: [
    ChatsService,
    SearchService,
    NotesService,
    ExportsService,
    MetricsService,
    AnalysisService,
    ReportsService,
    ClientsService,
    RedisService,
  ],
})
export class AppModule {}
