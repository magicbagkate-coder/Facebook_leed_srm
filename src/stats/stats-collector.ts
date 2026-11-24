import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { JobRunner } from '#app/monitor/job-runner.js';
import { PRODUCT_STATUS, WATCHED_STATUS } from '#app/monitor/monitor.constants.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import type { StatsPoint, StatusCounts } from '#app/stats/stats.types.js';
import { StatsStore } from '#app/stats/stats-store.js';

const STATS_INTERVAL_MS = 600_000;
// The first pass reads the last message of every chat, so it waits until the urgent checks have settled
const STATS_FIRST_RUN_DELAY_MS = 180_000;

type CachedChat = {
  lastMessageAt: string;
  isUnanswered: boolean;
};

/**
 * Every 10 minutes counts the chats of "Новий" and "Вибір товару": all of them and those without an answer
 * (the newest direct message is the client's). The last message of a chat is read again only when the chat changed.
 */
@Injectable()
export class StatsCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatsCollector.name);
  private readonly cache = new Map<string, CachedChat>();
  private readonly seenIds = new Set<string>();
  private readonly runner = new JobRunner({
    name: 'StatsCollect',
    intervalMs: STATS_INTERVAL_MS,
    firstRunDelayMs: STATS_FIRST_RUN_DELAY_MS,
    lane: 'low',
    run: (): Promise<unknown> => this.collect(),
  });

  constructor(
    private readonly sitniks: SitniksClient,
    private readonly store: StatsStore,
  ) {}

  onModuleInit(): void {
    this.logger.log('Stats collector started');
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }

  async collect(): Promise<StatsPoint> {
    this.seenIds.clear();
    const newChats = await this.countStatus(WATCHED_STATUS);
    const productChoice = await this.countStatus(PRODUCT_STATUS);
    this.forgetMovedChats();
    const point = { at: new Date().toISOString(), newChats, productChoice };
    await this.store.append(point);
    return point;
  }

  private async countStatus(status: string): Promise<StatusCounts> {
    const chats = await this.sitniks.listChats({ status });
    let unanswered = 0;
    for (const chat of chats) {
      this.seenIds.add(chat.id);
      if (await this.isUnanswered(chat)) unanswered += 1;
    }
    return { total: chats.length, unanswered };
  }

  private async isUnanswered(chat: SitniksChat): Promise<boolean> {
    const lastMessageAt = chat.lastMessageCreatedAt ?? '';
    const cached = this.cache.get(chat.id);
    if (cached && cached.lastMessageAt === lastMessageAt) return cached.isUnanswered;
    const [latest] = await this.sitniks.latestMessages({ chatId: chat.id, limit: 1 });
    const isUnanswered = latest !== undefined && latest.sentBy === chat.userId;
    this.cache.set(chat.id, { lastMessageAt, isUnanswered });
    return isUnanswered;
  }

  /** Chats that left the two statuses are dropped, so the cache does not grow forever. */
  private forgetMovedChats(): void {
    for (const chatId of this.cache.keys()) {
      if (!this.seenIds.has(chatId)) this.cache.delete(chatId);
    }
  }
}
