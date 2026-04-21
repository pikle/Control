import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this.client = new Redis(redisUrl || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async setJson(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
    await this.client.connect().catch(() => undefined);
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.client.connect().catch(() => undefined);
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async del(key: string): Promise<void> {
    await this.client.connect().catch(() => undefined);
    await this.client.del(key);
  }
}
