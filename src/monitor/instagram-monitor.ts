import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { isClientLast, isSilentAfterPrice } from '#app/monitor/instagram-rules.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  BOT_FIRST_LOOKBACK_MS,
  BOT_FLOW_INTERVAL_MS,
  BOT_OVERLAP_MS,
  INSTAGRAM_SOURCE,
  NEW_BOT_STATUS,
  NEW_BOT_TAG,
  NEWEST_MESSAGES,
  PRODUCT_STATUS,
  START_FLOW_INTERVAL_MS,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

type ChatMove = {
  chat: SitniksChat;
  status: string;
  tag?: string;
};

/**
 * Instagram rules:
 * 1. "Новий": the client pressed the price button and stayed silent after our reply -> "Новий БОТ" + tag "НБ".
 * 2. "Новий БОТ": the client wrote or pressed something -> "Вибір товару".
 */
@Injectable()
export class InstagramMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstagramMonitor.name);
  private lastBotScanAt = Date.now() - BOT_FIRST_LOOKBACK_MS;
  private readonly runners: JobRunner[] = [
    new JobRunner({
      name: 'InstagramStartFlow',
      intervalMs: START_FLOW_INTERVAL_MS,
      run: () => this.moveSilentChats(),
    }),
    new JobRunner({
      name: 'InstagramBotFlow',
      intervalMs: BOT_FLOW_INTERVAL_MS,
      run: () => this.moveRepliedChats(),
    }),
  ];

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.logger.log(`Instagram monitor started, dryRun=${appConfig.instagramDryRun}`);
    this.runners.forEach((runner) => runner.start());
  }

  onModuleDestroy(): void {
    this.runners.forEach((runner) => runner.stop());
  }

  /** Rule 1. Returns ids of chats that were (or would be) moved. */
  async moveSilentChats(): Promise<string[]> {
    const chats = await this.sitniks.listChats({
      status: WATCHED_STATUS,
      initialSource: INSTAGRAM_SOURCE,
    });
    const movedIds: string[] = [];
    for (const chat of chats) {
      const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: NEWEST_MESSAGES });
      if (!isSilentAfterPrice({ messages, userId: chat.userId, nowMs: Date.now() })) continue;
      await this.moveChat({ chat, status: NEW_BOT_STATUS, tag: NEW_BOT_TAG });
      movedIds.push(chat.id);
    }
    return movedIds;
  }

  /** Rule 2. Looks only at chats with recent activity: a client reply always changes the last message time. */
  async moveRepliedChats(): Promise<string[]> {
    const scanStartedAt = Date.now();
    const chats = await this.sitniks.listChats({
      status: NEW_BOT_STATUS,
      initialSource: INSTAGRAM_SOURCE,
      startDate: new Date(this.lastBotScanAt - BOT_OVERLAP_MS).toISOString(),
    });
    const movedIds: string[] = [];
    for (const chat of chats) {
      const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: 1 });
      if (!isClientLast({ messages, userId: chat.userId })) continue;
      await this.moveChat({ chat, status: PRODUCT_STATUS });
      movedIds.push(chat.id);
    }
    this.lastBotScanAt = scanStartedAt;
    return movedIds;
  }

  private async moveChat(move: ChatMove): Promise<void> {
    const { chat, status, tag } = move;
    const label = `${chat.userName} (${chat.ownerName}, ${chat.id})`;
    if (appConfig.instagramDryRun) {
      this.logger.log(`[dry-run] would move ${label} to "${status}"${tag ? ` with tag "${tag}"` : ''}`);
      return;
    }
    if (tag && !chat.tags.includes(tag)) {
      await this.sitniks.setChatTags({ chatId: chat.id, tags: [...chat.tags, tag] });
    }
    await this.sitniks.changeChatStatus({ chatId: chat.id, status });
    this.logger.log(`Moved ${label} to "${status}"`);
  }
}
